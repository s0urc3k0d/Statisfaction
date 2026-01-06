import axios from 'axios';
// Note: la création d'abonnements EventSub (transport webhook) doit se faire avec un App Access Token.

let cachedAppToken: { token: string; exp: number } | null = null;
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelay = 500): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e: any) {
      lastErr = e;
      const status = e?.response?.status;
      // ne pas retry sur 4xx (hors 429)
      if (status && status >= 400 && status < 500 && status !== 429) break;
      const delay = Math.min(baseDelay * Math.pow(2, i), 5000);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// Cache catégories (gameId -> name), TTL 10 minutes
const gameCache = new Map<string, { name: string; exp: number }>();
export async function getGameNameCached(gameId: string): Promise<string | null> {
  if (!gameId) return null;
  const now = Date.now();
  const hit = gameCache.get(gameId);
  if (hit && hit.exp > now) return hit.name;
  const token = await getAppAccessToken();
  const r = await withRetry(() => axios.get(`https://api.twitch.tv/helix/games?id=${encodeURIComponent(gameId)}`, {
    headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${token}` },
  }));
  const name = r.data?.data?.[0]?.name as string | undefined;
  if (name) gameCache.set(gameId, { name, exp: now + 10 * 60 * 1000 });
  return name ?? null;
}

export async function getAppAccessToken(): Promise<string> {
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    throw new Error('Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET');
  }
  // cache basique 50 minutes
  const now = Date.now();
  if (cachedAppToken && cachedAppToken.exp > now + 60_000) return cachedAppToken.token;
  const params = new URLSearchParams();
  params.set('client_id', process.env.TWITCH_CLIENT_ID);
  params.set('client_secret', process.env.TWITCH_CLIENT_SECRET);
  params.set('grant_type', 'client_credentials');
  const resp = await withRetry(() => axios.post('https://id.twitch.tv/oauth2/token', params, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }));
  const token = resp.data.access_token as string;
  const expiresIn = Number(resp.data.expires_in || 3600);
  cachedAppToken = { token, exp: now + (expiresIn - 300) * 1000 };
  return token;
}

export async function getStreamDetails(twitchUserId: string, token: string) {
  const r = await withRetry(() => axios.get(`https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(twitchUserId)}`, {
    headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${token}` },
  }));
  const data = r.data?.data?.[0];
  if (!data) return null;
  let category: string | null = (data.game_name as string) || null;
  if (!category && data.game_id) {
    try { category = await getGameNameCached(String(data.game_id)); } catch {}
  }
  return {
    twitchStreamId: data.id as string,
    title: (data.title as string) || null,
    category,
    startedAt: new Date(data.started_at),
  };
}

// Souscrire EventSub avec App Access Token (pour stream.online/offline et channel.follow v2)
export async function subscribeEventSub(type: string, version: string, condition: Record<string, string>, callback: string, secret: string) {
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) return;
  const payloadCondition = { ...condition } as Record<string, string>;
  // channel.follow v2 requires moderator_user_id = broadcaster_user_id
  if (type === 'channel.follow' && version === '2') {
    if (!payloadCondition.moderator_user_id && payloadCondition.broadcaster_user_id) {
      payloadCondition.moderator_user_id = payloadCondition.broadcaster_user_id;
    }
  }
  const bearer = await getAppAccessToken();
  await withRetry(() => axios.post('https://api.twitch.tv/helix/eventsub/subscriptions', {
    type,
    version,
    condition: payloadCondition,
    transport: { method: 'webhook', callback, secret },
  }, { headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' } }));
}

// Souscrire EventSub avec User Access Token (REQUIS pour channel.follow v2)
// Le user doit avoir le scope moderator:read:followers
export async function subscribeEventSubWithUserToken(
  type: string, 
  version: string, 
  condition: Record<string, string>, 
  callback: string, 
  secret: string,
  userAccessToken: string
) {
  if (!process.env.TWITCH_CLIENT_ID) return;
  const payloadCondition = { ...condition } as Record<string, string>;
  // channel.follow v2: impose moderator_user_id = broadcaster_user_id
  if (type === 'channel.follow' && version === '2') {
    if (!payloadCondition.moderator_user_id && payloadCondition.broadcaster_user_id) {
      payloadCondition.moderator_user_id = payloadCondition.broadcaster_user_id;
    }
  }
  await withRetry(() => axios.post('https://api.twitch.tv/helix/eventsub/subscriptions', {
    type,
    version,
    condition: payloadCondition,
    transport: { method: 'webhook', callback, secret },
  }, { headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID, Authorization: `Bearer ${userAccessToken}`, 'Content-Type': 'application/json' } }));
}

export async function listEventSubs() {
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) return { data: [] };
  const appToken = await getAppAccessToken();
  const r = await withRetry(() => axios.get('https://api.twitch.tv/helix/eventsub/subscriptions', {
    headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID, Authorization: `Bearer ${appToken}` },
  }));
  return r.data as { total?: number; data: any[] };
}

export async function deleteEventSub(id: string) {
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) return;
  const appToken = await getAppAccessToken();
  await withRetry(() => axios.delete(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${encodeURIComponent(id)}`, {
    headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID, Authorization: `Bearer ${appToken}` },
  }));
}

// ---- Helix: Schedule ----
export async function findGameIdByName(name: string, token: string): Promise<string | null> {
  if (!name) return null;
  const r = await withRetry(() => axios.get(`https://api.twitch.tv/helix/games?name=${encodeURIComponent(name)}`, {
    headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${token}` },
  }));
  return r.data?.data?.[0]?.id ?? null;
}

export async function createScheduleSegment(opts: {
  broadcasterId: string;
  token: string; // user access token with channel:manage:schedule
  startTime: string; // RFC3339
  durationMinutes: number;
  title: string;
  categoryId?: string | null;
  timezone?: string | null;
}) {
  const params = new URLSearchParams();
  params.set('broadcaster_id', opts.broadcasterId);
  params.set('start_time', opts.startTime);
  params.set('duration', String(opts.durationMinutes));
  params.set('title', opts.title || '');
  if (opts.categoryId) params.set('category_id', opts.categoryId);
  if (opts.timezone) params.set('timezone', opts.timezone);
  const r = await withRetry(() => axios.post('https://api.twitch.tv/helix/schedule/segment', params, {
    headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${opts.token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
  }));
  // Twitch renvoie le segment créé dans data.segments[0]
  const seg = r.data?.data?.segments?.[0];
  return seg?.id as string | undefined;
}

export async function updateScheduleSegment(opts: {
  broadcasterId: string;
  token: string;
  segmentId: string;
  startTime?: string;
  durationMinutes?: number;
  title?: string;
  categoryId?: string | null;
  timezone?: string | null;
}) {
  const params = new URLSearchParams();
  params.set('broadcaster_id', opts.broadcasterId);
  params.set('id', opts.segmentId);
  if (opts.startTime) params.set('start_time', opts.startTime);
  if (typeof opts.durationMinutes === 'number') params.set('duration', String(opts.durationMinutes));
  if (typeof opts.title === 'string') params.set('title', opts.title);
  if (typeof opts.categoryId !== 'undefined' && opts.categoryId) params.set('category_id', opts.categoryId);
  if (opts.timezone) params.set('timezone', opts.timezone);
  await withRetry(() => axios.patch('https://api.twitch.tv/helix/schedule/segment', params, {
    headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${opts.token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
  }));
}

export async function deleteScheduleSegment(opts: { broadcasterId: string; token: string; segmentId: string }) {
  const url = `https://api.twitch.tv/helix/schedule/segment?broadcaster_id=${encodeURIComponent(opts.broadcasterId)}&id=${encodeURIComponent(opts.segmentId)}`;
  await withRetry(() => axios.delete(url, { headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${opts.token}` } }));
}
