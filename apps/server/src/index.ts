import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import RedisStore from 'connect-redis';
import Redis from 'ioredis';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { router as authRouter } from './routes/auth';
import { router as apiRouter } from './routes/api';
import { router as adminRouter } from './routes/admin';
import crypto from 'crypto';
import axios from 'axios';
import { prisma } from './lib/prisma';
import { startViewerPolling, stopViewerPolling } from './lib/poller';
import { startChatIngest, stopChatIngest } from './lib/chat';
import { startClipCleanupScheduler } from './lib/clips';
import { config, flags, logConfigWarnings } from './config';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getAppAccessToken, getStreamDetails, listEventSubs as listEventSubsApi, deleteEventSub, subscribeEventSub as subscribeEventSubLib } from './lib/twitch';
import { sseHandler, broadcast } from './lib/sse';
import { sendWebhooks } from './lib/webhooks';
import { computeRecap } from './lib/recap';
import { sendRecapEmail } from './lib/mailer';
import { initRedis, getCacheStats, getQueueStats, isRedisAvailable } from './lib/cache';
import { startJobWorker, isWorkerRunning } from './lib/worker';

const app = express();

const PORT = config.port;
const SESSION_SECRET = config.sessionSecret;
const FRONTEND_URL = config.frontendUrl;
const REDIS_URL = config.redisUrl;

// Initialiser le cache Redis
const cacheRedis = initRedis();

app.set('trust proxy', 1);
app.use(helmet());
app.use(rateLimit({ windowMs: 60_000, max: 120 }));
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
let store: session.Store | undefined;
if (REDIS_URL) {
  const redis = new Redis(REDIS_URL);
  store = new RedisStore({ client: redis });
}

app.use(
  session({
    secret: SESSION_SECRET,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
  secure: config.cookieSecure, // set to true in prod with HTTPS
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

logConfigWarnings();

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/api', apiRouter);
app.use('/admin', adminRouter);
// Expose aussi l'admin sous /api/admin pour reverse-proxy sans collision avec la page Next /admin
app.use('/api/admin', adminRouter);
app.get('/api/events', sseHandler);

// --- EventSub Webhooks (Twitch) ---
const EVENTSUB_SECRET = config.twitch.eventSubSecret;
const EVENTSUB_CALLBACK = config.twitch.eventSubCallback || `${config.baseUrl}/webhooks/twitch/eventsub`;

function verifyTwitchSignature(req: express.Request & { rawBody?: string }): boolean {
  const msgId = req.header('Twitch-Eventsub-Message-Id') || '';
  const timestamp = req.header('Twitch-Eventsub-Message-Timestamp') || '';
  const signature = req.header('Twitch-Eventsub-Message-Signature') || '';
  const body = req.rawBody ?? JSON.stringify(req.body);
  if (!EVENTSUB_SECRET) return false;
  // Vérifier la fraicheur du timestamp (10 minutes)
  try {
    const ts = new Date(timestamp).getTime();
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 10 * 60 * 1000) {
      return false;
    }
  } catch { return false; }
  const message = msgId + timestamp + body;
  const computed = 'sha256=' + crypto.createHmac('sha256', EVENTSUB_SECRET).update(message).digest('hex');
  try {
    const a = Buffer.from(computed);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

app.post('/webhooks/twitch/eventsub', express.json({ type: 'application/json', verify: (req, _res, buf) => { (req as any).rawBody = buf.toString('utf8'); } }), async (req, res) => {
  // Vérification signature
  if (!verifyTwitchSignature(req)) {
    return res.status(403).send('Invalid signature');
  }
  const msgType = req.header('Twitch-Eventsub-Message-Type');
  if (msgType === 'webhook_callback_verification') {
    // Challenge pour confirmer le webhook
    return res.status(200).send(req.body.challenge);
  }
  if (msgType === 'revocation') {
    try {
      const { subscription } = req.body;
      const bId = subscription?.condition?.broadcaster_user_id;
      if (bId) {
        const user = await prisma.user.findFirst({ where: { twitchId: bId } });
          if (user && EVENTSUB_SECRET) {
            await subscribeEventSubLib('stream.online', '1', { broadcaster_user_id: user.twitchId }, EVENTSUB_CALLBACK, EVENTSUB_SECRET);
            await subscribeEventSubLib('stream.offline', '1', { broadcaster_user_id: user.twitchId }, EVENTSUB_CALLBACK, EVENTSUB_SECRET);
            // channel.follow v2 - subscribeEventSubLib auto-adds moderator_user_id
            await subscribeEventSubLib('channel.follow', '2', { broadcaster_user_id: user.twitchId }, EVENTSUB_CALLBACK, EVENTSUB_SECRET);
        }
      }
    } catch (e) {
      console.warn('EventSub revocation handling failed', e);
    }
    return res.status(200).send('OK');
  }
  if (msgType === 'notification') {
    const { subscription, event } = req.body;
    // Gérer stream.online / stream.offline
  if (subscription?.type === 'stream.online') {
      const user = await prisma.user.findFirst({ where: { twitchId: event.broadcaster_user_id } });
      if (user) {
        try {
          const token = (user.tokenExpiresAt.getTime() > Date.now() + 60_000) ? user.accessToken : await getAppAccessToken();
          const details = await getStreamDetails(user.twitchId, token);
          const created = await prisma.stream.create({
            data: {
              userId: user.id,
              twitchStreamId: details?.twitchStreamId || event.id,
              title: details?.title || null,
              category: details?.category || null,
              startedAt: details?.startedAt || new Date(),
            },
          });
          startViewerPolling(user.id, user.twitchId, created.id);
          if (user.login) startChatIngest(user.id, user.login, created.id);
          broadcast(user.id, 'stream.online', { streamId: created.id });
          sendWebhooks(user.id, 'Stream online', `${user.displayName || user.login || 'Streamer'} est en live: ${created.title || ''} ${created.category ? '('+created.category+')' : ''}`);
        } catch (e) {
          console.warn('stream.online enrichment failed, creating minimal stream', e);
          const created = await prisma.stream.create({
            data: { userId: user.id, twitchStreamId: event.id, startedAt: new Date() },
          });
          startViewerPolling(user.id, user.twitchId, created.id);
          if (user.login) startChatIngest(user.id, user.login, created.id);
          broadcast(user.id, 'stream.online', { streamId: created.id });
          sendWebhooks(user.id, 'Stream online', `${user.displayName || user.login || 'Streamer'} est en live.`);
        }
      }
    }
    if (subscription?.type === 'stream.offline') {
      const user = await prisma.user.findFirst({ where: { twitchId: event.broadcaster_user_id } });
      if (user) {
        const last = await prisma.stream.findFirst({ where: { userId: user.id, endedAt: null }, orderBy: { startedAt: 'desc' } });
        if (last) {
          await prisma.stream.update({ where: { id: last.id }, data: { endedAt: new Date() } });
          stopViewerPolling(user.id);
          stopChatIngest(user.id);
          broadcast(user.id, 'stream.offline', { streamId: last.id });
          sendWebhooks(user.id, 'Stream offline', `${user.displayName || user.login || 'Streamer'} vient de terminer son live.`);
          // Envoi email de récap si configuré
          if (user.recapEmailEnabled && user.email) {
            try {
              const recap = await computeRecap(user.id, last.id);
              if (recap) {
                await sendRecapEmail(user.email, recap);
              }
            } catch (e) {
              console.warn('send recap email failed', e);
            }
          }
        }
      }
    }
    if (subscription?.type === 'channel.follow') {
      const user = await prisma.user.findFirst({ where: { twitchId: event.broadcaster_user_id } });
      if (user) {
        await prisma.followerEvent.create({
          data: {
            userId: user.id,
            followerId: String(event.user_id || event.user?.id || ''),
            followerLogin: event.user_login || event.user?.login || null,
            followerName: event.user_name || event.user?.name || null,
            followedAt: event.followed_at ? new Date(event.followed_at) : new Date(),
          },
        });
        broadcast(user.id, 'follower.new', {
          id: event.user_id,
          login: event.user_login,
          name: event.user_name,
          at: event.followed_at,
        });
        sendWebhooks(user.id, 'Nouveau follower', `${event.user_name || event.user_login || event.user_id}`);
      }
    }
    return res.status(200).json({ ok: true });
  }
  return res.status(200).send('OK');
});

// plus de helper local; on utilise lib/twitch.subscribeEventSub

// À l’init serveur, s’abonner aux événements online/offline pour chaque user existant
async function ensureEventSubForAllUsers() {
  const users = await prisma.user.findMany();
  const subs = await listEventSubsApi().catch(()=>({ data: [] as any[] }));
  for (const u of users) {
    await ensureEventSubForUser(u, subs.data);
  }
}

function hasActiveSub(subs: any[], type: string, broadcasterId: string) {
  return subs.some(s => s.type === type && s.status?.toLowerCase?.() === 'enabled' && s.condition?.broadcaster_user_id === broadcasterId && s.transport?.callback === EVENTSUB_CALLBACK);
}

async function ensureEventSubForUser(user: { twitchId: string }, existing?: any[]) {
  const subs = existing || (await listEventSubsApi().catch(()=>({ data: [] as any[] }))).data;
  if (!hasActiveSub(subs, 'stream.online', user.twitchId)) await subscribeEventSubLib('stream.online', '1', { broadcaster_user_id: user.twitchId }, EVENTSUB_CALLBACK, EVENTSUB_SECRET!);
  if (!hasActiveSub(subs, 'stream.offline', user.twitchId)) await subscribeEventSubLib('stream.offline', '1', { broadcaster_user_id: user.twitchId }, EVENTSUB_CALLBACK, EVENTSUB_SECRET!);
  // channel.follow v2 - subscribeEventSubLib auto-adds moderator_user_id
  if (!hasActiveSub(subs, 'channel.follow', user.twitchId)) {
    try {
      await subscribeEventSubLib('channel.follow', '2', { broadcaster_user_id: user.twitchId }, EVENTSUB_CALLBACK, EVENTSUB_SECRET!);
    } catch (e: any) {
      console.warn(`channel.follow subscription failed for ${user.twitchId}:`, e?.response?.data?.message || e?.message);
    }
  }
}

// Reprise polling: redémarrer pour tout stream actif non terminé au boot
async function resumeActiveStreams() {
  const actives = await prisma.stream.findMany({ where: { endedAt: null } });
  for (const s of actives) {
    const user = await prisma.user.findUnique({ where: { id: s.userId } });
    if (user) {
      startViewerPolling(user.id, user.twitchId, s.id);
      if (user.login) startChatIngest(user.id, user.login, s.id);
    }
  }
}

// Démarrage: s'abonner EventSub si activé et reprendre le polling
if (flags.eventSubEnabled) {
  ensureEventSubForAllUsers().catch(err => console.warn('ensureEventSubForAllUsers error', err));
}

resumeActiveStreams().catch(err => console.warn('resumeActiveStreams error', err));

// Start clip cleanup scheduler (Phase 4)
startClipCleanupScheduler();

// Start job worker (Phase 5 - Redis job queue)
if (isRedisAvailable()) {
  startJobWorker(5000); // Poll every 5 seconds
}

// Cron-like jobs (setInterval) pour maintenance légère
// 1) Prune EventSub orphelins/invalides toutes les 24h
setInterval(async () => {
  try {
    const subs = await listEventSubsApi();
    const now = Date.now();
    // Supprimer expirés, invalides, et doublons (garder le plus récent enabled)
    const byKey = new Map<string, any[]>();
    for (const s of subs?.data ?? []) {
      const key = `${s.type}:${s.condition?.broadcaster_user_id}:${s.transport?.callback || ''}`;
      const arr = byKey.get(key) || [];
      arr.push(s); byKey.set(key, arr);
    }
    for (const s of subs?.data ?? []) {
      const expired = s.expires_at ? (new Date(s.expires_at).getTime() < now) : false;
      const bad = s.status && typeof s.status === 'string' && s.status.toLowerCase() !== 'enabled';
      let duplicate = false;
      const key = `${s.type}:${s.condition?.broadcaster_user_id}:${s.transport?.callback || ''}`;
      const group = byKey.get(key) || [];
      if (group.length > 1) {
        // garder celui avec expires_at la plus lointaine
        const best = group.reduce((a, b) => (new Date(a.expires_at ?? 0).getTime() >= new Date(b.expires_at ?? 0).getTime() ? a : b));
        if (s.id !== best.id) duplicate = true;
      }
      if (expired || bad || duplicate) {
        await deleteEventSub(s.id);
      }
    }
  } catch (e) {
    console.warn('prune EventSub failed', e);
  }
}, 24 * 3600 * 1000);

// 1b) Ensure périodique: toutes les 15 minutes on garantit la présence des abonnements nécessaires
if (flags.eventSubEnabled) {
  setInterval(() => {
    ensureEventSubForAllUsers().catch(err => console.warn('periodic ensureEventSubForAllUsers error', err));
  }, 15 * 60 * 1000);
}

// 2) Retention/downsample: supprimer métriques brutes > 180 jours (simple)
setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - 180 * 24 * 3600 * 1000);
    const del = await prisma.streamMetric.deleteMany({ where: { timestamp: { lt: cutoff } } });
    if (del.count > 0) console.log(`[retention] StreamMetric purged: ${del.count}`);
  } catch (e) {
    console.warn('retention job failed', e);
  }
}, 24 * 3600 * 1000);


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
