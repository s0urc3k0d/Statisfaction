import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { computeRecap } from '../lib/recap';
import { sendRecapEmail } from '../lib/mailer';
import { createScheduleSegment, deleteScheduleSegment, findGameIdByName, updateScheduleSegment } from '../lib/twitch';
import { cacheThrough, cacheGet, cacheSet, cacheDel, cacheKeys, CACHE_TTL, invalidateUserCache } from '../lib/cache';
// no direct Prisma input types to avoid TS drift; use plain objects

export const router = Router();

const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_USERS_URL = 'https://api.twitch.tv/helix/users';
const TWITCH_STREAMS_URL = 'https://api.twitch.tv/helix/streams';
const TWITCH_VIDEOS_URL = 'https://api.twitch.tv/helix/videos';
const TWITCH_FOLLOWS_URL = 'https://api.twitch.tv/helix/channels/followed';
const TWITCH_RAID_START_URL = 'https://api.twitch.tv/helix/raids';
const CLIENT_ID = process.env.TWITCH_CLIENT_ID!;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET!;

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req.session as any).userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

async function ensureFreshToken(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  if (user.tokenExpiresAt.getTime() > Date.now() + 60_000) return user; // fresh

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: user.refreshToken,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const resp = await axios.post(TWITCH_TOKEN_URL, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const { access_token, refresh_token, expires_in } = resp.data as {
    access_token: string; refresh_token: string; expires_in: number;
  };
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      accessToken: access_token,
      refreshToken: refresh_token ?? user.refreshToken,
      tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
    },
  });
  return updated;
}

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ id: user.id, login: user.login, displayName: user.displayName, profileImageUrl: user.profileImageUrl, email: user.email, recapEmailEnabled: user.recapEmailEnabled });
});

router.patch('/me', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const { email, recapEmailEnabled } = req.body as { email?: string | null; recapEmailEnabled?: boolean };
  const data: any = {};
  if (typeof email !== 'undefined') data.email = email && email.trim() ? email.trim() : null;
  if (typeof recapEmailEnabled === 'boolean') data.recapEmailEnabled = recapEmailEnabled;
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No fields' });
  const updated = await prisma.user.update({ where: { id: userId }, data });
  res.json({ id: updated.id, login: updated.login, displayName: updated.displayName, profileImageUrl: updated.profileImageUrl, email: updated.email, recapEmailEnabled: updated.recapEmailEnabled });
});

router.get('/twitch/profile', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const user = await ensureFreshToken(userId);
  
  const cacheKey = cacheKeys.userProfile(user.twitchId!);
  const data = await cacheThrough(cacheKey, async () => {
    const r = await axios.get(TWITCH_USERS_URL, {
      headers: { 'Client-Id': CLIENT_ID, Authorization: `Bearer ${user.accessToken}` },
    });
    return r.data;
  }, CACHE_TTL.USER_PROFILE);
  
  res.json(data);
});
// ---- Raid: candidates ----
// GET /api/raid/candidates?sameCategory=1&recentMinutes=120&minViewers=10&maxViewers=200&from=followings
router.get('/raid/candidates', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const user = await ensureFreshToken(userId);
  const fromFollowings = String(req.query.from || '') === 'followings';
  const sameCategory = String(req.query.sameCategory || '') === '1';
  const recentMinutes = Math.max(0, Number(req.query.recentMinutes || 0));
  const minViewers = Number(req.query.minViewers || 0) || 0;
  const maxViewers = Number(req.query.maxViewers || 0) || 0;

  const headers = { 'Client-Id': CLIENT_ID, Authorization: `Bearer ${user.accessToken}` };

  // 1) Get current streamer's info
  let myLang = 'fr';
  let myViewers = 50;
  let myGameId: string | null = null;
  let myCategory: string | null = null;

  try {
    const [userRes, lastStream] = await Promise.all([
      axios.get(`${TWITCH_USERS_URL}?id=${user.twitchId}`, { headers }),
      prisma.stream.findFirst({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        include: { metrics: { orderBy: { timestamp: 'desc' }, take: 1 } }
      })
    ]);
    myLang = userRes.data?.data?.[0]?.broadcaster_language || 'fr';
    myCategory = lastStream?.category ?? null;
    myViewers = lastStream?.metrics?.[0]?.viewerCount ?? 50;
    if (sameCategory && myCategory) {
      try {
        const gameRes = await axios.get(`https://api.twitch.tv/helix/games?name=${encodeURIComponent(myCategory)}`, { headers });
        myGameId = gameRes.data?.data?.[0]?.id || null;
      } catch (e) { console.error('Failed to resolve game ID by name', e); }
    }
  } catch (e) { console.error('Failed to get streamer info', e); }

  // 2) Get followed channels if requested
  let followingIds: string[] = [];
  if (fromFollowings) {
    let cursor: string | undefined;
    try {
      do {
        const fr = await axios.get(`${TWITCH_FOLLOWS_URL}?user_id=${user.twitchId}&first=100${cursor ? `&after=${cursor}` : ''}`, { headers });
        followingIds.push(...(fr.data?.data || []).map((f: any) => String(f.broadcaster_id)));
        cursor = fr.data?.pagination?.cursor;
      } while (cursor);
    } catch (e) { console.error('Failed to get followed channels', e); }
  }

  // 3) Collect streams from various sources
  const allStreams: any[] = [];
  const seenIds = new Set<string>();

  const addStreams = (streams: any[], source: string) => {
    for (const s of streams) {
      if (!seenIds.has(s.user_id)) {
        seenIds.add(s.user_id);
        allStreams.push({ ...s, source });
      }
    }
  };

  const fetchStreams = async (params: URLSearchParams) => {
    try {
      const res = await axios.get(`${TWITCH_STREAMS_URL}?${params.toString()}`, { headers });
      return res.data?.data || [];
    } catch (e) {
      console.error('Failed to fetch streams', e);
      return [];
    }
  };

  // Fetch streams from followed channels
  if (followingIds.length > 0) {
    const chunks = [];
    for (let i = 0; i < followingIds.length; i += 100) {
      chunks.push(followingIds.slice(i, i + 100));
    }
    for (const chunk of chunks) {
      const params = new URLSearchParams();
      chunk.forEach(id => params.append('user_id', id));
      addStreams(await fetchStreams(params), 'following');
    }
  }

  // Fetch streams by category
  if (myGameId) {
    const params = new URLSearchParams({ game_id: myGameId, first: '100' });
    addStreams(await fetchStreams(params), 'category');
  }

  // If not enough results, fetch by language
  if (allStreams.length < 20) {
    const params = new URLSearchParams({ language: myLang, first: '50' });
    addStreams(await fetchStreams(params), 'language');
  }

  // 4) Filter and score streams
  const now = Date.now();
  const followingsSet = new Set(followingIds);

  const scoreItems = allStreams
    .map(s => {
      const started = new Date(s.started_at).getTime();
      const liveMin = (now - started) / 60000;

      // Apply filters
      if (String(s.user_id) === user.twitchId) return null;
      if (fromFollowings && !followingsSet.has(String(s.user_id))) return null;
      if (sameCategory && myGameId && s.game_id !== myGameId) return null;
      if (minViewers && s.viewer_count < minViewers) return null;
      if (maxViewers && s.viewer_count > maxViewers) return null;
      if (recentMinutes > 0 && liveMin > recentMinutes) return null;

      // Scoring
      let score = 0;
      if (myViewers > 0) {
        const ratio = s.viewer_count / myViewers;
        if (ratio > 0.3 && ratio < 3) {
          score += (1 - Math.abs(1 - ratio)) * 50; // Max 50 points for similar size
        }
      }
      if (followingsSet.has(s.user_id)) score += 30;
      if (s.game_id === myGameId) score += 20;
      if (s.language === myLang) score += 10;
      score -= Math.min(liveMin / 10, 10); // Penalty for long streams

      return {
        userId: String(s.user_id),
        login: String(s.user_login),
        name: String(s.user_name),
        gameName: s.game_name ? String(s.game_name) : null,
        language: s.language ? String(s.language) : null,
        viewerCount: Number(s.viewer_count || 0),
        startedAt: s.started_at,
        score: Math.round(score),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.score - a.score);

  res.json({ items: scoreItems });
});

// POST /api/raid/start  { targetUserId }
router.post('/raid/start', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const user = await ensureFreshToken(userId);
  const { targetUserId } = req.body as { targetUserId: string };
  if (!targetUserId) return res.status(400).json({ error: 'Missing targetUserId' });
  try {
    const params = new URLSearchParams();
    params.set('from_broadcaster_id', user.twitchId!);
    params.set('to_broadcaster_id', targetUserId);
    await axios.post(TWITCH_RAID_START_URL, params, { headers: { 'Client-Id': CLIENT_ID, Authorization: `Bearer ${user.accessToken}`, 'Content-Type': 'application/x-www-form-urlencoded' } });
    res.json({ ok: true });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    res.status(200).json({ ok: false, status, message: 'Raid non démarré (droits manquants ?)' });
  }
});

// ---- Recap post-stream ---- (avec cache)
router.get('/streams/:id/recap', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  
  // Cache le recap car calcul coûteux
  const cacheKey = cacheKeys.streamRecap(id);
  const data = await cacheThrough(cacheKey, async () => {
    const recap = await computeRecap(userId, id);
    return recap ? { ...recap, _userId: userId } : null;
  }, CACHE_TTL.ANALYTICS);
  
  if (!data || data._userId !== userId) return res.status(404).json({ error: 'Not found' });
  const { _userId, ...recap } = data;
  res.json(recap);
});
// Moments du dernier stream
router.get('/streams/last/clip-moments', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const last = await prisma.stream.findFirst({ where: { userId }, orderBy: { startedAt: 'desc' } });
  if (!last) return res.json({ items: [] });
  const items = await prisma.clipMoment.findMany({ where: { userId, streamId: last.id }, orderBy: { at: 'asc' } });
  res.json({ items: items.map((m: any)=>({ at: m.at, label: m.label, score: m.score })) });
});
// Clips créés sur le dernier stream
router.get('/streams/last/clips', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const last = await prisma.stream.findFirst({ where: { userId }, orderBy: { startedAt: 'desc' } });
  if (!last) return res.json({ items: [] });
  const items = await prisma.createdClip.findMany({ where: { userId, streamId: last.id }, orderBy: { createdAt: 'desc' } });
  res.json({ items });
});
// GET /api/streams/:id/vod-link?at=timestampMs
router.get('/streams/:id/vod-link', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const id = Number(req.params.id);
  const at = Number(req.query.at || 0);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const stream = await prisma.stream.findFirst({ where: { id, userId } });
  if (!stream) return res.status(404).json({ error: 'Not found' });
  // Chercher la VOD (video_type=archive) la plus proche après start
  const user = await ensureFreshToken(userId);
  try {
    const vr = await axios.get(`${TWITCH_VIDEOS_URL}?user_id=${user.twitchId}&type=archive&first=5`, { headers: { 'Client-Id': CLIENT_ID, Authorization: `Bearer ${user.accessToken}` } });
    const vids = (vr.data?.data || []) as any[];
    const started = stream.startedAt.getTime();
    const target = started + (Number.isFinite(at) ? at : 0);
    let best: any | null = null;
    for (const v of vids) {
      const created = new Date(v.created_at).getTime();
      const durationStr = String(v.duration || '0s');
      // parse duration like 2h3m5s
      const h = /([0-9]+)h/.exec(durationStr)?.[1];
      const m = /([0-9]+)m/.exec(durationStr)?.[1];
      const s = /([0-9]+)s/.exec(durationStr)?.[1];
      const dur = ((Number(h||0)*3600) + (Number(m||0)*60) + Number(s||0)) * 1000;
      const end = created + dur;
      // si la VOD couvre la cible
      if (target >= created && target <= end) { best = v; break; }
      // sinon, prendre la plus proche post-start
      if (created >= started && !best) best = v;
    }
    if (!best) return res.json({ url: null });
    // Construire URL Twitch VOD avec timestamp (t=)
    const created = new Date(best.created_at).getTime();
    const offsetSec = Math.max(0, Math.floor((target - created)/1000));
    const url = `${best.url}?t=${offsetSec}s`;
    res.json({ url });
  } catch (e) {
    res.json({ url: null });
  }
});

router.get('/streams/last/recap', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const stream = await prisma.stream.findFirst({ where: { userId }, orderBy: { startedAt: 'desc' } });
  if (!stream) return res.json({ stream: null, kpis: null, moments: [], funFacts: null });
  (req as any).params = { id: String(stream.id) };
  return (router as any).handle(req, res, () => {});
});

// Renvoi manuel de l'email de récap
router.post('/streams/:id/recap-email', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.email) return res.status(400).json({ error: 'Email non configuré' });
  const recap = await computeRecap(userId, id);
  if (!recap) return res.status(404).json({ error: 'Not found' });
  try {
    await sendRecapEmail(user.email, recap);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Envoi email échoué' });
  }
});

router.get('/twitch/stream', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const user = await ensureFreshToken(userId);
  const r = await axios.get(`${TWITCH_STREAMS_URL}?user_id=${user.twitchId}`, {
    headers: { 'Client-Id': CLIENT_ID, Authorization: `Bearer ${user.accessToken}` },
  });
  res.json(r.data);
});

// Auto-complétion des jeux (Helix /games) - avec cache
router.get('/twitch/games', requireAuth, async (req: Request, res: Response) => {
  const q = String(req.query.query || '').trim();
  if (!q) return res.json({ items: [] });
  const userId = (req.session as any).userId as number;
  const user = await ensureFreshToken(userId);
  
  const cacheKey = cacheKeys.twitchGame(q.toLowerCase());
  try {
    const items = await cacheThrough(cacheKey, async () => {
      const r = await axios.get(`https://api.twitch.tv/helix/games?name=${encodeURIComponent(q)}`, {
        headers: { 'Client-Id': CLIENT_ID, Authorization: `Bearer ${user.accessToken}` },
      });
      return (r.data?.data || []).map((g: any) => ({ id: g.id as string, name: g.name as string }));
    }, CACHE_TTL.TWITCH_API);
    res.json({ items });
  } catch (e) {
    res.json({ items: [] });
  }
});

// Dernier stream depuis la base (summary + série viewers) - cache court
router.get('/twitch/last-stream', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  
  // Cache court (1 min) car les données changent pendant le live
  const cacheKey = `${userId}:last-stream`;
  const data = await cacheThrough(cacheKey, async () => {
    const stream = await prisma.stream.findFirst({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      include: { metrics: { orderBy: { timestamp: 'asc' } } },
    });
    if (!stream) return { summary: null, series: [] };

    const followersCount = await prisma.followerEvent.count({
      where: {
        userId,
        followedAt: {
          gte: stream.startedAt,
          lte: stream.endedAt ?? new Date(),
        },
      },
    });

    const series: { t: number; viewers: number }[] = stream.metrics.map((m: any) => ({ t: new Date(m.timestamp).getTime(), viewers: m.viewerCount as number }));
    const durationMinutes = Math.round(((stream.endedAt?.getTime() ?? Date.now()) - stream.startedAt.getTime()) / 60000);
    const peakViewers = series.length > 0 ? Math.max(...series.map((p: { viewers: number }) => p.viewers)) : 0;
    const avgViewers = series.length > 0 ? Math.round(series.reduce((a: number, p: { viewers: number }) => a + p.viewers, 0) / series.length) : 0;
    const summary = {
      title: stream.title,
      category: stream.category,
      durationMinutes,
      peakViewers,
      avgViewers,
      newFollowers: followersCount,
      newSubscribers: null,
    };
    return { summary, series };
  }, CACHE_TTL.STREAMS_LIST);
  
  res.json(data);
});

// Historique: liste des streams (paginée) avec agrégations peak/avg viewers - cache court
router.get('/streams', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const limit = Math.min(Number(req.query.limit ?? 10), 100) || 10;
  const offset = Math.max(Number(req.query.offset ?? 0), 0) || 0;

  // Cache par page (1 min)
  const page = Math.floor(offset / limit);
  const cacheKey = cacheKeys.userStreams(userId, page);
  
  const data = await cacheThrough(cacheKey, async () => {
    const [total, streams] = await Promise.all([
      prisma.stream.count({ where: { userId } }),
      prisma.stream.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        skip: offset,
        take: limit,
        select: { id: true, title: true, category: true, startedAt: true, endedAt: true },
      }),
    ]);

    if (streams.length === 0) return { total, items: [] };

    const ids = streams.map((s: { id: number }) => s.id);
    const groups = await prisma.streamMetric.groupBy({
      by: ['streamId'],
      where: { streamId: { in: ids } },
      _avg: { viewerCount: true },
      _max: { viewerCount: true },
    });
    const byId = new Map<number, { avg?: number | null; peak?: number | null }>();
    for (const g of groups) {
      byId.set(g.streamId, { avg: (g._avg as any)?.viewerCount ?? null, peak: (g._max as any)?.viewerCount ?? null });
    }

    const items = streams.map((s: { id: number; title: string | null; category: string | null; startedAt: Date; endedAt: Date | null }) => {
      const stats = byId.get(s.id) || {};
      const durationMinutes = Math.round(((s.endedAt?.getTime() ?? Date.now()) - s.startedAt.getTime()) / 60000);
      return {
        id: s.id,
        title: s.title,
        category: s.category,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        durationMinutes,
        peakViewers: stats.peak ?? 0,
        avgViewers: stats.avg ? Math.round(Number(stats.avg)) : 0,
      };
    });
    return { total, items };
  }, CACHE_TTL.STREAMS_LIST);
  
  res.json(data);
});

// Détail d’un stream: summary + série viewers
router.get('/streams/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const stream = await prisma.stream.findFirst({
    where: { id, userId },
    include: { metrics: { orderBy: { timestamp: 'asc' } } },
  });
  if (!stream) return res.status(404).json({ error: 'Not found' });

  const series: { t: number; viewers: number }[] = stream.metrics.map((m: any) => ({ t: new Date(m.timestamp).getTime(), viewers: m.viewerCount as number }));
  const durationMinutes = Math.round(((stream.endedAt?.getTime() ?? Date.now()) - stream.startedAt.getTime()) / 60000);
  const peakViewers = series.length > 0 ? Math.max(...series.map((p: { viewers: number }) => p.viewers)) : 0;
  const avgViewers = series.length > 0 ? Math.round(series.reduce((a: number, p: { viewers: number }) => a + p.viewers, 0) / series.length) : 0;
  const summary = {
    title: stream.title,
    category: stream.category,
    durationMinutes,
    peakViewers,
    avgViewers,
    newFollowers: null,
    newSubscribers: null,
  };
  res.json({ summary, series });
});

// Agrégations période: /api/analytics/summary?from&to (avec cache)
router.get('/analytics/summary', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return res.status(400).json({ error: 'Invalid range' });

  // Cache key arrondie à l'heure
  const fromRounded = new Date(Math.floor(from.getTime() / 3600000) * 3600000).toISOString();
  const toRounded = new Date(Math.floor(to.getTime() / 3600000) * 3600000).toISOString();
  const cacheKey = cacheKeys.analyticsSummary(userId, fromRounded, toRounded);

  const data = await cacheThrough(cacheKey, async () => {
    const streams = await prisma.stream.findMany({
      where: { userId, startedAt: { gte: from }, OR: [{ endedAt: null }, { endedAt: { lte: to } }] },
      orderBy: { startedAt: 'desc' },
      include: { metrics: true },
    });

    const totalStreams = streams.length;
    const totalDurationMinutes = streams.reduce((acc: number, s: { startedAt: Date; endedAt: Date | null }) =>
      acc + Math.max(0, Math.round(((s.endedAt?.getTime() ?? to.getTime()) - Math.max(s.startedAt.getTime(), from.getTime())) / 60000))
    , 0);
    let peakViewers = 0; let viewersSum = 0; let viewersPoints = 0;
    for (const s of streams) {
      for (const m of s.metrics) {
        const t = new Date(m.timestamp).getTime();
        if (t >= from.getTime() && t <= to.getTime()) {
          peakViewers = Math.max(peakViewers, m.viewerCount);
          viewersSum += m.viewerCount; viewersPoints += 1;
        }
      }
    }
    const avgViewers = viewersPoints > 0 ? Math.round(viewersSum / viewersPoints) : 0;

    // Followers dans la période
    const followersCount = await prisma.followerEvent.count({ where: { userId, followedAt: { gte: from, lte: to } } });

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      totalStreams,
      totalDurationMinutes,
      peakViewers,
      avgViewers,
      newFollowers: followersCount,
    };
  }, CACHE_TTL.ANALYTICS);

  res.json(data);
});

// Heatmap horaires: agrégation par jour de semaine (0=lun..6=dim) et heure (0..23)
router.get('/analytics/heatmap', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return res.status(400).json({ error: 'Invalid range' });

  // Récupération des métriques viewers dans la fenêtre pour l’utilisateur
  const metrics = await prisma.streamMetric.findMany({
    where: { timestamp: { gte: from, lte: to }, stream: { userId } },
    select: { timestamp: true, viewerCount: true },
  });
  // Followers dans la période
  const followers = await prisma.followerEvent.findMany({
    where: { userId, followedAt: { gte: from, lte: to } },
    select: { followedAt: true },
  });

  // Buckets 7 x 24
  type Bucket = { sum: number; cnt: number; followers: number };
  const buckets: Bucket[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ sum: 0, cnt: 0, followers: 0 })));

  for (const m of metrics) {
    const d = new Date(m.timestamp);
    // Convertir JS getDay (0=dim..6=sam) en 0=lundi..6=dimanche
    const js = d.getDay();
    const dow = (js + 6) % 7;
    const hour = d.getHours();
    const b = buckets[dow][hour];
    b.sum += m.viewerCount;
    b.cnt += 1;
  }
  for (const f of followers) {
    const d = new Date(f.followedAt);
    const js = d.getDay();
    const dow = (js + 6) % 7;
    const hour = d.getHours();
    buckets[dow][hour].followers += 1;
  }

  const cells: Array<{ dow: number; hour: number; avgViewers: number; followerCount: number; count: number }> = [];
  let maxAvg = 0; let maxFol = 0;
  for (let r = 0; r < 7; r++) {
    for (let h = 0; h < 24; h++) {
      const b = buckets[r][h];
      const avg = b.cnt > 0 ? Math.round(b.sum / b.cnt) : 0;
      cells.push({ dow: r, hour: h, avgViewers: avg, followerCount: b.followers, count: b.cnt });
      if (avg > maxAvg) maxAvg = avg;
      if (b.followers > maxFol) maxFol = b.followers;
    }
  }

  res.json({
    range: { from: from.toISOString(), to: to.toISOString() },
    cells,
    maxAvgViewers: maxAvg,
    maxFollowerCount: maxFol,
    labels: {
      days: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
      hours: Array.from({ length: 24 }, (_, i) => i),
    },
  });
});

// Conversion followers par période, groupée par stream (chevauchement avec la fenêtre)
// GET /api/analytics/conversion?from&to
router.get('/analytics/conversion', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const defaultFrom = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const from = req.query.from ? new Date(String(req.query.from)) : defaultFrom;
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return res.status(400).json({ error: 'Invalid range' });

  // Récupère les streams de l'utilisateur susceptibles de chevaucher la fenêtre
  const streams = await prisma.stream.findMany({
    where: {
      userId,
      startedAt: { lte: to },
      OR: [ { endedAt: null }, { endedAt: { gte: from } } ],
    },
    orderBy: { startedAt: 'desc' },
    select: { id: true, title: true, category: true, startedAt: true, endedAt: true },
  });

  const items: Array<{ streamId: number; title: string | null; category: string | null; startedAt: Date; endedAt: Date | null; durationMinutes: number; followers: number; ratePerHour: number }>= [];
  let totalFollowers = 0; let totalDurationMinutes = 0;

  for (const s of streams) {
    const sStart = s.startedAt;
    const sEnd = s.endedAt ?? to;
    // chevauchement avec [from, to]
    const overlapStart = new Date(Math.max(sStart.getTime(), from.getTime()));
    const overlapEnd = new Date(Math.min(sEnd.getTime(), to.getTime()));
    if (overlapEnd <= overlapStart) continue; // pas de chevauchement

    const followers = await prisma.followerEvent.count({
      where: { userId, followedAt: { gte: overlapStart, lte: overlapEnd } },
    });
    const durationMinutes = Math.max(1, Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 60000));
    const ratePerHour = Number(((followers / durationMinutes) * 60).toFixed(2));
    items.push({
      streamId: s.id,
      title: s.title,
      category: s.category,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      durationMinutes,
      followers,
      ratePerHour,
    });
    totalFollowers += followers;
    totalDurationMinutes += durationMinutes;
  }

  const totals = {
    followers: totalFollowers,
    durationMinutes: totalDurationMinutes,
    ratePerHour: totalDurationMinutes > 0 ? Number(((totalFollowers / totalDurationMinutes) * 60).toFixed(2)) : 0,
  };

  res.json({ range: { from: from.toISOString(), to: to.toISOString() }, items, totals });
});

// ============================================
// PHASE 2 : Analytics avancées
// ============================================

// --- 1. Comparaison de streams ---
// GET /api/streams/compare?ids=1,2,3
router.get('/streams/compare', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const idsParam = String(req.query.ids || '');
  const ids = idsParam.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0);
  
  if (ids.length < 2 || ids.length > 10) {
    return res.status(400).json({ error: 'Provide 2-10 stream IDs' });
  }
  
  // Récupérer les streams avec leurs métriques
  const streams = await prisma.stream.findMany({
    where: { id: { in: ids }, userId },
    include: { metrics: { orderBy: { timestamp: 'asc' } } },
  });
  
  if (streams.length < 2) {
    return res.status(404).json({ error: 'Not enough streams found' });
  }
  
  // Calculer les stats pour chaque stream
  const streamsData = await Promise.all(streams.map(async (s) => {
    const viewers = s.metrics.map(m => m.viewerCount);
    const peakViewers = viewers.length > 0 ? Math.max(...viewers) : 0;
    const avgViewers = viewers.length > 0 ? Math.round(viewers.reduce((a, b) => a + b, 0) / viewers.length) : 0;
    const durationMinutes = Math.round(((s.endedAt?.getTime() ?? Date.now()) - s.startedAt.getTime()) / 60000);
    
    // Followers pendant le stream
    const followers = await prisma.followerEvent.count({
      where: { userId, followedAt: { gte: s.startedAt, lte: s.endedAt ?? new Date() } },
    });
    
    // Calculer la tendance viewers (croissante/décroissante)
    let trend = 0;
    if (viewers.length >= 4) {
      const firstQuarter = viewers.slice(0, Math.floor(viewers.length / 4));
      const lastQuarter = viewers.slice(-Math.floor(viewers.length / 4));
      const avgFirst = firstQuarter.reduce((a, b) => a + b, 0) / firstQuarter.length;
      const avgLast = lastQuarter.reduce((a, b) => a + b, 0) / lastQuarter.length;
      trend = avgFirst > 0 ? Math.round(((avgLast - avgFirst) / avgFirst) * 100) : 0;
    }
    
    // Série temporelle normalisée (% du stream écoulé)
    const series = s.metrics.map((m, i) => ({
      pct: viewers.length > 1 ? Math.round((i / (viewers.length - 1)) * 100) : 0,
      viewers: m.viewerCount,
    }));
    
    return {
      id: s.id,
      title: s.title,
      category: s.category,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      durationMinutes,
      peakViewers,
      avgViewers,
      followers,
      followersPerHour: durationMinutes > 0 ? Number(((followers / durationMinutes) * 60).toFixed(2)) : 0,
      trend, // % variation début vs fin
      series,
    };
  }));
  
  // Trier par date
  streamsData.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  
  // Calculer les deltas par rapport à la moyenne
  const avgPeak = Math.round(streamsData.reduce((a, s) => a + s.peakViewers, 0) / streamsData.length);
  const avgAvg = Math.round(streamsData.reduce((a, s) => a + s.avgViewers, 0) / streamsData.length);
  const avgDuration = Math.round(streamsData.reduce((a, s) => a + s.durationMinutes, 0) / streamsData.length);
  const avgFollowers = Math.round(streamsData.reduce((a, s) => a + s.followers, 0) / streamsData.length);
  
  const comparison = streamsData.map(s => ({
    ...s,
    deltas: {
      peakViewers: s.peakViewers - avgPeak,
      avgViewers: s.avgViewers - avgAvg,
      durationMinutes: s.durationMinutes - avgDuration,
      followers: s.followers - avgFollowers,
      peakViewersPct: avgPeak > 0 ? Math.round(((s.peakViewers - avgPeak) / avgPeak) * 100) : 0,
      avgViewersPct: avgAvg > 0 ? Math.round(((s.avgViewers - avgAvg) / avgAvg) * 100) : 0,
    },
  }));
  
  // Identifier le "meilleur" stream
  const best = comparison.reduce((best, s) => {
    const score = s.avgViewers + s.followers * 10 + (s.trend > 0 ? s.trend : 0);
    const bestScore = best.avgViewers + best.followers * 10 + (best.trend > 0 ? best.trend : 0);
    return score > bestScore ? s : best;
  }, comparison[0]);
  
  // Facteurs de succès
  const factors: string[] = [];
  if (best.category) {
    const catStreams = comparison.filter(s => s.category === best.category);
    if (catStreams.length > 1) {
      const catAvg = catStreams.reduce((a, s) => a + s.avgViewers, 0) / catStreams.length;
      if (catAvg > avgAvg * 1.1) factors.push(`Catégorie "${best.category}" performe +${Math.round(((catAvg - avgAvg) / avgAvg) * 100)}%`);
    }
  }
  if (best.durationMinutes > avgDuration * 1.2) factors.push('Streams plus longs = meilleure audience');
  if (best.trend > 10) factors.push('Audience croissante pendant le stream');
  
  // Grouper par jour de semaine
  const byDay = new Map<number, { count: number; avgViewers: number }>();
  for (const s of comparison) {
    const dow = new Date(s.startedAt).getDay();
    const existing = byDay.get(dow) || { count: 0, avgViewers: 0 };
    byDay.set(dow, { count: existing.count + 1, avgViewers: existing.avgViewers + s.avgViewers });
  }
  const dayPerformance = Array.from(byDay.entries()).map(([dow, d]) => ({
    dow,
    dayName: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][dow],
    avgViewers: Math.round(d.avgViewers / d.count),
    count: d.count,
  })).sort((a, b) => b.avgViewers - a.avgViewers);
  
  if (dayPerformance.length > 1 && dayPerformance[0].avgViewers > dayPerformance[dayPerformance.length - 1].avgViewers * 1.2) {
    factors.push(`${dayPerformance[0].dayName} est ton meilleur jour`);
  }
  
  res.json({
    streams: comparison,
    averages: { peakViewers: avgPeak, avgViewers: avgAvg, durationMinutes: avgDuration, followers: avgFollowers },
    bestStreamId: best.id,
    factors,
    dayPerformance,
  });
});

// --- 2. Prédiction meilleurs horaires ---
// GET /api/analytics/best-times?days=90
router.get('/analytics/best-times', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 365);
  const from = new Date(Date.now() - days * 24 * 3600 * 1000);
  
  // Récupérer les métriques avec leurs streams
  const metrics = await prisma.streamMetric.findMany({
    where: { timestamp: { gte: from }, stream: { userId } },
    include: { stream: { select: { id: true, startedAt: true } } },
  });
  
  // Followers par heure
  const followers = await prisma.followerEvent.findMany({
    where: { userId, followedAt: { gte: from } },
    select: { followedAt: true },
  });
  
  // Agréger par créneau (jour + heure)
  type Slot = { viewers: number[]; followers: number; streamIds: Set<number> };
  const slots: Map<string, Slot> = new Map();
  
  for (const m of metrics) {
    const d = new Date(m.timestamp);
    const dow = (d.getDay() + 6) % 7; // 0=lundi
    const hour = d.getHours();
    const key = `${dow}-${hour}`;
    
    if (!slots.has(key)) slots.set(key, { viewers: [], followers: 0, streamIds: new Set() });
    const slot = slots.get(key)!;
    slot.viewers.push(m.viewerCount);
    slot.streamIds.add(m.stream.id);
  }
  
  for (const f of followers) {
    const d = new Date(f.followedAt);
    const dow = (d.getDay() + 6) % 7;
    const hour = d.getHours();
    const key = `${dow}-${hour}`;
    
    if (!slots.has(key)) slots.set(key, { viewers: [], followers: 0, streamIds: new Set() });
    slots.get(key)!.followers++;
  }
  
  // Calculer le score pour chaque créneau
  const results: Array<{
    dow: number;
    hour: number;
    dayName: string;
    avgViewers: number;
    followers: number;
    streamCount: number;
    score: number;
    confidence: 'high' | 'medium' | 'low';
  }> = [];
  
  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  
  for (const [key, slot] of slots.entries()) {
    const [dow, hour] = key.split('-').map(Number);
    const avgViewers = slot.viewers.length > 0 ? Math.round(slot.viewers.reduce((a, b) => a + b, 0) / slot.viewers.length) : 0;
    const streamCount = slot.streamIds.size;
    
    // Score composite : viewers (50%) + followers/h (30%) + récurrence (20%)
    const viewerScore = avgViewers;
    const followerScore = slot.followers * 10; // Boost followers
    const recurrenceScore = streamCount * 5;
    const score = Math.round(viewerScore * 0.5 + followerScore * 0.3 + recurrenceScore * 0.2);
    
    const confidence = streamCount >= 5 ? 'high' : streamCount >= 2 ? 'medium' : 'low';
    
    results.push({
      dow,
      hour,
      dayName: dayNames[dow],
      avgViewers,
      followers: slot.followers,
      streamCount,
      score,
      confidence,
    });
  }
  
  // Trier par score
  results.sort((a, b) => b.score - a.score);
  
  // Top 5 meilleurs créneaux
  const topSlots = results.slice(0, 5);
  
  // Générer une heatmap complète 7x24
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const maxScore = results.length > 0 ? Math.max(...results.map(r => r.score)) : 1;
  
  for (const r of results) {
    heatmap[r.dow][r.hour] = maxScore > 0 ? Math.round((r.score / maxScore) * 100) : 0;
  }
  
  // Recommandations textuelles
  const recommendations: string[] = [];
  if (topSlots.length > 0) {
    const best = topSlots[0];
    recommendations.push(`🏆 Meilleur créneau : ${best.dayName} ${best.hour}h-${best.hour + 1}h (${best.avgViewers} viewers moy.)`);
  }
  
  // Trouver le meilleur jour global
  const dayScores = new Map<number, number>();
  for (const r of results) {
    dayScores.set(r.dow, (dayScores.get(r.dow) || 0) + r.score);
  }
  const bestDay = Array.from(dayScores.entries()).sort((a, b) => b[1] - a[1])[0];
  if (bestDay) {
    recommendations.push(`📅 Meilleur jour : ${dayNames[bestDay[0]]}`);
  }
  
  // Trouver la meilleure plage horaire
  const hourScores = new Map<number, number>();
  for (const r of results) {
    hourScores.set(r.hour, (hourScores.get(r.hour) || 0) + r.score);
  }
  const sortedHours = Array.from(hourScores.entries()).sort((a, b) => b[1] - a[1]);
  if (sortedHours.length >= 2) {
    const bestHours = sortedHours.slice(0, 3).map(h => h[0]).sort((a, b) => a - b);
    recommendations.push(`⏰ Plage optimale : ${bestHours[0]}h-${bestHours[bestHours.length - 1] + 1}h`);
  }
  
  res.json({
    period: { from: from.toISOString(), days },
    topSlots,
    heatmap,
    recommendations,
    labels: {
      days: dayNames,
      hours: Array.from({ length: 24 }, (_, i) => i),
    },
  });
});

// --- 3. Corrélation catégorie / performance ---
// GET /api/analytics/categories?days=90
router.get('/analytics/categories', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 365);
  const from = new Date(Date.now() - days * 24 * 3600 * 1000);
  
  // Récupérer tous les streams avec catégorie
  const streams = await prisma.stream.findMany({
    where: { userId, startedAt: { gte: from }, category: { not: null } },
    include: { metrics: true },
  });
  
  // Agréger par catégorie
  type CatStats = {
    streams: number;
    totalMinutes: number;
    totalViewers: number;
    peakViewers: number;
    viewerPoints: number;
    followers: number;
    streamIds: number[];
  };
  
  const categories = new Map<string, CatStats>();
  
  for (const s of streams) {
    const cat = s.category || 'Unknown';
    if (!categories.has(cat)) {
      categories.set(cat, { streams: 0, totalMinutes: 0, totalViewers: 0, peakViewers: 0, viewerPoints: 0, followers: 0, streamIds: [] });
    }
    
    const stats = categories.get(cat)!;
    stats.streams++;
    stats.streamIds.push(s.id);
    stats.totalMinutes += Math.round(((s.endedAt?.getTime() ?? Date.now()) - s.startedAt.getTime()) / 60000);
    
    for (const m of s.metrics) {
      stats.totalViewers += m.viewerCount;
      stats.viewerPoints++;
      stats.peakViewers = Math.max(stats.peakViewers, m.viewerCount);
    }
  }
  
  // Récupérer les followers par stream
  for (const [cat, stats] of categories.entries()) {
    const followers = await prisma.followerEvent.count({
      where: {
        userId,
        followedAt: { gte: from },
      },
    });
    // Approximation : répartir les followers proportionnellement au temps de stream
    const totalMinutesAll = Array.from(categories.values()).reduce((a, c) => a + c.totalMinutes, 0);
    stats.followers = totalMinutesAll > 0 ? Math.round((stats.totalMinutes / totalMinutesAll) * followers) : 0;
  }
  
  // Calculer les moyennes globales
  const allStreams = streams.length;
  const allViewerPoints = Array.from(categories.values()).reduce((a, c) => a + c.viewerPoints, 0);
  const allTotalViewers = Array.from(categories.values()).reduce((a, c) => a + c.totalViewers, 0);
  const globalAvgViewers = allViewerPoints > 0 ? Math.round(allTotalViewers / allViewerPoints) : 0;
  
  // Formater les résultats
  const results = Array.from(categories.entries()).map(([category, stats]) => {
    const avgViewers = stats.viewerPoints > 0 ? Math.round(stats.totalViewers / stats.viewerPoints) : 0;
    const avgDuration = stats.streams > 0 ? Math.round(stats.totalMinutes / stats.streams) : 0;
    const followersPerHour = stats.totalMinutes > 0 ? Number(((stats.followers / stats.totalMinutes) * 60).toFixed(2)) : 0;
    
    // Performance relative à la moyenne
    const performanceVsAvg = globalAvgViewers > 0 ? Math.round(((avgViewers - globalAvgViewers) / globalAvgViewers) * 100) : 0;
    
    return {
      category,
      streams: stats.streams,
      totalHours: Math.round(stats.totalMinutes / 60),
      avgViewers,
      peakViewers: stats.peakViewers,
      avgDuration,
      followers: stats.followers,
      followersPerHour,
      performanceVsAvg,
      rating: performanceVsAvg >= 20 ? 'excellent' : performanceVsAvg >= 0 ? 'good' : performanceVsAvg >= -20 ? 'average' : 'poor',
    };
  });
  
  // Trier par performance
  results.sort((a, b) => b.avgViewers - a.avgViewers);
  
  // Top et bottom catégories
  const topCategories = results.filter(r => r.performanceVsAvg >= 10).slice(0, 3);
  const bottomCategories = results.filter(r => r.performanceVsAvg <= -10).slice(-3).reverse();
  
  // Recommandations
  const recommendations: string[] = [];
  if (topCategories.length > 0) {
    recommendations.push(`✅ Tu performes le mieux sur : ${topCategories.map(c => c.category).join(', ')}`);
  }
  if (bottomCategories.length > 0) {
    recommendations.push(`⚠️ Performance en dessous de la moyenne : ${bottomCategories.map(c => c.category).join(', ')}`);
  }
  if (results.length > 0) {
    const mostPlayed = results.reduce((a, b) => a.streams > b.streams ? a : b);
    const bestPerf = results[0];
    if (mostPlayed.category !== bestPerf.category && bestPerf.performanceVsAvg > 20) {
      recommendations.push(`💡 Tu joues souvent à "${mostPlayed.category}" mais "${bestPerf.category}" performe +${bestPerf.performanceVsAvg}% mieux`);
    }
  }
  
  res.json({
    period: { from: from.toISOString(), days },
    globalAvgViewers,
    totalStreams: allStreams,
    categories: results,
    topCategories,
    bottomCategories,
    recommendations,
  });
});

// --- 4. Rétention viewers (courbe de rétention) ---
// GET /api/streams/:id/retention
router.get('/streams/:id/retention', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  
  const stream = await prisma.stream.findFirst({
    where: { id, userId },
    include: { metrics: { orderBy: { timestamp: 'asc' } } },
  });
  
  if (!stream) return res.status(404).json({ error: 'Not found' });
  if (stream.metrics.length < 2) return res.status(400).json({ error: 'Not enough data' });
  
  const viewers = stream.metrics.map(m => m.viewerCount);
  const timestamps = stream.metrics.map(m => new Date(m.timestamp).getTime());
  const startTime = timestamps[0];
  const endTime = timestamps[timestamps.length - 1];
  const duration = endTime - startTime;
  
  // Viewer initial (premier point stable après 5min)
  const stableIndex = Math.min(5, Math.floor(viewers.length * 0.1));
  const initialViewers = viewers.slice(0, stableIndex + 1).reduce((a, b) => Math.max(a, b), viewers[0]);
  
  // Calculer la rétention relative (% du pic initial)
  const retentionCurve = viewers.map((v, i) => ({
    pct: Math.round(((timestamps[i] - startTime) / duration) * 100), // % du stream écoulé
    minutes: Math.round((timestamps[i] - startTime) / 60000),
    viewers: v,
    retention: initialViewers > 0 ? Math.round((v / initialViewers) * 100) : 100,
  }));
  
  // Identifier les drop-offs significatifs (baisse > 15% en peu de temps)
  const dropOffs: Array<{ minute: number; pct: number; drop: number; possibleCause: string }> = [];
  
  for (let i = 1; i < retentionCurve.length; i++) {
    const prev = retentionCurve[i - 1];
    const curr = retentionCurve[i];
    const dropPct = prev.retention - curr.retention;
    
    if (dropPct >= 15) {
      // Essayer d'identifier la cause
      let possibleCause = 'Inconnu';
      if (curr.minutes < 15) possibleCause = 'Début de stream (viewers de passage)';
      else if (curr.pct > 85) possibleCause = 'Fin de stream annoncée';
      else if (dropPct > 30) possibleCause = 'Changement majeur (raid out, pause, technique)';
      else possibleCause = 'Baisse progressive (contenu, horaire)';
      
      dropOffs.push({
        minute: curr.minutes,
        pct: curr.pct,
        drop: dropPct,
        possibleCause,
      });
    }
  }
  
  // Score de rétention global
  const avgRetention = retentionCurve.length > 0 
    ? Math.round(retentionCurve.reduce((a, r) => a + r.retention, 0) / retentionCurve.length)
    : 0;
  
  // Rétention à des points clés
  const getRetentionAt = (targetPct: number) => {
    const point = retentionCurve.find(r => r.pct >= targetPct);
    return point?.retention ?? null;
  };
  
  const keyPoints = {
    at25pct: getRetentionAt(25),
    at50pct: getRetentionAt(50),
    at75pct: getRetentionAt(75),
    at90pct: getRetentionAt(90),
  };
  
  // Tendance globale
  const firstHalf = retentionCurve.slice(0, Math.floor(retentionCurve.length / 2));
  const secondHalf = retentionCurve.slice(Math.floor(retentionCurve.length / 2));
  const avgFirst = firstHalf.reduce((a, r) => a + r.retention, 0) / (firstHalf.length || 1);
  const avgSecond = secondHalf.reduce((a, r) => a + r.retention, 0) / (secondHalf.length || 1);
  const trend = avgSecond >= avgFirst ? 'stable' : avgSecond >= avgFirst * 0.8 ? 'declining' : 'steep_decline';
  
  // Rating
  let rating: 'excellent' | 'good' | 'average' | 'poor';
  if (avgRetention >= 80) rating = 'excellent';
  else if (avgRetention >= 60) rating = 'good';
  else if (avgRetention >= 40) rating = 'average';
  else rating = 'poor';
  
  res.json({
    stream: {
      id: stream.id,
      title: stream.title,
      category: stream.category,
      durationMinutes: Math.round(duration / 60000),
    },
    initialViewers,
    curve: retentionCurve,
    dropOffs,
    avgRetention,
    keyPoints,
    trend,
    rating,
  });
});

// Timeline de conversion pour un stream donné
// GET /api/streams/:id/conversion
router.get('/streams/:id/conversion', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const stream = await prisma.stream.findFirst({ where: { id, userId }, select: { id: true, title: true, category: true, startedAt: true, endedAt: true } });
  if (!stream) return res.status(404).json({ error: 'Not found' });

  const start = stream.startedAt;
  const end = stream.endedAt ?? new Date();
  if (end <= start) return res.json({ stream, followers: [], buckets: [], total: 0, ratePerHour: 0 });

  const followers = await prisma.followerEvent.findMany({
    where: { userId, followedAt: { gte: start, lte: end } },
    orderBy: { followedAt: 'asc' },
    select: { id: true, followedAt: true, followerId: true, followerLogin: true, followerName: true },
  });

  // Bucketing 5 minutes
  const bucketMs = 5 * 60 * 1000;
  const startMs = Math.floor(start.getTime() / bucketMs) * bucketMs;
  const endMs = Math.ceil(end.getTime() / bucketMs) * bucketMs;
  const buckets: { t: number; count: number }[] = [];
  for (let t = startMs; t <= endMs; t += bucketMs) {
    buckets.push({ t, count: 0 });
  }
  let bi = 0;
  for (const f of followers) {
    const ft = new Date(f.followedAt).getTime();
    while (bi + 1 < buckets.length && ft >= buckets[bi + 1].t) bi++;
    buckets[bi].count += 1;
  }

  const total = followers.length;
  const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  const ratePerHour = Number(((total / durationMinutes) * 60).toFixed(2));

  res.json({
    stream: { id: stream.id, title: stream.title, category: stream.category, startedAt: stream.startedAt, endedAt: stream.endedAt, durationMinutes },
    followers: followers.map((f: { followedAt: Date; followerId: string; followerLogin: string | null; followerName: string | null }) => ({ at: new Date(f.followedAt).getTime(), id: f.followerId, login: f.followerLogin, name: f.followerName })),
    buckets,
    total,
    ratePerHour,
  });
});

// ---- Schedule CRUD + ICS ----
router.get('/schedule', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const entries = await prisma.scheduleEntry.findMany({ where: { userId }, orderBy: { start: 'asc' } });
  res.json(entries);
});

// ---- Clips: moments suggérés & création ----
router.get('/streams/:id/clip-moments', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const items = await prisma.clipMoment.findMany({ where: { userId, streamId: id }, orderBy: { score: 'desc' } });
  res.json(items.map((m: any) => ({ id: m.id, at: m.at, label: m.label, score: m.score })));
});

// POST /api/streams/:id/clips  { around?: number(ms) }
router.post('/streams/:id/clips', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const around = typeof (req.body as any)?.around === 'number' ? Number((req.body as any).around) : null;
  const user = await ensureFreshToken(userId);
  try {
    // Helix Create Clip: POST https://api.twitch.tv/helix/clips?broadcaster_id=
    // scope clips:edit requis
    const params = new URLSearchParams();
    params.set('broadcaster_id', user.twitchId!);
    // Note: Helix ne permet pas de passer un timestamp précis; il crée un clip autour de “now”.
    // Si “around” fourni, on peut légèrement décaler via un délai avant l’appel (non idéal). Ici on appelle direct.
    const r = await axios.post('https://api.twitch.tv/helix/clips', params, { headers: { 'Client-Id': CLIENT_ID, Authorization: `Bearer ${user.accessToken}`, 'Content-Type': 'application/x-www-form-urlencoded' } });
    const data = r.data?.data?.[0];
    let saved: any | null = null;
    if (data?.id) {
      try {
        saved = await prisma.createdClip.create({ data: { userId, streamId: id, twitchClipId: String(data.id), editUrl: data.edit_url ?? null, url: null, confirmed: false } });
      } catch (e) { console.error('Failed to save created clip', e); }
      // Essayer de récupérer l'URL publique du clip et confirmer
      try {
        const gr = await axios.get(`https://api.twitch.tv/helix/clips?id=${encodeURIComponent(String(data.id))}`,{ headers: { 'Client-Id': CLIENT_ID, Authorization: `Bearer ${user.accessToken}` } });
        const gi = gr.data?.data?.[0];
        if (gi?.url) {
          await prisma.createdClip.update({ where: { twitchClipId: String(data.id) }, data: { url: String(gi.url), confirmed: true } });
        }
      } catch (e) { console.error('Failed to get clip public URL', e); }
    }
    return res.json({ ok: true, id: data?.id, edit_url: data?.edit_url });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    return res.status(200).json({ ok: false, status, message: 'Clip non créé (scope clips:edit manquant ?)' });
  }
});

// GET /api/streams/:id/clips — liste des clips créés via l’app pour ce stream
router.get('/streams/:id/clips', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const items = await prisma.createdClip.findMany({ where: { userId, streamId: id }, orderBy: { createdAt: 'desc' } });
  res.json({ items });
});

// PATCH /api/clips/:twitchClipId — confirmer et/ou renseigner l’URL publique du clip
router.patch('/clips/:clipId', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const clipId = String(req.params.clipId);
  const { url, confirmed } = req.body as { url?: string | null; confirmed?: boolean };
  const existing = await prisma.createdClip.findUnique({ where: { twitchClipId: clipId } });
  if (!existing || existing.userId !== userId) return res.status(404).json({ error: 'Not found' });
  const data: any = {};
  if (typeof url !== 'undefined') data.url = url;
  if (typeof confirmed === 'boolean') data.confirmed = confirmed;
  const updated = await prisma.createdClip.update({ where: { twitchClipId: clipId }, data });
  res.json(updated);
});

router.post('/schedule', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const { title, category, start, end, timezone, syncTwitch } = req.body as { title: string; category?: string | null; start: string; end: string; timezone?: string | null; syncTwitch?: boolean };
  if (!title || !start || !end) return res.status(400).json({ error: 'Invalid body' });
  // Arrondi de durée au multiple de 15min côté Twitch (marge)
  const created = await prisma.scheduleEntry.create({ data: { userId, title, category: category ?? null, start: new Date(start), end: new Date(end), timezone: timezone ?? null } });
  // Sync Twitch optionnelle (si le user a les bons droits)
  if (syncTwitch) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.accessToken && user?.twitchId) {
        const durationMinutes = Math.max(15, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
        const durRounded = Math.round(durationMinutes / 15) * 15;
        let categoryId: string | null = null;
        if (category) {
          try { categoryId = await findGameIdByName(category, user.accessToken); } catch (e) { console.error('Failed to find game ID by name for schedule', e); }
        }
        const segId = await createScheduleSegment({ broadcasterId: user.twitchId, token: user.accessToken, startTime: new Date(start).toISOString(), durationMinutes: durRounded, title, categoryId, timezone: timezone ?? undefined });
        if (segId) await prisma.scheduleEntry.update({ where: { id: created.id }, data: { twitchSegmentId: segId } });
      }
    } catch (e) {
      console.error('Failed to sync schedule with Twitch', e);
    }
  }
  res.status(201).json(created);
});

router.delete('/schedule/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  // Supprimer côté Twitch si segment connu
  try {
    const entry = await prisma.scheduleEntry.findUnique({ where: { id } });
    if (entry?.twitchSegmentId) {
      const userId = (req.session as any).userId as number;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.accessToken && user?.twitchId) {
        await deleteScheduleSegment({ broadcasterId: user.twitchId, token: user.accessToken, segmentId: entry.twitchSegmentId });
      }
    }
  } catch (e) { console.error('Failed to delete schedule segment on Twitch', e); }
  await prisma.scheduleEntry.delete({ where: { id } }).catch(()=>null);
  res.json({ ok: true });
});

router.patch('/schedule/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const { title, category, start, end, timezone, syncTwitch } = req.body as { title?: string; category?: string | null; start?: string; end?: string; timezone?: string | null; syncTwitch?: boolean };
  const existing = await prisma.scheduleEntry.findUnique({ where: { id } });
  if (!existing || (existing.userId !== userId)) return res.status(404).json({ error: 'Not found' });
  const data: any = {};
  if (typeof title === 'string') data.title = title;
  if (typeof category !== 'undefined') data.category = category;
  if (typeof start === 'string') data.start = new Date(start);
  if (typeof end === 'string') data.end = new Date(end);
  if (typeof timezone !== 'undefined') data.timezone = timezone;
  if ((data.start || existing.start) && (data.end || existing.end)) {
    const s = (data.start as Date) || existing.start;
    const e = (data.end as Date) || existing.end;
    if (!(s instanceof Date) || !(e instanceof Date) || isNaN(s.getTime()) || isNaN(e.getTime()) || s >= e) {
      return res.status(400).json({ error: 'Invalid range' });
    }
  }
  const updated = await prisma.scheduleEntry.update({ where: { id }, data });
  // Sync Twitch si segment connu ou demandé
  if (syncTwitch) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.accessToken && user?.twitchId) {
        const segId = updated.twitchSegmentId;
        const s = (data.start as Date) || existing.start;
        const e = (data.end as Date) || existing.end;
        const durationMinutes = Math.max(15, Math.round((e.getTime() - s.getTime()) / 60000));
        const durRounded = Math.round(durationMinutes / 15) * 15;
        let categoryId: string | null | undefined = undefined;
        if (typeof category !== 'undefined') {
          categoryId = category ? await findGameIdByName(category, user.accessToken) : null;
        }
        if (segId) {
          await updateScheduleSegment({ broadcasterId: user.twitchId, token: user.accessToken, segmentId: segId, startTime: s.toISOString(), durationMinutes: durRounded, title: data.title ?? existing.title, categoryId, timezone: updated.timezone ?? undefined });
        } else {
          const newSegId = await createScheduleSegment({ broadcasterId: user.twitchId, token: user.accessToken, startTime: s.toISOString(), durationMinutes: durRounded, title: data.title ?? existing.title, categoryId: categoryId ?? undefined, timezone: updated.timezone ?? undefined });
          if (newSegId) await prisma.scheduleEntry.update({ where: { id: updated.id }, data: { twitchSegmentId: newSegId } });
        }
      }
    } catch (e) { console.error('Failed to sync schedule with Twitch on update', e); }
  }
  res.json(updated);
});

router.get('/schedule/ics', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const entries = await prisma.scheduleEntry.findMany({ where: { userId } });
  const escape = (s: string) => (s || '').replace(/[\\,;]/g, '\\$&').replace(/\n/g, '\\n');
  const fmt = (d: Date) => {
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth()+1).padStart(2,'0');
    const da = String(d.getUTCDate()).padStart(2,'0');
    const hh = String(d.getUTCHours()).padStart(2,'0');
    const mi = String(d.getUTCMinutes()).padStart(2,'0');
    const ss = String(d.getUTCSeconds()).padStart(2,'0');
    return `${y}${mo}${da}T${hh}${mi}${ss}Z`;
  };
  const now = new Date();
  let ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Statisfaction//EN\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n';
  for (const e of entries) {
    const uid = `statisfaction-${e.id}@local`;
    const title = escape(e.title);
    const cat = e.category ? ` (Cat: ${escape(e.category)})` : '';
    ics += 'BEGIN:VEVENT\n';
    ics += `UID:${uid}\n`;
    ics += `DTSTAMP:${fmt(now)}\n`;
    ics += `DTSTART:${fmt(new Date(e.start))}\n`;
    ics += `DTEND:${fmt(new Date(e.end))}\n`;
    ics += `SUMMARY:${title}${cat}\n`;
    ics += 'END:VEVENT\n';
  }
  ics += 'END:VCALENDAR\n';
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${(user?.login||'schedule')}.ics"`);
  res.send(ics);
});

// ---- Title suggestions (improved heuristics) ----
router.get('/tools/title-suggestions', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  
  // Stopwords à ignorer (mots trop communs)
  const stopwords = new Set([
    'live', 'stream', 'fr', 'en', 'the', 'and', 'les', 'des', 'une', 'avec',
    'pour', 'sur', 'dans', 'qui', 'que', 'est', 'sont', 'road', 'to', 'day',
    'part', 'episode', 'ep', 'let', 'play', 'gameplay', 'gaming', 'twitch'
  ]);
  
  // Récupérer les meilleurs streams (par viewers moyens)
  const streams = await prisma.stream.findMany({
    where: { userId },
    include: { metrics: true },
    orderBy: { startedAt: 'desc' },
    take: 30,
  });
  
  // Calculer les stats par stream
  const scored = streams.map((s: { id: number; title: string | null; category: string | null; metrics: { viewerCount: number }[] }) => {
    const avg = s.metrics.length ? Math.round(s.metrics.reduce((a: number, m: { viewerCount: number }) => a + m.viewerCount, 0) / s.metrics.length) : 0;
    const peak = s.metrics.length ? Math.max(...s.metrics.map(m => m.viewerCount)) : 0;
    return { id: s.id, title: s.title || '', category: s.category || '', avg, peak };
  });
  
  // Top 10 par performance
  const top = scored.sort((a: any, b: any) => b.avg - a.avg).slice(0, 10);
  
  // Extraire les mots significatifs des titres performants
  const wordScores = new Map<string, { count: number; totalAvg: number }>();
  for (const t of top) {
    const titleWords = (t.title || '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    for (const w of titleWords) {
      const lw = w.toLowerCase();
      if (lw.length <= 2 || stopwords.has(lw) || /^\d+$/.test(lw)) continue;
      const existing = wordScores.get(lw) || { count: 0, totalAvg: 0 };
      existing.count++;
      existing.totalAvg += t.avg;
      wordScores.set(lw, existing);
    }
  }
  
  // Trier par score combiné (fréquence * viewers moyens)
  const sortedWords = Array.from(wordScores.entries())
    .map(([word, data]) => ({ word, score: data.count * (data.totalAvg / data.count) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .map(w => w.word);
  
  // Catégories les plus jouées
  const catCounts = new Map<string, number>();
  for (const s of scored) {
    if (s.category) {
      catCounts.set(s.category, (catCounts.get(s.category) || 0) + 1);
    }
  }
  const topCategories = Array.from(catCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);
  
  // Templates de titres variés
  const suggestions: string[] = [];
  
  // 1. Basé sur les mots performants
  if (sortedWords.length >= 2) {
    const w1 = sortedWords[0].charAt(0).toUpperCase() + sortedWords[0].slice(1);
    const w2 = sortedWords[1];
    suggestions.push(`${w1} & ${w2} ${topCategories[0] ? '• ' + topCategories[0] : '• FR'}`);
  }
  
  // 2. Format classique avec catégorie
  if (topCategories[0]) {
    suggestions.push(`${topCategories[0]} • Chill & Fun • FR`);
  }
  
  // 3. Format avec emojis tendance
  if (sortedWords.length >= 1) {
    const keyword = sortedWords[Math.floor(Math.random() * Math.min(5, sortedWords.length))];
    suggestions.push(`🔴 ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} ${topCategories[0] || 'Gaming'} • Viens discuter !`);
  }
  
  // 4. Format soirée thématique
  if (topCategories[0]) {
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const today = dayNames[new Date().getDay()];
    suggestions.push(`${today} ${topCategories[0]} • On se détend ensemble`);
  }
  
  // 5. Format objectif/défi
  if (sortedWords.length >= 1) {
    suggestions.push(`Objectif du jour: ${sortedWords[0]} • ${topCategories[0] || 'Come hang out!'}`);
  }
  
  // 6. Titre inspiré du meilleur stream
  if (top.length > 0 && top[0].title) {
    const bestTitle = top[0].title;
    // Nettoyer et reformuler légèrement
    const cleaned = bestTitle.replace(/[•|·\-–—]/g, '•').replace(/\s+/g, ' ').trim();
    if (!suggestions.includes(cleaned) && cleaned.length > 5) {
      suggestions.push(`${cleaned} (bis)`);
    }
  }
  
  // Filtrer les suggestions vides ou trop courtes
  const finalSuggestions = suggestions
    .filter(s => s && s.trim().length >= 10)
    .slice(0, 6);
  
  res.json({ suggestions: finalSuggestions });
});
// ---- Goals CRUD ----
router.get('/goals', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const goals = await prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  res.json(goals);
});

router.post('/goals', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const { kind, target, from, to } = req.body as { kind: string; target: number; from: string; to: string };
  if (!kind || !Number.isFinite(Number(target)) || !from || !to) return res.status(400).json({ error: 'Invalid body' });
  const g = await prisma.goal.create({ data: { userId, kind, target: Number(target), from: new Date(from), to: new Date(to) } });
  // Invalider le cache des goals
  await cacheDel(cacheKeys.userGoals(userId));
  res.status(201).json(g);
});

router.delete('/goals/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  await prisma.goal.delete({ where: { id } }).catch(() => null);
  // Invalider le cache des goals
  await cacheDel(cacheKeys.userGoals(userId));
  res.json({ ok: true });
});

// Progress for goals (compute current value per kind in range) - avec cache
router.get('/goals/progress', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  
  // Cache 5 minutes car calculs lourds
  const cacheKey = cacheKeys.userGoals(userId);
  const results = await cacheThrough(cacheKey, async () => {
    const goals = await prisma.goal.findMany({ where: { userId } });
    const res: Array<{ id: number; current: number; target: number; pct: number }> = [];
    for (const g of goals) {
      let current = 0;
      if (g.kind === 'followers') {
        current = await prisma.followerEvent.count({ where: { userId, followedAt: { gte: g.from, lte: g.to } } });
      } else if (g.kind === 'avgViewers' || g.kind === 'peakViewers') {
        // Compute on metrics within range
        const metrics = await prisma.streamMetric.findMany({ where: { timestamp: { gte: g.from, lte: g.to }, stream: { userId } }, select: { viewerCount: true } });
        if (g.kind === 'avgViewers') {
          const sum = metrics.reduce((a: number, m: { viewerCount: number }) => a + m.viewerCount, 0);
          current = metrics.length > 0 ? Math.round(sum / metrics.length) : 0;
        } else {
          current = metrics.reduce((mx: number, m: { viewerCount: number }) => Math.max(mx, m.viewerCount), 0);
        }
      } else if (g.kind === 'duration') {
        const streams = await prisma.stream.findMany({ where: { userId, startedAt: { lte: g.to }, OR: [{ endedAt: null }, { endedAt: { gte: g.from } }] } });
        current = streams.reduce((acc: number, s: { startedAt: Date; endedAt: Date | null }) => acc + Math.max(0, Math.round(((s.endedAt ?? g.to).getTime() - Math.max(s.startedAt.getTime(), g.from.getTime())) / 60000)), 0);
      }
      const pct = g.target > 0 ? Math.max(0, Math.min(100, Math.round((current / g.target) * 100))) : 0;
      res.push({ id: g.id, current, target: g.target, pct });
    }
    return res;
  }, CACHE_TTL.TWITCH_API);
  
  res.json(results);
});

// ---- Annotations CRUD ----
router.get('/annotations', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const streamId = req.query.streamId ? Number(req.query.streamId) : undefined;
  const where: any = { userId };
  if (Number.isFinite(streamId)) where.streamId = streamId;
  const anns = await prisma.annotation.findMany({ where, orderBy: { at: 'asc' } });
  res.json(anns);
});

router.post('/annotations', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const { streamId, at, type, label, meta } = req.body as { streamId?: number; at: string; type: string; label: string; meta?: any };
  if (!at || !type || !label) return res.status(400).json({ error: 'Invalid body' });
  const created = await prisma.annotation.create({ data: { userId, streamId: streamId ?? null, at: new Date(at), type, label, meta: meta ? JSON.stringify(meta) : null } });
  res.status(201).json(created);
});

router.delete('/annotations/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  await prisma.annotation.delete({ where: { id } }).catch(() => null);
  res.json({ ok: true });
});

// ================================================
// Phase 3: Chat Analytics
// ================================================

// Liste de stopwords français/anglais/Twitch à filtrer du word cloud
const CHAT_STOPWORDS = new Set([
  // Français
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'en', 'que', 'qui', 'quoi',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'ce', 'ça', 'cet', 'cette',
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'notre', 'votre', 'leur',
  'pour', 'par', 'sur', 'dans', 'avec', 'sans', 'sous', 'mais', 'ou', 'donc', 'car', 'ni',
  'pas', 'plus', 'moins', 'très', 'trop', 'bien', 'mal', 'oui', 'non', 'si', 'ne',
  'est', 'sont', 'fait', 'faire', 'avoir', 'être', 'dit', 'dire', 'voir', 'aller',
  'tout', 'tous', 'toute', 'toutes', 'autre', 'autres', 'même', 'aussi', 'comme', 'quand',
  // Anglais
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
  'what', 'which', 'who', 'whom', 'where', 'when', 'why', 'how',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
  'not', 'no', 'yes', 'so', 'if', 'then', 'than', 'too', 'very', 'just', 'only',
  'can', 'get', 'got', 'go', 'going', 'come', 'know', 'think', 'see', 'look', 'want', 'give',
  // Commun Twitch
  'lol', 'haha', 'xd', 'omg', 'wtf', 'ok', 'okay', 'yeah', 'yep', 'nope', 'idk',
  'http', 'https', 'www', 'com', 'fr', 'gg', 'ez'
]);

// Word cloud pour un stream
router.get('/streams/:id/chat/wordcloud', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const streamId = Number(req.params.id);
  const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 50));
  const includeEmotes = req.query.includeEmotes === 'true';
  
  if (!Number.isFinite(streamId)) return res.status(400).json({ error: 'Invalid streamId' });
  
  // Vérifier ownership
  const stream = await prisma.stream.findFirst({ where: { id: streamId, userId } });
  if (!stream) return res.status(404).json({ error: 'Stream not found' });
  
  const cacheKey = `chat:wordcloud:${streamId}:${limit}:${includeEmotes}`;
  const result = await cacheThrough(cacheKey, async () => {
    // Récupérer les messages
    const messages = await prisma.chatMessage.findMany({
      where: { 
        streamId,
        ...(includeEmotes ? {} : { isEmote: false })
      },
      select: { content: true }
    });
    
    // Compter les mots
    const wordCounts = new Map<string, number>();
    for (const msg of messages) {
      const words = msg.content
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 2 && w.length <= 25 && !CHAT_STOPWORDS.has(w) && !/^\d+$/.test(w));
      
      for (const word of words) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }
    
    // Trier et limiter
    const sorted = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
    
    const maxCount = sorted[0]?.[1] || 1;
    const words = sorted.map(([word, count]) => ({
      word,
      count,
      weight: Math.round((count / maxCount) * 100)
    }));
    
    return { words, totalMessages: messages.length };
  }, CACHE_TTL.ANALYTICS);
  
  res.json(result);
});

// Timeline d'activité chat (messages/min) pour un stream
router.get('/streams/:id/chat/timeline', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const streamId = Number(req.params.id);
  
  if (!Number.isFinite(streamId)) return res.status(400).json({ error: 'Invalid streamId' });
  
  // Vérifier ownership
  const stream = await prisma.stream.findFirst({ where: { id: streamId, userId } });
  if (!stream) return res.status(404).json({ error: 'Stream not found' });
  
  const cacheKey = `chat:timeline:${streamId}`;
  const result = await cacheThrough(cacheKey, async () => {
    // Récupérer les métriques chat
    const metrics = await prisma.chatMetric.findMany({
      where: { streamId },
      orderBy: { timestamp: 'asc' }
    });
    
    // Récupérer les métriques viewers pour corrélation
    const viewerMetrics = await prisma.streamMetric.findMany({
      where: { streamId },
      orderBy: { timestamp: 'asc' }
    });
    
    // Construire la timeline
    const timeline: Array<{
      timestamp: number;
      minute: number;
      messages: number;
      viewers?: number;
      messagesPerViewer?: number;
    }> = [];
    
    const streamStart = stream.startedAt.getTime();
    
    for (const m of metrics) {
      const ts = m.timestamp.getTime();
      const minute = Math.floor((ts - streamStart) / 60000);
      
      // Trouver le viewer count le plus proche
      const closestViewer = viewerMetrics.reduce((closest, v) => {
        const diff = Math.abs(v.timestamp.getTime() - ts);
        const closestDiff = closest ? Math.abs(closest.timestamp.getTime() - ts) : Infinity;
        return diff < closestDiff ? v : closest;
      }, viewerMetrics[0]);
      
      const viewers = closestViewer?.viewerCount;
      
      timeline.push({
        timestamp: ts,
        minute,
        messages: m.messages,
        viewers,
        messagesPerViewer: viewers && viewers > 0 ? Math.round((m.messages / viewers) * 100) / 100 : undefined
      });
    }
    
    // Calculer les stats
    const totalMessages = metrics.reduce((sum, m) => sum + m.messages, 0);
    const avgMessagesPerMin = metrics.length > 0 ? Math.round(totalMessages / metrics.length) : 0;
    const peakMessages = Math.max(...metrics.map(m => m.messages), 0);
    const peakMinute = metrics.find(m => m.messages === peakMessages);
    
    return {
      timeline,
      stats: {
        totalMessages,
        avgMessagesPerMin,
        peakMessages,
        peakMinute: peakMinute ? Math.floor((peakMinute.timestamp.getTime() - streamStart) / 60000) : null
      }
    };
  }, CACHE_TTL.ANALYTICS);
  
  res.json(result);
});

// Détection des "moments chat" (pics d'activité)
router.get('/streams/:id/chat/moments', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const streamId = Number(req.params.id);
  const threshold = Number(req.query.threshold) || 2; // Multiplier du avg pour détecter un pic
  
  if (!Number.isFinite(streamId)) return res.status(400).json({ error: 'Invalid streamId' });
  
  const stream = await prisma.stream.findFirst({ where: { id: streamId, userId } });
  if (!stream) return res.status(404).json({ error: 'Stream not found' });
  
  const cacheKey = `chat:moments:${streamId}:${threshold}`;
  const result = await cacheThrough(cacheKey, async () => {
    const metrics = await prisma.chatMetric.findMany({
      where: { streamId },
      orderBy: { timestamp: 'asc' }
    });
    
    if (metrics.length < 5) {
      return { moments: [], avgMessages: 0 };
    }
    
    const avgMessages = metrics.reduce((sum, m) => sum + m.messages, 0) / metrics.length;
    const streamStart = stream.startedAt.getTime();
    
    // Détecter les pics
    const moments: Array<{
      timestamp: number;
      minute: number;
      messages: number;
      intensity: number; // Multiple de la moyenne
      duration: number; // Nombre de minutes consécutives au-dessus du seuil
    }> = [];
    
    let inMoment = false;
    let momentStart = 0;
    let momentPeak = 0;
    let momentPeakTime = 0;
    
    for (let i = 0; i < metrics.length; i++) {
      const m = metrics[i];
      const isAboveThreshold = m.messages >= avgMessages * threshold;
      
      if (isAboveThreshold && !inMoment) {
        // Début d'un moment
        inMoment = true;
        momentStart = i;
        momentPeak = m.messages;
        momentPeakTime = m.timestamp.getTime();
      } else if (isAboveThreshold && inMoment) {
        // Continuation du moment
        if (m.messages > momentPeak) {
          momentPeak = m.messages;
          momentPeakTime = m.timestamp.getTime();
        }
      } else if (!isAboveThreshold && inMoment) {
        // Fin du moment
        inMoment = false;
        const duration = i - momentStart;
        if (duration >= 1) { // Au moins 1 minute
          moments.push({
            timestamp: momentPeakTime,
            minute: Math.floor((momentPeakTime - streamStart) / 60000),
            messages: momentPeak,
            intensity: Math.round((momentPeak / avgMessages) * 10) / 10,
            duration
          });
        }
      }
    }
    
    // Si on finit dans un moment
    if (inMoment) {
      const duration = metrics.length - momentStart;
      if (duration >= 1) {
        moments.push({
          timestamp: momentPeakTime,
          minute: Math.floor((momentPeakTime - streamStart) / 60000),
          messages: momentPeak,
          intensity: Math.round((momentPeak / avgMessages) * 10) / 10,
          duration
        });
      }
    }
    
    // Récupérer des mots-clés pour chaque moment
    const momentsWithKeywords = await Promise.all(moments.map(async (moment) => {
      const windowStart = new Date(moment.timestamp - 60000);
      const windowEnd = new Date(moment.timestamp + 60000);
      
      const messages = await prisma.chatMessage.findMany({
        where: {
          streamId,
          timestamp: { gte: windowStart, lte: windowEnd },
          isEmote: false
        },
        select: { content: true },
        take: 100
      });
      
      // Extraire les mots les plus fréquents
      const wordCounts = new Map<string, number>();
      for (const msg of messages) {
        const words = msg.content
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, ' ')
          .split(/\s+/)
          .filter(w => w.length >= 3 && !CHAT_STOPWORDS.has(w));
        
        for (const word of words) {
          wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        }
      }
      
      const topWords = Array.from(wordCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word);
      
      return { ...moment, keywords: topWords };
    }));
    
    return {
      moments: momentsWithKeywords.sort((a, b) => b.intensity - a.intensity),
      avgMessages: Math.round(avgMessages),
      threshold
    };
  }, CACHE_TTL.ANALYTICS);
  
  res.json(result);
});

// Sentiment analysis pour un stream
router.get('/streams/:id/chat/sentiment', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const streamId = Number(req.params.id);
  
  if (!Number.isFinite(streamId)) return res.status(400).json({ error: 'Invalid streamId' });
  
  const stream = await prisma.stream.findFirst({ where: { id: streamId, userId } });
  if (!stream) return res.status(404).json({ error: 'Stream not found' });
  
  const cacheKey = `chat:sentiment:${streamId}`;
  const result = await cacheThrough(cacheKey, async () => {
    const messages = await prisma.chatMessage.findMany({
      where: { streamId },
      select: { timestamp: true, sentiment: true },
      orderBy: { timestamp: 'asc' }
    });
    
    if (messages.length === 0) {
      return { timeline: [], summary: { positive: 0, neutral: 0, negative: 0, score: 0 } };
    }
    
    // Agrégation par fenêtre de 5 minutes
    const streamStart = stream.startedAt.getTime();
    const buckets = new Map<number, { positive: number; neutral: number; negative: number }>();
    
    let totalPositive = 0, totalNeutral = 0, totalNegative = 0;
    
    for (const msg of messages) {
      const bucket = Math.floor((msg.timestamp.getTime() - streamStart) / 300000) * 5; // 5 min buckets
      
      if (!buckets.has(bucket)) {
        buckets.set(bucket, { positive: 0, neutral: 0, negative: 0 });
      }
      
      const b = buckets.get(bucket)!;
      if (msg.sentiment === 1) { b.positive++; totalPositive++; }
      else if (msg.sentiment === -1) { b.negative++; totalNegative++; }
      else { b.neutral++; totalNeutral++; }
    }
    
    const timeline = Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([minute, counts]) => {
        const total = counts.positive + counts.neutral + counts.negative;
        return {
          minute,
          ...counts,
          total,
          score: total > 0 ? Math.round(((counts.positive - counts.negative) / total) * 100) : 0
        };
      });
    
    const total = totalPositive + totalNeutral + totalNegative;
    const overallScore = total > 0 ? Math.round(((totalPositive - totalNegative) / total) * 100) : 0;
    
    // Détecter les moments "hype" et "toxiques"
    const hypeMoments = timeline.filter(t => t.score >= 50 && t.total >= 5);
    const toxicMoments = timeline.filter(t => t.score <= -30 && t.total >= 5);
    
    return {
      timeline,
      summary: {
        positive: totalPositive,
        neutral: totalNeutral,
        negative: totalNegative,
        score: overallScore,
        positivePercent: total > 0 ? Math.round((totalPositive / total) * 100) : 0,
        negativePercent: total > 0 ? Math.round((totalNegative / total) * 100) : 0
      },
      hypeMoments: hypeMoments.slice(0, 5),
      toxicMoments: toxicMoments.slice(0, 5)
    };
  }, CACHE_TTL.ANALYTICS);
  
  res.json(result);
});

// Corrélation chat <-> viewers
router.get('/streams/:id/chat/correlation', requireAuth, async (req: Request, res: Response) => {
  const userId = (req.session as any).userId as number;
  const streamId = Number(req.params.id);
  
  if (!Number.isFinite(streamId)) return res.status(400).json({ error: 'Invalid streamId' });
  
  const stream = await prisma.stream.findFirst({ where: { id: streamId, userId } });
  if (!stream) return res.status(404).json({ error: 'Stream not found' });
  
  const cacheKey = `chat:correlation:${streamId}`;
  const result = await cacheThrough(cacheKey, async () => {
    const [chatMetrics, viewerMetrics] = await Promise.all([
      prisma.chatMetric.findMany({ where: { streamId }, orderBy: { timestamp: 'asc' } }),
      prisma.streamMetric.findMany({ where: { streamId }, orderBy: { timestamp: 'asc' } })
    ]);
    
    if (chatMetrics.length < 5 || viewerMetrics.length < 5) {
      return { correlation: null, data: [], insight: "Pas assez de données" };
    }
    
    // Aligner les données par minute
    const streamStart = stream.startedAt.getTime();
    const dataPoints: Array<{ minute: number; messages: number; viewers: number }> = [];
    
    for (const cm of chatMetrics) {
      const minute = Math.floor((cm.timestamp.getTime() - streamStart) / 60000);
      
      // Trouver le viewer count le plus proche
      const closestViewer = viewerMetrics.reduce((closest, v) => {
        const diff = Math.abs(v.timestamp.getTime() - cm.timestamp.getTime());
        const closestDiff = closest ? Math.abs(closest.timestamp.getTime() - cm.timestamp.getTime()) : Infinity;
        return diff < closestDiff ? v : closest;
      }, viewerMetrics[0]);
      
      if (closestViewer) {
        dataPoints.push({
          minute,
          messages: cm.messages,
          viewers: closestViewer.viewerCount
        });
      }
    }
    
    // Calculer le coefficient de corrélation de Pearson
    const n = dataPoints.length;
    const sumX = dataPoints.reduce((s, d) => s + d.messages, 0);
    const sumY = dataPoints.reduce((s, d) => s + d.viewers, 0);
    const sumXY = dataPoints.reduce((s, d) => s + d.messages * d.viewers, 0);
    const sumX2 = dataPoints.reduce((s, d) => s + d.messages * d.messages, 0);
    const sumY2 = dataPoints.reduce((s, d) => s + d.viewers * d.viewers, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    const correlation = denominator !== 0 ? Math.round((numerator / denominator) * 100) / 100 : 0;
    
    // Générer un insight
    let insight = '';
    if (correlation > 0.7) {
      insight = "Forte corrélation positive : plus de viewers = plus d'activité chat. Ton audience est très engagée !";
    } else if (correlation > 0.4) {
      insight = "Corrélation modérée : l'activité chat suit globalement le nombre de viewers.";
    } else if (correlation > 0) {
      insight = "Faible corrélation : l'activité chat est relativement indépendante du nombre de viewers.";
    } else if (correlation > -0.4) {
      insight = "Pas de corrélation claire entre viewers et activité chat.";
    } else {
      insight = "Corrélation négative inhabituelle : l'activité chat diminue quand les viewers augmentent. Vérifie si ton chat n'est pas bridé.";
    }
    
    return { correlation, data: dataPoints, insight };
  }, CACHE_TTL.ANALYTICS);
  
  res.json(result);
});

// ============================================================================
// CLIP QUEUE MANAGEMENT (Phase 4)
// ============================================================================

import {
  getClipSettings,
  updateClipSettings,
  getPendingClipMoments,
  getClipQueueStats,
  createClip,
  rejectClipMoment,
  getTopMoments,
  getClipsForCompilation
} from '../lib/clips';

// Get user's clip settings
router.get('/clips/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const settings = await getClipSettings(userId);
    res.json(settings);
  } catch (error) {
    console.error('Error getting clip settings:', error);
    res.status(500).json({ error: 'Failed to get clip settings' });
  }
});

// Update user's clip settings
router.put('/clips/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const { autoClipEnabled, autoClipThreshold, notifyOnSuggest, expirationDays, maxClipsPerStream } = req.body;
    
    const updates: any = {};
    if (typeof autoClipEnabled === 'boolean') updates.autoClipEnabled = autoClipEnabled;
    if (typeof autoClipThreshold === 'number') updates.autoClipThreshold = Math.max(0, Math.min(100, autoClipThreshold));
    if (typeof notifyOnSuggest === 'boolean') updates.notifyOnSuggest = notifyOnSuggest;
    if (typeof expirationDays === 'number') updates.expirationDays = Math.max(1, Math.min(30, expirationDays));
    if (typeof maxClipsPerStream === 'number') updates.maxClipsPerStream = Math.max(1, Math.min(50, maxClipsPerStream));
    
    const settings = await updateClipSettings(userId, updates);
    res.json(settings);
  } catch (error) {
    console.error('Error updating clip settings:', error);
    res.status(500).json({ error: 'Failed to update clip settings' });
  }
});

// Get pending clip moments (queue)
router.get('/clips/queue', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const streamId = req.query.streamId ? Number(req.query.streamId) : undefined;
    const moments = await getPendingClipMoments(userId, streamId);
    res.json(moments);
  } catch (error) {
    console.error('Error getting clip queue:', error);
    res.status(500).json({ error: 'Failed to get clip queue' });
  }
});

// Get clip queue stats
router.get('/clips/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const stats = await getClipQueueStats(userId);
    res.json(stats);
  } catch (error) {
    console.error('Error getting clip stats:', error);
    res.status(500).json({ error: 'Failed to get clip stats' });
  }
});

// Approve/create clip from a clip moment
router.post('/clips/queue/:momentId/approve', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const momentId = Number(req.params.momentId);
    
    // Verify ownership
    const moment = await prisma.clipMoment.findUnique({
      where: { id: momentId },
      include: { stream: true }
    });
    
    if (!moment) {
      return res.status(404).json({ error: 'Clip moment not found' });
    }
    
    if (moment.stream.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (moment.status !== 'pending') {
      return res.status(400).json({ error: `Clip moment is already ${moment.status}` });
    }
    
    const clip = await createClip(userId, moment.streamId, momentId);
    res.json(clip);
  } catch (error: any) {
    console.error('Error approving clip:', error);
    res.status(500).json({ error: error.message || 'Failed to create clip' });
  }
});

// Reject a clip moment
router.post('/clips/queue/:momentId/reject', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const momentId = Number(req.params.momentId);
    
    const result = await rejectClipMoment(userId, momentId);
    
    if (!result) {
      return res.status(404).json({ error: 'Clip moment not found or access denied' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error rejecting clip:', error);
    res.status(500).json({ error: 'Failed to reject clip' });
  }
});

// Get top moments for a stream (for compilation)
router.get('/clips/top-moments/:streamId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const streamId = Number(req.params.streamId);
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    
    // Verify ownership
    const stream = await prisma.stream.findUnique({ where: { id: streamId } });
    if (!stream || stream.userId !== userId) {
      return res.status(404).json({ error: 'Stream not found' });
    }
    
    const moments = await getTopMoments(streamId, limit);
    res.json(moments);
  } catch (error) {
    console.error('Error getting top moments:', error);
    res.status(500).json({ error: 'Failed to get top moments' });
  }
});

// Get all clips ready for compilation
router.get('/clips/compilation', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const streamIds = req.query.streamIds 
      ? String(req.query.streamIds).split(',').map(Number).filter(n => !isNaN(n))
      : undefined;
    
    const clips = await getClipsForCompilation(userId, streamIds);
    res.json(clips);
  } catch (error) {
    console.error('Error getting clips for compilation:', error);
    res.status(500).json({ error: 'Failed to get clips for compilation' });
  }
});

// Bulk approve multiple clip moments
router.post('/clips/queue/bulk-approve', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const { momentIds } = req.body as { momentIds: number[] };
    
    if (!Array.isArray(momentIds) || momentIds.length === 0) {
      return res.status(400).json({ error: 'momentIds array required' });
    }
    
    const results: { momentId: number; success: boolean; clip?: any; error?: string }[] = [];
    
    for (const momentId of momentIds.slice(0, 10)) { // Max 10 at a time
      try {
        const moment = await prisma.clipMoment.findUnique({
          where: { id: momentId },
          include: { stream: true }
        });
        
        if (!moment || moment.stream.userId !== userId || moment.status !== 'pending') {
          results.push({ momentId, success: false, error: 'Not found or not pending' });
          continue;
        }
        
        const clip = await createClip(userId, moment.streamId, momentId);
        results.push({ momentId, success: true, clip });
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        results.push({ momentId, success: false, error: error.message });
      }
    }
    
    res.json({ results });
  } catch (error) {
    console.error('Error bulk approving clips:', error);
    res.status(500).json({ error: 'Failed to bulk approve clips' });
  }
});

// Bulk reject multiple clip moments
router.post('/clips/queue/bulk-reject', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const { momentIds } = req.body as { momentIds: number[] };
    
    if (!Array.isArray(momentIds) || momentIds.length === 0) {
      return res.status(400).json({ error: 'momentIds array required' });
    }
    
    // Get all valid moments
    const moments = await prisma.clipMoment.findMany({
      where: {
        id: { in: momentIds },
        status: 'pending',
        stream: { userId }
      }
    });
    
    // Bulk update
    await prisma.clipMoment.updateMany({
      where: { id: { in: moments.map(m => m.id) } },
      data: { status: 'rejected' }
    });
    
    res.json({ 
      success: true, 
      rejectedCount: moments.length,
      rejectedIds: moments.map(m => m.id)
    });
  } catch (error) {
    console.error('Error bulk rejecting clips:', error);
    res.status(500).json({ error: 'Failed to bulk reject clips' });
  }
});

// ============================================================================
// VIDEO COMPILATION (Phase 4)
// ============================================================================

import {
  checkFFmpeg,
  startCompilation,
  getJobStatus,
  getUserJobs,
  getCompilationHistory,
  deleteCompilation
} from '../lib/compilation';

// Check if FFmpeg is available
router.get('/compilation/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const ffmpegAvailable = await checkFFmpeg();
    res.json({ ffmpegAvailable });
  } catch (error) {
    console.error('Error checking FFmpeg:', error);
    res.status(500).json({ error: 'Failed to check FFmpeg status' });
  }
});

// Start a new compilation
router.post('/compilation/start', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const { clipIds, format, quality, includeTransitions, title } = req.body as {
      clipIds: string[];
      format?: 'landscape' | 'portrait' | 'square';
      quality?: 'low' | 'medium' | 'high';
      includeTransitions?: boolean;
      title?: string;
    };
    
    if (!Array.isArray(clipIds) || clipIds.length === 0) {
      return res.status(400).json({ error: 'clipIds array required' });
    }
    
    const result = await startCompilation(userId, clipIds, {
      format,
      quality,
      includeTransitions,
      title
    });
    
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ jobId: result.jobId, message: 'Compilation started' });
  } catch (error) {
    console.error('Error starting compilation:', error);
    res.status(500).json({ error: 'Failed to start compilation' });
  }
});

// Get compilation job status
router.get('/compilation/job/:jobId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const jobId = req.params.jobId;
    
    const job = getJobStatus(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (job.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(job);
  } catch (error) {
    console.error('Error getting job status:', error);
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

// Get all active jobs for user
router.get('/compilation/jobs', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const jobs = getUserJobs(userId);
    res.json(jobs);
  } catch (error) {
    console.error('Error getting user jobs:', error);
    res.status(500).json({ error: 'Failed to get jobs' });
  }
});

// Get compilation history
router.get('/compilation/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const history = await getCompilationHistory(userId, limit);
    res.json(history);
  } catch (error) {
    console.error('Error getting compilation history:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// Delete a compilation
router.delete('/compilation/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const compilationId = Number(req.params.id);
    
    const success = await deleteCompilation(userId, compilationId);
    if (!success) {
      return res.status(404).json({ error: 'Compilation not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting compilation:', error);
    res.status(500).json({ error: 'Failed to delete compilation' });
  }
});

// Download a compilation
router.get('/compilation/:id/download', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const compilationId = Number(req.params.id);
    
    const compilation = await prisma.compilation.findUnique({
      where: { id: compilationId }
    });
    
    if (!compilation || compilation.userId !== userId) {
      return res.status(404).json({ error: 'Compilation not found' });
    }
    
    if (!compilation.outputPath || compilation.status !== 'done') {
      return res.status(400).json({ error: 'Compilation not ready' });
    }
    
    const filename = compilation.title 
      ? `${compilation.title.replace(/[^a-zA-Z0-9-_]/g, '_')}.mp4`
      : `compilation_${compilation.id}.mp4`;
    
    res.download(compilation.outputPath, filename);
  } catch (error) {
    console.error('Error downloading compilation:', error);
    res.status(500).json({ error: 'Failed to download compilation' });
  }
});

// ==========================================
// GIVEAWAY ROUTES
// ==========================================
import * as giveawayService from '../lib/giveaway';

// List user giveaways
router.get('/giveaways', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const giveaways = await giveawayService.getUserGiveaways(userId);
    // Optional status filter
    const status = req.query.status as string | undefined;
    const filtered = status ? giveaways.filter(g => g.status === status) : giveaways;
    res.json(filtered);
  } catch (error) {
    console.error('Error fetching giveaways:', error);
    res.status(500).json({ error: 'Failed to fetch giveaways' });
  }
});

// Get single giveaway
router.get('/giveaways/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const giveawayId = Number(req.params.id);
    const giveaway = await giveawayService.getGiveaway(userId, giveawayId);
    if (!giveaway) return res.status(404).json({ error: 'Giveaway not found' });
    res.json(giveaway);
  } catch (error) {
    console.error('Error fetching giveaway:', error);
    res.status(500).json({ error: 'Failed to fetch giveaway' });
  }
});

// Create giveaway
router.post('/giveaways', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const { title, description, prize, entryMethod, keyword, subscriberOnly, minFollowAge, maxEntries, winnersCount } = req.body;
    const giveaway = await giveawayService.createGiveaway(userId, {
      title,
      description,
      prize,
      entryMethod: entryMethod || 'chat',
      keyword,
      subscriberOnly: subscriberOnly ?? false,
      minFollowAge: minFollowAge ?? 0,
      maxEntries: maxEntries,
      winnersCount: winnersCount ?? 1,
    });
    res.status(201).json(giveaway);
  } catch (error) {
    console.error('Error creating giveaway:', error);
    res.status(500).json({ error: 'Failed to create giveaway' });
  }
});

// Update giveaway
router.patch('/giveaways/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const giveawayId = Number(req.params.id);
    const giveaway = await giveawayService.updateGiveaway(userId, giveawayId, req.body);
    if (!giveaway) return res.status(404).json({ error: 'Giveaway not found' });
    res.json(giveaway);
  } catch (error) {
    console.error('Error updating giveaway:', error);
    res.status(500).json({ error: 'Failed to update giveaway' });
  }
});

// Delete giveaway
router.delete('/giveaways/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const giveawayId = Number(req.params.id);
    const success = await giveawayService.deleteGiveaway(userId, giveawayId);
    if (!success) return res.status(404).json({ error: 'Giveaway not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting giveaway:', error);
    res.status(500).json({ error: 'Failed to delete giveaway' });
  }
});

// Start giveaway
router.post('/giveaways/:id/start', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const giveawayId = Number(req.params.id);
    const giveaway = await giveawayService.startGiveaway(userId, giveawayId);
    if (!giveaway) return res.status(404).json({ error: 'Giveaway not found' });
    res.json(giveaway);
  } catch (error) {
    console.error('Error starting giveaway:', error);
    res.status(500).json({ error: 'Failed to start giveaway' });
  }
});

// End giveaway
router.post('/giveaways/:id/end', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const giveawayId = Number(req.params.id);
    const giveaway = await giveawayService.endGiveaway(userId, giveawayId);
    if (!giveaway) return res.status(404).json({ error: 'Giveaway not found' });
    res.json(giveaway);
  } catch (error) {
    console.error('Error ending giveaway:', error);
    res.status(500).json({ error: 'Failed to end giveaway' });
  }
});

// Cancel giveaway
router.post('/giveaways/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const giveawayId = Number(req.params.id);
    const giveaway = await giveawayService.cancelGiveaway(userId, giveawayId);
    if (!giveaway) return res.status(404).json({ error: 'Giveaway not found' });
    res.json(giveaway);
  } catch (error) {
    console.error('Error cancelling giveaway:', error);
    res.status(500).json({ error: 'Failed to cancel giveaway' });
  }
});

// Add entry to giveaway
router.post('/giveaways/:id/entries', requireAuth, async (req: Request, res: Response) => {
  try {
    const giveawayId = Number(req.params.id);
    const { twitchUserId, username, displayName, isSubscriber, followAge } = req.body;
    const entry = await giveawayService.addEntry(giveawayId, {
      twitchUserId,
      username,
      displayName,
      isSubscriber: isSubscriber ?? false,
      followAge: followAge ?? undefined,
    });
    res.status(201).json(entry);
  } catch (error) {
    console.error('Error adding giveaway entry:', error);
    res.status(500).json({ error: (error as Error).message || 'Failed to add entry' });
  }
});

// Get giveaway entries
router.get('/giveaways/:id/entries', requireAuth, async (req: Request, res: Response) => {
  try {
    const giveawayId = Number(req.params.id);
    const entries = await giveawayService.getEntries(giveawayId);
    res.json(entries);
  } catch (error) {
    console.error('Error fetching entries:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

// Draw winners
router.post('/giveaways/:id/draw', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const giveawayId = Number(req.params.id);
    const winners = await giveawayService.drawWinners(userId, giveawayId);
    if (!winners) return res.status(400).json({ error: 'Cannot draw winners' });
    res.json(winners);
  } catch (error) {
    console.error('Error drawing winners:', error);
    res.status(500).json({ error: 'Failed to draw winners' });
  }
});

// Reroll a winner
router.post('/giveaways/:id/reroll/:position', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const giveawayId = Number(req.params.id);
    const position = Number(req.params.position);
    const newWinner = await giveawayService.rerollWinner(userId, giveawayId, position);
    if (!newWinner) return res.status(400).json({ error: 'Cannot reroll winner' });
    res.json(newWinner);
  } catch (error) {
    console.error('Error rerolling winner:', error);
    res.status(500).json({ error: 'Failed to reroll winner' });
  }
});

// Mark winner as claimed
router.post('/giveaways/:id/winners/:winnerId/claim', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const giveawayId = Number(req.params.id);
    const twitchUserId = req.params.winnerId;
    const result = await giveawayService.markWinnerClaimed(userId, giveawayId, twitchUserId);
    res.json(result);
  } catch (error) {
    console.error('Error marking winner as claimed:', error);
    res.status(500).json({ error: 'Failed to update winner' });
  }
});

// Get giveaway stats
router.get('/giveaways/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const stats = await giveawayService.getGiveawayStats(userId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching giveaway stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ==========================================
// GOALS ROUTES
// ==========================================
import * as goalsService from '../lib/goals';

// List user goals
router.get('/goals', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const activeOnly = req.query.active === '1' || req.query.active === 'true';
    const goals = activeOnly 
      ? await goalsService.getActiveGoals(userId)
      : await goalsService.getUserGoals(userId);
    res.json(goals);
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

// Create goal
router.post('/goals', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const { kind, target, from, to, title, description } = req.body;
    const goal = await goalsService.createGoal(userId, {
      kind,
      target,
      from: from ? new Date(from) : new Date(),
      to: to ? new Date(to) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      title,
      description,
    });
    res.status(201).json(goal);
  } catch (error) {
    console.error('Error creating goal:', error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// Update goal
router.patch('/goals/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const goalId = Number(req.params.id);
    const updates = { ...req.body };
    if (updates.startAt) updates.startAt = new Date(updates.startAt);
    if (updates.endAt) updates.endAt = new Date(updates.endAt);
    const goal = await goalsService.updateGoal(userId, goalId, updates);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    res.json(goal);
  } catch (error) {
    console.error('Error updating goal:', error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// Delete goal
router.delete('/goals/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const goalId = Number(req.params.id);
    const success = await goalsService.deleteGoal(userId, goalId);
    if (!success) return res.status(404).json({ error: 'Goal not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting goal:', error);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

// Get goal presets with current progress
router.get('/goals/presets', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const presets = await goalsService.getGoalPresetsWithProgress(userId);
    res.json(presets);
  } catch (error) {
    console.error('Error fetching goal presets:', error);
    res.status(500).json({ error: 'Failed to fetch presets' });
  }
});

// Get user achievements
router.get('/achievements', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const achievements = await goalsService.getUserAchievements(userId);
    res.json(achievements);
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// ==========================================
// NOTIFICATION SETTINGS ROUTES
// ==========================================
import * as notificationService from '../lib/notifications';

// Get notification settings
router.get('/notifications/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const settings = await notificationService.getNotificationSettings(userId);
    res.json(settings);
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update notification settings
router.patch('/notifications/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const settings = await notificationService.updateNotificationSettings(userId, req.body);
    res.json(settings);
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Add webhook
router.post('/notifications/webhooks', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const { url, type } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    const webhook = await notificationService.addWebhook(userId, url, type || 'discord');
    res.json(webhook);
  } catch (error) {
    console.error('Error adding webhook:', error);
    res.status(500).json({ error: 'Failed to add webhook' });
  }
});

// Get user webhooks
router.get('/notifications/webhooks', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const webhooks = await notificationService.getUserWebhooks(userId);
    res.json(webhooks);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

// Remove webhook
router.delete('/notifications/webhooks/:index', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId as number;
    const index = Number(req.params.index);
    const settings = await notificationService.removeWebhook(userId, index);
    res.json(settings);
  } catch (error) {
    console.error('Error removing webhook:', error);
    res.status(500).json({ error: 'Failed to remove webhook' });
  }
});

// Test webhook
router.post('/notifications/webhooks/test', requireAuth, async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    const success = await notificationService.testWebhook(url);
    res.json({ success });
  } catch (error) {
    console.error('Error testing webhook:', error);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});
