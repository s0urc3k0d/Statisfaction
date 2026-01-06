import 'dotenv/config';
import Redis from 'ioredis';

// ============================================
// Redis Cache Service
// ============================================

let redis: Redis | null = null;
let redisSub: Redis | null = null; // Dedicated subscriber connection
let isConnected = false;

// Cache metrics
let cacheHits = 0;
let cacheMisses = 0;
let cacheErrors = 0;

// TTL par défaut (en secondes)
export const CACHE_TTL = {
  TWITCH_API: parseInt(process.env.CACHE_TTL_TWITCH_API || '300', 10),      // 5 min
  ANALYTICS: parseInt(process.env.CACHE_TTL_ANALYTICS || '900', 10),        // 15 min
  USER_PROFILE: parseInt(process.env.CACHE_TTL_USER_PROFILE || '600', 10),  // 10 min
  GAME_INFO: parseInt(process.env.CACHE_TTL_GAME_INFO || '3600', 10),       // 1h
  STREAMS_LIST: parseInt(process.env.CACHE_TTL_STREAMS_LIST || '60', 10),   // 1 min
  RAID_CANDIDATES: parseInt(process.env.CACHE_TTL_RAID_CANDIDATES || '120', 10), // 2 min
};

// Préfixes pour organiser les clés
export const CACHE_PREFIX = {
  TWITCH: 'twitch:',
  ANALYTICS: 'analytics:',
  USER: 'user:',
  STREAM: 'stream:',
  GAME: 'game:',
};

/**
 * Initialise la connexion Redis
 */
export function initRedis(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.log('⚠️  REDIS_URL non défini - Cache désactivé');
    return null;
  }
  
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.warn('❌ Redis: abandon après 3 tentatives');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });
    
    redis.on('connect', () => {
      isConnected = true;
      console.log('✅ Redis connecté');
    });
    
    redis.on('error', (err: Error) => {
      console.warn('⚠️  Redis erreur:', err.message);
      isConnected = false;
    });
    
    redis.on('close', () => {
      isConnected = false;
    });
    
    // Tenter la connexion
    redis.connect().catch(() => {
      console.warn('⚠️  Redis: connexion échouée, cache désactivé');
    });
    
    // Initialize subscriber connection for Pub/Sub
    initRedisSub(redisUrl);
    
    return redis;
  } catch (err) {
    console.warn('⚠️  Redis init échoué:', err);
    return null;
  }
}

/**
 * Initialize dedicated Redis subscriber connection
 */
function initRedisSub(redisUrl: string): void {
  try {
    redisSub = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });
    
    redisSub.on('error', (err: Error) => {
      console.warn('⚠️  Redis Sub erreur:', err.message);
    });
    
    console.log('✅ Redis Pub/Sub initialisé');
  } catch (err) {
    console.warn('⚠️  Redis Sub init échoué:', err);
  }
}

/**
 * Get Redis subscriber instance
 */
export function getRedisSub(): Redis | null {
  return redisSub;
}

/**
 * Retourne l'instance Redis (ou null si non disponible)
 */
export function getRedis(): Redis | null {
  return isConnected ? redis : null;
}

/**
 * Vérifie si Redis est disponible
 */
export function isRedisAvailable(): boolean {
  return isConnected && redis !== null;
}

// ============================================
// Cache Operations
// ============================================

/**
 * Récupère une valeur du cache
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isConnected || !redis) return null;
  
  try {
    const data = await redis.get(key);
    if (!data) {
      cacheMisses++;
      return null;
    }
    cacheHits++;
    return JSON.parse(data) as T;
  } catch (err) {
    cacheErrors++;
    console.warn('Cache get error:', err);
    return null;
  }
}

/**
 * Stocke une valeur dans le cache
 */
export async function cacheSet(key: string, value: any, ttlSeconds: number = CACHE_TTL.TWITCH_API): Promise<boolean> {
  if (!isConnected || !redis) return false;
  
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn('Cache set error:', err);
    return false;
  }
}

/**
 * Supprime une clé du cache
 */
export async function cacheDel(key: string): Promise<boolean> {
  if (!isConnected || !redis) return false;
  
  try {
    await redis.del(key);
    return true;
  } catch (err) {
    console.warn('Cache del error:', err);
    return false;
  }
}

/**
 * Supprime toutes les clés correspondant à un pattern
 */
export async function cacheDelPattern(pattern: string): Promise<number> {
  if (!isConnected || !redis) return 0;
  
  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    return await redis.del(...keys);
  } catch (err) {
    console.warn('Cache del pattern error:', err);
    return 0;
  }
}

/**
 * Invalide le cache d'un utilisateur
 */
export async function invalidateUserCache(userId: number): Promise<void> {
  await cacheDelPattern(`${CACHE_PREFIX.USER}${userId}:*`);
  await cacheDelPattern(`${CACHE_PREFIX.ANALYTICS}${userId}:*`);
}

/**
 * Invalide le cache d'un stream
 */
export async function invalidateStreamCache(streamId: number): Promise<void> {
  await cacheDelPattern(`${CACHE_PREFIX.STREAM}${streamId}:*`);
}

// ============================================
// Cache-through helper
// ============================================

/**
 * Pattern cache-through : récupère du cache ou exécute la fonction et met en cache
 * 
 * @example
 * const data = await cacheThrough(
 *   'twitch:streams:123',
 *   () => fetchTwitchStreams(123),
 *   CACHE_TTL.TWITCH_API
 * );
 */
export async function cacheThrough<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = CACHE_TTL.TWITCH_API
): Promise<T> {
  // 1. Tenter de récupérer du cache
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }
  
  // 2. Exécuter la fonction
  const data = await fetchFn();
  
  // 3. Mettre en cache (async, ne pas bloquer)
  cacheSet(key, data, ttlSeconds).catch(() => {});
  
  return data;
}

// ============================================
// Stats & Debug
// ============================================

export interface CacheStats {
  connected: boolean;
  keys: number;
  memory: string;
  hits: number;
  misses: number;
  errors: number;
  hitRate: number;
  uptime?: number;
}

/**
 * Retourne les stats du cache
 */
export async function getCacheStats(): Promise<CacheStats> {
  const total = cacheHits + cacheMisses;
  const hitRate = total > 0 ? Math.round((cacheHits / total) * 100) : 0;
  
  if (!isConnected || !redis) {
    return { 
      connected: false, 
      keys: 0, 
      memory: '0',
      hits: cacheHits,
      misses: cacheMisses,
      errors: cacheErrors,
      hitRate
    };
  }
  
  try {
    const info = await redis.info('memory');
    const serverInfo = await redis.info('server');
    const dbsize = await redis.dbsize();
    
    const memMatch = info.match(/used_memory_human:(\S+)/);
    const memory = memMatch ? memMatch[1] : '0';
    
    const uptimeMatch = serverInfo.match(/uptime_in_seconds:(\d+)/);
    const uptime = uptimeMatch ? parseInt(uptimeMatch[1], 10) : undefined;
    
    return {
      connected: true,
      keys: dbsize,
      memory,
      hits: cacheHits,
      misses: cacheMisses,
      errors: cacheErrors,
      hitRate,
      uptime
    };
  } catch {
    return { 
      connected: false, 
      keys: 0, 
      memory: '0',
      hits: cacheHits,
      misses: cacheMisses,
      errors: cacheErrors,
      hitRate
    };
  }
}

/**
 * Reset cache metrics
 */
export function resetCacheMetrics(): void {
  cacheHits = 0;
  cacheMisses = 0;
  cacheErrors = 0;
}

/**
 * Flush tout le cache (attention!)
 */
export async function cacheFlushAll(): Promise<boolean> {
  if (!isConnected || !redis) return false;
  
  try {
    await redis.flushdb();
    return true;
  } catch {
    return false;
  }
}

// ============================================
// Clés helpers
// ============================================

export const cacheKeys = {
  // Twitch API
  twitchUser: (twitchId: string) => `${CACHE_PREFIX.TWITCH}user:${twitchId}`,
  twitchStream: (twitchId: string) => `${CACHE_PREFIX.TWITCH}stream:${twitchId}`,
  twitchGame: (gameId: string) => `${CACHE_PREFIX.GAME}${gameId}`,
  twitchFollowings: (userId: string) => `${CACHE_PREFIX.TWITCH}followings:${userId}`,
  
  // Analytics
  analyticsSummary: (userId: number, from: string, to: string) => 
    `${CACHE_PREFIX.ANALYTICS}${userId}:summary:${from}:${to}`,
  analyticsHeatmap: (userId: number, from: string, to: string) => 
    `${CACHE_PREFIX.ANALYTICS}${userId}:heatmap:${from}:${to}`,
  analyticsConversion: (userId: number, from: string, to: string) => 
    `${CACHE_PREFIX.ANALYTICS}${userId}:conversion:${from}:${to}`,
  
  // User
  userProfile: (twitchId: string) => `${CACHE_PREFIX.USER}profile:${twitchId}`,
  userStreams: (userId: number, page: number) => `${CACHE_PREFIX.USER}${userId}:streams:${page}`,
  userGoals: (userId: number) => `${CACHE_PREFIX.USER}${userId}:goals`,
  
  // Raid
  raidCandidates: (userId: number, params: string) => 
    `${CACHE_PREFIX.USER}${userId}:raid:${params}`,
  
  // Stream
  streamRecap: (streamId: number) => `${CACHE_PREFIX.STREAM}${streamId}:recap`,
  streamMetrics: (streamId: number) => `${CACHE_PREFIX.STREAM}${streamId}:metrics`,
};

// ============================================
// Pub/Sub for Multi-Instance Sync
// ============================================

type MessageHandler = (data: any) => void;
const subscriptions = new Map<string, Set<MessageHandler>>();

/**
 * Subscribe to a Redis channel
 */
export function subscribe(channel: string, handler: MessageHandler): () => void {
  if (!redisSub) {
    console.warn('Redis Pub/Sub non disponible');
    return () => {};
  }
  
  // Add handler to subscriptions
  if (!subscriptions.has(channel)) {
    subscriptions.set(channel, new Set());
    
    // Actually subscribe to Redis channel
    redisSub.subscribe(channel).catch(err => {
      console.warn(`Erreur subscribe ${channel}:`, err);
    });
  }
  
  subscriptions.get(channel)!.add(handler);
  
  // Setup message handler if first subscription
  if (subscriptions.size === 1) {
    redisSub.on('message', (ch: string, message: string) => {
      const handlers = subscriptions.get(ch);
      if (handlers) {
        try {
          const data = JSON.parse(message);
          handlers.forEach(h => {
            try { h(data); } catch (e) { console.warn('Handler error:', e); }
          });
        } catch (e) {
          console.warn('Message parse error:', e);
        }
      }
    });
  }
  
  // Return unsubscribe function
  return () => {
    const handlers = subscriptions.get(channel);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        subscriptions.delete(channel);
        redisSub?.unsubscribe(channel).catch(() => {});
      }
    }
  };
}

/**
 * Publish to a Redis channel
 */
export async function publish(channel: string, data: any): Promise<boolean> {
  if (!isConnected || !redis) return false;
  
  try {
    await redis.publish(channel, JSON.stringify(data));
    return true;
  } catch (err) {
    console.warn('Publish error:', err);
    return false;
  }
}

// Pub/Sub channels
export const PUBSUB_CHANNELS = {
  STREAM_UPDATE: 'statisfaction:stream:update',
  VIEWER_UPDATE: 'statisfaction:viewer:update',
  CHAT_UPDATE: 'statisfaction:chat:update',
  CLIP_CREATED: 'statisfaction:clip:created',
  BROADCAST: (userId: number) => `statisfaction:broadcast:${userId}`,
};

// ============================================
// Job Queue (Simple Redis-based)
// ============================================

export const JOB_QUEUES = {
  RECAP: 'jobs:recap',
  COMPILATION: 'jobs:compilation',
  CLEANUP: 'jobs:cleanup',
};

export interface Job {
  id: string;
  type: string;
  data: any;
  status: 'pending' | 'processing' | 'done' | 'failed';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: any;
}

/**
 * Add a job to the queue
 */
export async function addJob(queue: string, type: string, data: any): Promise<string | null> {
  if (!isConnected || !redis) return null;
  
  const jobId = `job:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
  const job: Job = {
    id: jobId,
    type,
    data,
    status: 'pending',
    createdAt: Date.now()
  };
  
  try {
    // Store job details
    await redis.hset(`${queue}:${jobId}`, {
      id: jobId,
      type,
      data: JSON.stringify(data),
      status: 'pending',
      createdAt: String(Date.now())
    });
    
    // Add to queue list
    await redis.lpush(queue, jobId);
    
    return jobId;
  } catch (err) {
    console.warn('addJob error:', err);
    return null;
  }
}

/**
 * Get next job from queue
 */
export async function getNextJob(queue: string): Promise<Job | null> {
  if (!isConnected || !redis) return null;
  
  try {
    // Get job ID from queue (blocking pop with timeout)
    const jobId = await redis.rpop(queue);
    if (!jobId) return null;
    
    // Get job details
    const jobData = await redis.hgetall(`${queue}:${jobId}`);
    if (!jobData || !jobData.id) return null;
    
    // Mark as processing
    await redis.hset(`${queue}:${jobId}`, 'status', 'processing', 'startedAt', String(Date.now()));
    
    return {
      id: jobData.id,
      type: jobData.type,
      data: JSON.parse(jobData.data || '{}'),
      status: 'processing',
      createdAt: parseInt(jobData.createdAt, 10),
      startedAt: Date.now()
    };
  } catch (err) {
    console.warn('getNextJob error:', err);
    return null;
  }
}

/**
 * Complete a job
 */
export async function completeJob(queue: string, jobId: string, result?: any): Promise<boolean> {
  if (!isConnected || !redis) return false;
  
  try {
    await redis.hset(`${queue}:${jobId}`, {
      status: 'done',
      completedAt: String(Date.now()),
      result: result ? JSON.stringify(result) : ''
    });
    
    // Set expiry on completed job (keep for 24h)
    await redis.expire(`${queue}:${jobId}`, 86400);
    
    return true;
  } catch (err) {
    console.warn('completeJob error:', err);
    return false;
  }
}

/**
 * Fail a job
 */
export async function failJob(queue: string, jobId: string, error: string): Promise<boolean> {
  if (!isConnected || !redis) return false;
  
  try {
    await redis.hset(`${queue}:${jobId}`, {
      status: 'failed',
      completedAt: String(Date.now()),
      error
    });
    
    // Set expiry on failed job (keep for 24h)
    await redis.expire(`${queue}:${jobId}`, 86400);
    
    return true;
  } catch (err) {
    console.warn('failJob error:', err);
    return false;
  }
}

/**
 * Get job status
 */
export async function getJobStatus(queue: string, jobId: string): Promise<Job | null> {
  if (!isConnected || !redis) return null;
  
  try {
    const jobData = await redis.hgetall(`${queue}:${jobId}`);
    if (!jobData || !jobData.id) return null;
    
    return {
      id: jobData.id,
      type: jobData.type,
      data: JSON.parse(jobData.data || '{}'),
      status: jobData.status as Job['status'],
      createdAt: parseInt(jobData.createdAt, 10),
      startedAt: jobData.startedAt ? parseInt(jobData.startedAt, 10) : undefined,
      completedAt: jobData.completedAt ? parseInt(jobData.completedAt, 10) : undefined,
      error: jobData.error || undefined,
      result: jobData.result ? JSON.parse(jobData.result) : undefined
    };
  } catch (err) {
    console.warn('getJobStatus error:', err);
    return null;
  }
}

/**
 * Get queue length
 */
export async function getQueueLength(queue: string): Promise<number> {
  if (!isConnected || !redis) return 0;
  
  try {
    return await redis.llen(queue);
  } catch {
    return 0;
  }
}

/**
 * Get all queue stats
 */
export async function getQueueStats(): Promise<Record<string, number>> {
  const stats: Record<string, number> = {};
  
  for (const [name, queue] of Object.entries(JOB_QUEUES)) {
    stats[name] = await getQueueLength(queue);
  }
  
  return stats;
}
