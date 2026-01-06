import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { listEventSubs, deleteEventSub, subscribeEventSub, subscribeEventSubWithUserToken } from '../lib/twitch';
import { config, flags } from '../config';
import axios from 'axios';
import { getAppAccessToken } from '../lib/twitch';
import { getCacheStats, cacheFlushAll, isRedisAvailable, getQueueStats, resetCacheMetrics, addJob, JOB_QUEUES } from '../lib/cache';
import { isWorkerRunning, getRegisteredJobTypes } from '../lib/worker';
import { getConnectedClients } from '../lib/sse';

export const router = Router();

async function requireAdmin(req: Request, res: Response, next: Function) {
  const userId = (req.session as any).userId as number | undefined;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  if (!u?.isAdmin) return res.status(403).json({ error: 'Forbidden' });
  next();
}

router.get('/eventsub/subscriptions', requireAdmin, async (_req, res) => {
  const subs = await listEventSubs();
  res.json(subs);
});

router.delete('/eventsub/subscriptions/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  await deleteEventSub(id);
  res.json({ ok: true });
});

router.post('/eventsub/resync', requireAdmin, async (_req, res) => {
  if (!flags.eventSubEnabled) return res.status(400).json({ error: 'EventSub disabled' });
  const users = await prisma.user.findMany();
  const errors: Array<{ userId: number; type: string; error: string }> = [];
  for (const u of users) {
    try { await subscribeEventSub('stream.online', '1', { broadcaster_user_id: u.twitchId }, config.twitch.eventSubCallback || `${config.baseUrl}/webhooks/twitch/eventsub`, config.twitch.eventSubSecret!); }
    catch (e: any) { errors.push({ userId: u.id, type: 'stream.online', error: String(e?.response?.data?.message || e?.message || e) }); }
    try { await subscribeEventSub('stream.offline', '1', { broadcaster_user_id: u.twitchId }, config.twitch.eventSubCallback || `${config.baseUrl}/webhooks/twitch/eventsub`, config.twitch.eventSubSecret!); }
    catch (e: any) { errors.push({ userId: u.id, type: 'stream.offline', error: String(e?.response?.data?.message || e?.message || e) }); }
    // channel.follow v2 requiert User Access Token avec moderator:read:followers
    try { await subscribeEventSubWithUserToken('channel.follow', '2', { broadcaster_user_id: u.twitchId }, config.twitch.eventSubCallback || `${config.baseUrl}/webhooks/twitch/eventsub`, config.twitch.eventSubSecret!, u.accessToken); }
    catch (e: any) { errors.push({ userId: u.id, type: 'channel.follow', error: String(e?.response?.data?.message || e?.message || e) }); }
  }
  res.json({ ok: true, users: users.length, errors });
});

// Prune immédiat des EventSub expirés ou non enabled
router.post('/eventsub/prune', requireAdmin, async (_req, res) => {
  try {
    const subs = await listEventSubs();
    const now = Date.now();
    let pruned = 0;
    for (const s of subs?.data ?? []) {
      const expired = s.expires_at ? (new Date(s.expires_at).getTime() < now) : false;
      const bad = s.status && typeof s.status === 'string' && s.status.toLowerCase() !== 'enabled';
      if (expired || bad) {
        await deleteEventSub(s.id);
        pruned++;
      }
    }
    res.json({ ok: true, pruned });
  } catch (e) {
    res.status(500).json({ error: 'Prune failed' });
  }
});

// Liste/recherche d'utilisateurs (admin)
router.get('/users', requireAdmin, async (req, res) => {
  const q = String(req.query.q || '').trim();
  const where: any = q ? {
    OR: [
      { login: { contains: q } },
      { displayName: { contains: q } },
      { twitchId: { equals: q } },
      { email: { contains: q } },
    ],
  } : {};
  const users = await prisma.user.findMany({
    where,
    take: 50,
    orderBy: { createdAt: 'desc' },
    select: { id: true, twitchId: true, login: true, displayName: true, email: true, isAdmin: true, createdAt: true },
  });
  res.json(users);
});

// Health check EventSub: vérifie l'état et tente de réabonner si besoin
router.post('/eventsub/health-check', requireAdmin, async (_req, res) => {
  try {
    const subs = await listEventSubs();
    let repaired = 0;
    const users = await prisma.user.findMany();
  const need = new Map<string, string[]>(users.map((u: { twitchId: string }) => [u.twitchId, ['stream.online','stream.offline','channel.follow']]));
    for (const s of subs?.data ?? []) {
      const types = need.get(s.condition?.broadcaster_user_id || '');
      if (!types) continue;
      if ((s.status || '').toLowerCase() === 'enabled') {
        need.set(s.condition?.broadcaster_user_id || '', types.filter(t => t !== s.type));
      }
    }
    for (const [twitchId, missing] of need.entries()) {
  const u = users.find((x: { twitchId: string; accessToken: string }) => x.twitchId === twitchId);
      if (!u) continue;
      for (const t of missing) {
        try {
          if (t === 'channel.follow') {
            // channel.follow v2 requiert User Access Token avec moderator:read:followers
            await subscribeEventSubWithUserToken(t, '2', { broadcaster_user_id: twitchId }, config.twitch.eventSubCallback || `${config.baseUrl}/webhooks/twitch/eventsub`, config.twitch.eventSubSecret!, u.accessToken);
          } else {
            await subscribeEventSub(t, '1', { broadcaster_user_id: twitchId }, config.twitch.eventSubCallback || `${config.baseUrl}/webhooks/twitch/eventsub`, config.twitch.eventSubSecret!);
          }
          repaired++;
        } catch (e) {
          // ignorer les erreurs ponctuelles; l'ensure périodique réessaiera
        }
      }
    }
    res.json({ ok: true, repaired });
  } catch (e) {
    res.status(500).json({ error: 'Health check failed' });
  }
});

// Import historique profond des VODs (archives) pour un utilisateur
// POST /admin/import/vods { userId?: number, twitchId?: string, max?: number }
router.post('/import/vods', requireAdmin, async (req, res) => {
  try {
    let targetUser = null as null | { id: number; twitchId: string };
    const body = req.body as { userId?: number; twitchId?: string; max?: number; from?: string; to?: string };
    if (typeof body.userId === 'number') {
      targetUser = await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true, twitchId: true } });
    } else if (body.twitchId) {
      targetUser = await prisma.user.findFirst({ where: { twitchId: body.twitchId }, select: { id: true, twitchId: true } });
    } else {
      // défaut: l’admin courant
      const adminId = (req.session as any).userId as number;
      targetUser = await prisma.user.findUnique({ where: { id: adminId }, select: { id: true, twitchId: true } });
    }
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

  const max = Math.max(1, Math.min(Number(body.max ?? 1000), 5000));
  const fromTs = body.from ? new Date(body.from).getTime() : null;
  const toTs = body.to ? new Date(body.to).getTime() : null;
    const token = await getAppAccessToken();
    let imported = 0;
    let cursor: string | null = null;
    const seen = new Set<string>();
    while (imported < max) {
      const pageSize = Math.min(100, max - imported);
      const url = new URL('https://api.twitch.tv/helix/videos');
      url.searchParams.set('user_id', targetUser.twitchId);
      url.searchParams.set('type', 'archive');
      url.searchParams.set('first', String(pageSize));
      if (cursor) url.searchParams.set('after', cursor);
      const r = await axios.get(url.toString(), { headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${token}` } });
      const vids = (r.data?.data || []) as any[];
      const pageInfo = r.data?.pagination || {};
      for (const v of vids) {
        const key = String(v.id || v.stream_id || v.created_at);
        if (seen.has(key)) continue;
        seen.add(key);
        const created = new Date(v.created_at);
        const durationStr = String(v.duration || '0s');
        const durMs = parseTwitchDurationToMs(durationStr);
        const ended = new Date(created.getTime() + durMs);
        const createdMs = created.getTime();
        if (fromTs && createdMs < fromTs) { cursor = null; break; } // on a dépassé la période demandée
        if (toTs && createdMs > toTs) { continue; }
        const exists = await prisma.stream.findFirst({
          where: {
            userId: targetUser.id,
            OR: [
              { twitchStreamId: v.stream_id ? String(v.stream_id) : '__none__' },
              { startedAt: { gte: new Date(created.getTime() - 5*60*1000), lte: new Date(created.getTime() + 5*60*1000) } },
            ],
          },
        });
        if (exists) continue;
        await prisma.stream.create({
          data: {
            userId: targetUser.id,
            twitchStreamId: v.stream_id ? String(v.stream_id) : null,
            title: v.title || null,
            category: v.game_name ? String(v.game_name) : null,
            startedAt: created,
            endedAt: Number.isFinite(durMs) && durMs > 0 ? ended : null,
          },
        });
        imported++;
        if (imported >= max) break;
      }
      cursor = pageInfo?.cursor || null;
      if (!cursor || vids.length === 0) break;
    }
    res.json({ ok: true, imported });
  } catch (e) {
    res.status(500).json({ error: 'Import failed' });
  }
});

function parseTwitchDurationToMs(duration: string): number {
  const h = /([0-9]+)h/.exec(duration)?.[1];
  const m = /([0-9]+)m/.exec(duration)?.[1];
  const s = /([0-9]+)s/.exec(duration)?.[1];
  return ((Number(h||0)*3600) + (Number(m||0)*60) + Number(s||0)) * 1000;
}

// Webhooks (Discord/Slack/custom) CRUD + test
router.get('/webhooks', requireAdmin, async (req, res) => {
  const userId = (req.session as any).userId as number;
  const hooks = await prisma.notificationWebhook.findMany({ where: { userId } });
  res.json(hooks);
});
router.post('/webhooks', requireAdmin, async (req, res) => {
  const userId = (req.session as any).userId as number;
  const { kind, url, active } = req.body as { kind: string; url: string; active?: boolean };
  if (!kind || !url) return res.status(400).json({ error: 'Invalid body' });
  const created = await prisma.notificationWebhook.create({ data: { userId, kind, url, active: active ?? true } });
  res.status(201).json(created);
});
router.delete('/webhooks/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  await prisma.notificationWebhook.delete({ where: { id } }).catch(()=>null);
  res.json({ ok: true });
});
router.post('/webhooks/:id/test', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const hook = await prisma.notificationWebhook.findUnique({ where: { id } });
  if (!hook) return res.status(404).json({ error: 'Not found' });
  try {
    if (hook.kind === 'discord') await axios.post(hook.url, { content: '**Test Statisfaction**' });
    else if (hook.kind === 'slack') await axios.post(hook.url, { text: '*Test Statisfaction*' });
    else await axios.post(hook.url, { subject: 'Test Statisfaction', text: 'Ping' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Send failed' });
  }
});

// ---- Cache Stats ----
router.get('/cache/stats', requireAdmin, async (_req, res) => {
  if (!isRedisAvailable()) {
    return res.json({ connected: false, message: 'Redis non disponible' });
  }
  const stats = await getCacheStats();
  res.json(stats);
});

router.post('/cache/flush', requireAdmin, async (_req, res) => {
  if (!isRedisAvailable()) {
    return res.status(400).json({ error: 'Redis non disponible' });
  }
  const ok = await cacheFlushAll();
  res.json({ ok, message: ok ? 'Cache vidé' : 'Erreur' });
});

router.post('/cache/reset-metrics', requireAdmin, async (_req, res) => {
  resetCacheMetrics();
  res.json({ ok: true, message: 'Métriques réinitialisées' });
});

// ---- Job Queue Stats ----
router.get('/jobs/stats', requireAdmin, async (_req, res) => {
  if (!isRedisAvailable()) {
    return res.json({ connected: false, message: 'Redis non disponible' });
  }
  
  const queueStats = await getQueueStats();
  const workerRunning = isWorkerRunning();
  const registeredTypes = getRegisteredJobTypes();
  
  res.json({
    workerRunning,
    registeredTypes,
    queues: queueStats
  });
});

// Manual job submission
router.post('/jobs/submit', requireAdmin, async (req, res) => {
  if (!isRedisAvailable()) {
    return res.status(400).json({ error: 'Redis non disponible' });
  }
  
  const { queue, type, data } = req.body as { queue: string; type: string; data?: any };
  
  if (!queue || !type) {
    return res.status(400).json({ error: 'queue et type requis' });
  }
  
  // Validate queue name
  const validQueues = Object.values(JOB_QUEUES);
  if (!validQueues.includes(queue)) {
    return res.status(400).json({ error: `Queue invalide. Queues valides: ${validQueues.join(', ')}` });
  }
  
  const jobId = await addJob(queue, type, data || {});
  if (!jobId) {
    return res.status(500).json({ error: 'Erreur lors de la création du job' });
  }
  
  res.json({ ok: true, jobId });
});

// ---- SSE Stats ----
router.get('/sse/stats', requireAdmin, async (_req, res) => {
  const { total, byUser } = getConnectedClients();
  res.json({
    totalClients: total,
    clientsByUser: Object.fromEntries(byUser)
  });
});

// ---- System Overview ----
router.get('/system/overview', requireAdmin, async (_req, res) => {
  const [cacheStats, queueStats, sseStats, userCount, streamCount] = await Promise.all([
    isRedisAvailable() ? getCacheStats() : null,
    isRedisAvailable() ? getQueueStats() : null,
    getConnectedClients(),
    prisma.user.count(),
    prisma.stream.count()
  ]);
  
  res.json({
    redis: {
      available: isRedisAvailable(),
      stats: cacheStats
    },
    queues: queueStats,
    worker: {
      running: isWorkerRunning(),
      types: getRegisteredJobTypes()
    },
    sse: {
      totalClients: sseStats.total,
      activeUsers: sseStats.byUser.size
    },
    database: {
      users: userCount,
      streams: streamCount
    }
  });
});
