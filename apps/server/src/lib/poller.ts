import axios from 'axios';
import { prisma } from './prisma';
import { broadcast } from './sse';
import { sendWebhooks } from './webhooks';
import { maybeAutoClip, getClipSettings } from './clips';

const pollers = new Map<number, NodeJS.Timeout>(); // key: userId

const CLIENT_ID = process.env.TWITCH_CLIENT_ID!;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET!;

// Rafraîchir le User Token (pas fallback vers App Token!)
async function refreshUserToken(userId: number): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  
  // Token encore valide?
  if (user.tokenExpiresAt.getTime() > Date.now() + 60_000) {
    return user.accessToken;
  }
  
  // Rafraîchir avec le refresh_token
  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: user.refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    const resp = await axios.post('https://id.twitch.tv/oauth2/token', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const { access_token, refresh_token, expires_in } = resp.data;
    await prisma.user.update({
      where: { id: userId },
      data: {
        accessToken: access_token,
        refreshToken: refresh_token ?? user.refreshToken,
        tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
      },
    });
    return access_token;
  } catch (e) {
    console.warn('Failed to refresh user token:', e instanceof Error ? e.message : e);
    return null;
  }
}

export function startViewerPolling(userId: number, twitchUserId: string, streamId: number) {
  if (pollers.has(userId)) return;
  let lastViewers: number | null = null;
  const interval = setInterval(async () => {
    try {
      const token = await refreshUserToken(userId);
      if (!token) return;
      const r = await axios.get(`https://api.twitch.tv/helix/streams?user_id=${twitchUserId}`, {
        headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${token}` },
      });
      const data = r.data?.data?.[0];
      if (data) {
        await prisma.streamMetric.create({
          data: { streamId, timestamp: new Date(), viewerCount: data.viewer_count ?? 0 },
        });
        broadcast(userId, 'viewers.update', { streamId, viewers: data.viewer_count ?? 0, at: Date.now() });
        // spike detection (viewers + chat)
        const curr = data.viewer_count ?? 0;
        if (typeof lastViewers === 'number') {
          const delta = curr - lastViewers;
          const pct = lastViewers > 0 ? delta / lastViewers : 0;
          // Mesure chat: somme des messages sur la dernière minute vs précédente
          let chatBoost = 0;
          try {
            const nowTs = new Date();
            const prevStart = new Date(nowTs.getTime() - 2 * 60_000);
            const lastTwo = await prisma.chatMetric.findMany({
              where: { streamId, timestamp: { gte: prevStart } },
              orderBy: { timestamp: 'asc' }
            });
            if (lastTwo.length >= 2) {
              const last = lastTwo[lastTwo.length - 1]?.messages ?? 0;
              const before = lastTwo[lastTwo.length - 2]?.messages ?? 0;
              const d = last - before;
              // chatBoost: ratio d'augmentation, normalisé entre 0 et 1
              // +50% de messages = 0.5, +100% = 1
              if (before > 0) {
                chatBoost = Math.min(1, Math.max(0, d / before));
              } else if (last > 5) {
                // Si pas de messages avant mais maintenant oui, c'est un pic
                chatBoost = Math.min(1, last / 20);
              }
            }
          } catch {}
          
          // Seuils ADAPTATIFS basés sur la taille du stream
          // Pour un petit streamer (20 viewers), +5 viewers = +25% = significatif
          // Pour un gros streamer (500 viewers), +5 viewers = +1% = bruit
          const baseViewers = Math.max(10, lastViewers);
          const minDeltaForSpike = Math.max(3, Math.round(baseViewers * 0.15)); // Au moins +15%
          const minPctForSpike = 0.12; // Au moins +12%
          
          // Score combiné: pondéré par viewers ET chat
          const viewerScore = pct > 0 ? Math.min(1, pct / 0.5) : 0; // 50% = score max
          const combined = (viewerScore * 0.7) + (chatBoost * 0.3);
          
          // Conditions pour un spike:
          // - Au moins minDeltaForSpike viewers en plus OU +minPctForSpike%
          // - Score combiné >= 0.25 (viewers + chat cohérents)
          const isSpike = (delta >= minDeltaForSpike || pct >= minPctForSpike) && combined >= 0.25;
          
          if (isSpike && delta > 0) {
            await prisma.raidEvent.create({ data: { userId, streamId, fromViewers: lastViewers, toViewers: curr, delta } });
            broadcast(userId, 'spike.detected', { streamId, from: lastViewers, to: curr, delta, at: Date.now() });
            // Clip moment suggestion - seuils plus bas pour détecter les bons moments
            try {
              const at = new Date();
              // Score basé sur l'intensité relative du spike
              const score = Math.round(
                (pct * 100) +           // % d'augmentation (ex: +30% = 30 points)
                (chatBoost * 50) +      // Activité chat (0-50 points)
                Math.min(30, delta)     // Delta brut plafonné (0-30 points)
              );
              const label = chatBoost >= 0.4 ? 'Spike viewers + chat' : 
                           pct >= 0.3 ? 'Pic de viewers (+' + Math.round(pct*100) + '%)' :
                           'Moment intéressant';
              
              // Get clip settings for expiration
              const settings = await getClipSettings(userId);
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + settings.expirationDays);
              
              const cm = await prisma.clipMoment.create({ 
                data: { userId, streamId, at, label, score, expiresAt } 
              });
              
              if (settings.notifyOnSuggest) {
                broadcast(userId, 'clip.suggested', { streamId, at: at.getTime(), label: cm.label, score });
              }
              
              // Try auto-clip if enabled and score is high enough
              await maybeAutoClip(userId, streamId, cm.id, score);
            } catch (e) {
              console.warn('Failed to create clip moment:', e);
            }
            sendWebhooks(userId, 'Spike détecté', `+${delta} viewers (de ${lastViewers} à ${curr})`);
          }
        }
        lastViewers = curr;
      }
    } catch (e) {
      console.warn('polling error', e instanceof Error ? e.message : e);
    }
  }, 60_000);
  pollers.set(userId, interval);
}

export function stopViewerPolling(userId: number) {
  const i = pollers.get(userId);
  if (i) clearInterval(i);
  pollers.delete(userId);
}
