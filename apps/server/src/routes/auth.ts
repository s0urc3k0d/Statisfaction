import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../lib/prisma';

export const router = Router();

const TWITCH_AUTH_URL = 'https://id.twitch.tv/oauth2/authorize';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_USERS_URL = 'https://api.twitch.tv/helix/users';

const CLIENT_ID = process.env.TWITCH_CLIENT_ID!;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET!;
const REDIRECT_URI = process.env.TWITCH_REDIRECT_URI!;
const FRONTEND_URL = process.env.FRONTEND_URL!;

router.get('/twitch', (req, res) => {
  const state = Math.random().toString(36).slice(2);
  // stocker state en session pour vérifier le callback
  (req.session as any).state = state;
  // Optionnel: redirection après login
  if (typeof req.query.redirect === 'string') {
    (req.session as any).postRedirect = req.query.redirect;
  }
  // Demander dès l'initialisation tous les scopes nécessaires aux fonctionnalités
  // user:read:email (profil/email), user:read:follows (lecture followings)
  // channel:manage:schedule (calendrier), channel:manage:raids (raids), clips:edit (création de clips)
  // moderator:read:followers (EventSub channel.follow v2 - requis depuis sept 2023)
  const scope = 'user:read:email user:read:follows channel:manage:schedule channel:manage:raids clips:edit moderator:read:followers';
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope,
    state,
  });
  const url = `${TWITCH_AUTH_URL}?${params.toString()}`;
  res.redirect(url);
});

// Re-consent pour ajouter des scopes (ex: channel:manage:schedule)
router.get('/twitch/rescope', (req, res) => {
  const state = Math.random().toString(36).slice(2);
  (req.session as any).state = state;
  // Enregistrer la redirection désirée après le callback
  if (typeof req.query.redirect === 'string') {
    (req.session as any).postRedirect = req.query.redirect;
  } else {
    (req.session as any).postRedirect = `${FRONTEND_URL}/tools`;
  }
  const scope = 'user:read:email channel:manage:schedule channel:manage:raids user:read:follows clips:edit moderator:read:followers';
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope,
    state,
    force_verify: 'true',
  });
  const url = `${TWITCH_AUTH_URL}?${params.toString()}`;
  res.redirect(url);
});

router.get('/twitch/callback', async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };
  try {
    if (!code || !state || state !== (req.session as any).state) {
      return res.status(400).send('Invalid OAuth callback.');
    }

    // Exchange code for token
    const tokenParams = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    });

    const tokenResp = await axios.post(TWITCH_TOKEN_URL, tokenParams, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const {
      access_token,
      refresh_token,
      expires_in,
      token_type,
    } = tokenResp.data as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };

    // Fetch user info
    const meResp = await axios.get(TWITCH_USERS_URL, {
      headers: {
        'Client-Id': CLIENT_ID,
        Authorization: `Bearer ${access_token}`,
      },
    });

    const user = meResp.data.data?.[0];
    if (!user) {
      return res.status(400).send('Unable to fetch Twitch user');
    }

    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // Upsert user in DB
    const dbUser = await prisma.user.upsert({
      where: { twitchId: user.id },
      create: {
        twitchId: user.id,
        login: user.login,
        displayName: user.display_name,
        email: (user as any).email || null,
        profileImageUrl: user.profile_image_url,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiresAt,
      },
      update: {
        login: user.login,
        displayName: user.display_name,
        email: (user as any).email || null,
        profileImageUrl: user.profile_image_url,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiresAt,
      },
    });

    // Create session
  (req.session as any).userId = dbUser.id;
  (req.session as any).twitchId = dbUser.twitchId;

    // Import initial: récupérer les VODs (archives) récentes pour peupler l'historique si absent
    try {
      await importRecentVods(dbUser.id, dbUser.twitchId, access_token);
    } catch (e) {
      console.warn('Import VODs failed', e);
    }

    // Redirect to preferred location if set
    const post = (req.session as any).postRedirect as string | undefined;
    if (post) {
      // nettoyage pour éviter réutilisation
      (req.session as any).postRedirect = undefined;
      res.redirect(post);
    } else {
      // Rediriger vers la page d'accueil applicative avec tuiles
      res.redirect(`${FRONTEND_URL}/home`);
    }
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send('OAuth error.');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/session', async (req, res) => {
  const userId = (req.session as any).userId as number | undefined;
  if (!userId) return res.status(401).json({ authenticated: false });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, user: { id: user.id, displayName: user.displayName, login: user.login, profileImageUrl: user.profileImageUrl, isAdmin: user.isAdmin } });
});

// --- Helpers ---
function parseTwitchDurationToMs(duration: string): number {
  // format exemple: "2h3m5s" ou "1h" ou "45m" ou "30s"
  const h = /([0-9]+)h/.exec(duration)?.[1];
  const m = /([0-9]+)m/.exec(duration)?.[1];
  const s = /([0-9]+)s/.exec(duration)?.[1];
  return ((Number(h||0)*3600) + (Number(m||0)*60) + Number(s||0)) * 1000;
}

async function importRecentVods(userId: number, twitchUserId: string, userAccessToken: string) {
  // Importer jusqu'à 20 archives récentes
  const r = await axios.get(`https://api.twitch.tv/helix/videos?user_id=${encodeURIComponent(twitchUserId)}&type=archive&first=20`, {
    headers: { 'Client-Id': CLIENT_ID, Authorization: `Bearer ${userAccessToken}` },
  }).catch(()=>null);
  const vids = (r?.data?.data || []) as any[];
  for (const v of vids) {
    const created = new Date(v.created_at);
    const durMs = parseTwitchDurationToMs(String(v.duration || '0s'));
    const ended = new Date(created.getTime() + durMs);
    // Éviter doublons: chercher un stream proche de created
    const existing = await prisma.stream.findFirst({
      where: {
        userId,
        startedAt: { gte: new Date(created.getTime() - 5*60*1000), lte: new Date(created.getTime() + 5*60*1000) },
      },
    });
    if (existing) continue;
    await prisma.stream.create({
      data: {
        userId,
        twitchStreamId: v.stream_id ? String(v.stream_id) : null,
        title: v.title || null,
        category: v.game_name ? String(v.game_name) : null,
        startedAt: created,
        endedAt: Number.isFinite(durMs) && durMs > 0 ? ended : null,
      },
    });
  }
}
