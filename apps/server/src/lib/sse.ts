import { Request, Response } from 'express';
import { subscribe, publish, PUBSUB_CHANNELS, isRedisAvailable } from './cache';

type Client = { res: Response };
const channels = new Map<number, Set<Client>>(); // key = userId

// Track if we've initialized Redis subscriptions
let redisSubsInitialized = false;

/**
 * Initialize Redis subscriptions for multi-instance sync
 */
function initRedisSubscriptions() {
  if (redisSubsInitialized || !isRedisAvailable()) return;
  
  // Subscribe to broadcast channel pattern
  // Note: In production, you'd want to use psubscribe for patterns
  redisSubsInitialized = true;
  console.log('✅ SSE Redis subscriptions initialized');
}

export function sseHandler(req: Request, res: Response) {
  const userId = (req.session as any).userId as number | undefined;
  if (!userId) return res.status(401).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const client: Client = { res };
  if (!channels.has(userId)) channels.set(userId, new Set());
  channels.get(userId)!.add(client);

  // Subscribe to Redis channel for this user (multi-instance sync)
  let unsubscribe: (() => void) | null = null;
  if (isRedisAvailable()) {
    unsubscribe = subscribe(PUBSUB_CHANNELS.BROADCAST(userId), (data) => {
      const payload = `event: ${data.event}\ndata: ${JSON.stringify(data.payload)}\n\n`;
      try { res.write(payload); } catch (_) {}
    });
  }

  const ping = setInterval(() => {
    try { res.write(`event: heartbeat\ndata: {}\n\n`); } catch (_) {}
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    channels.get(userId)?.delete(client);
    if (unsubscribe) unsubscribe();
  });
  
  // Initialize Redis subscriptions on first connection
  initRedisSubscriptions();
}

/**
 * Broadcast to local clients and optionally to other instances via Redis
 */
export function broadcast(userId: number, event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  
  // Send to local clients
  channels.get(userId)?.forEach(c => {
    try { c.res.write(payload); } catch (_) {}
  });
  
  // Publish to Redis for other instances (if Redis available)
  if (isRedisAvailable()) {
    publish(PUBSUB_CHANNELS.BROADCAST(userId), { event, payload: data }).catch(() => {});
  }
}

/**
 * Broadcast only to local clients (skip Redis)
 */
export function broadcastLocal(userId: number, event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  channels.get(userId)?.forEach(c => {
    try { c.res.write(payload); } catch (_) {}
  });
}

/**
 * Get number of connected clients
 */
export function getConnectedClients(): { total: number; byUser: Map<number, number> } {
  let total = 0;
  const byUser = new Map<number, number>();
  
  for (const [userId, clients] of channels) {
    const count = clients.size;
    total += count;
    byUser.set(userId, count);
  }
  
  return { total, byUser };
}
