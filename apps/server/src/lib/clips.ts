import axios from 'axios';
import { prisma } from './prisma';
import { broadcast } from './sse';
import { config } from '../config';

const CLIENT_ID = config.twitch.clientId;

// Ensure fresh token helper (imported from twitch.ts in actual usage)
async function ensureFreshToken(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  
  // Check if token is expired
  if (user.tokenExpiresAt && new Date(user.tokenExpiresAt) < new Date()) {
    // Token refresh logic would go here - for now return as is
    // In production, this calls the refresh endpoint
  }
  return user;
}

/**
 * Get or create default clip settings for a user
 */
export async function getClipSettings(userId: number) {
  let settings = await prisma.clipSettings.findUnique({ where: { userId } });
  if (!settings) {
    settings = await prisma.clipSettings.create({
      data: {
        userId,
        autoClipEnabled: false,
        autoClipThreshold: 80,
        notifyOnSuggest: true,
        expirationDays: 7,
        maxClipsPerStream: 10,
      }
    });
  }
  return settings;
}

/**
 * Update clip settings for a user
 */
export async function updateClipSettings(userId: number, updates: {
  autoClipEnabled?: boolean;
  autoClipThreshold?: number;
  notifyOnSuggest?: boolean;
  expirationDays?: number;
  maxClipsPerStream?: number;
}) {
  // Ensure settings exist first
  await getClipSettings(userId);
  
  return prisma.clipSettings.update({
    where: { userId },
    data: updates,
  });
}

/**
 * Create a clip on Twitch and save to database
 */
export async function createClip(userId: number, streamId: number, clipMomentId?: number): Promise<{
  ok: boolean;
  clipId?: string;
  editUrl?: string;
  url?: string;
  error?: string;
}> {
  try {
    const user = await ensureFreshToken(userId);
    
    // Create clip via Twitch API
    const params = new URLSearchParams();
    params.set('broadcaster_id', user.twitchId!);
    
    const response = await axios.post(
      'https://api.twitch.tv/helix/clips',
      params,
      {
        headers: {
          'Client-Id': CLIENT_ID,
          Authorization: `Bearer ${user.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const data = response.data?.data?.[0];
    if (!data?.id) {
      return { ok: false, error: 'No clip ID returned from Twitch' };
    }
    
    // Save clip to database
    const createdClip = await prisma.createdClip.create({
      data: {
        userId,
        streamId,
        twitchClipId: data.id,
        editUrl: data.edit_url || null,
        url: null,
        confirmed: false,
      }
    });
    
    // Link to clip moment if provided
    if (clipMomentId) {
      await prisma.clipMoment.update({
        where: { id: clipMomentId },
        data: {
          status: 'clipped',
          linkedClipId: data.id,
        }
      });
    }
    
    // Try to get the public URL (may not be immediately available)
    let publicUrl: string | undefined;
    try {
      // Wait a bit for Twitch to process the clip
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const clipResponse = await axios.get(
        `https://api.twitch.tv/helix/clips?id=${encodeURIComponent(data.id)}`,
        {
          headers: {
            'Client-Id': CLIENT_ID,
            Authorization: `Bearer ${user.accessToken}`
          }
        }
      );
      
      const clipInfo = clipResponse.data?.data?.[0];
      if (clipInfo?.url) {
        publicUrl = clipInfo.url;
        await prisma.createdClip.update({
          where: { twitchClipId: data.id },
          data: { url: clipInfo.url, confirmed: true }
        });
      }
    } catch (e) {
      // Non-critical, URL can be fetched later
    }
    
    broadcast(userId, 'clip.created', {
      streamId,
      clipId: data.id,
      editUrl: data.edit_url,
      url: publicUrl,
    });
    
    return {
      ok: true,
      clipId: data.id,
      editUrl: data.edit_url,
      url: publicUrl,
    };
  } catch (e: any) {
    const message = e?.response?.data?.message || e?.message || 'Unknown error';
    console.error('Failed to create clip:', message);
    return { ok: false, error: message };
  }
}

/**
 * Auto-clip based on score threshold
 * Called from poller when a clip moment is detected
 */
export async function maybeAutoClip(userId: number, streamId: number, clipMomentId: number, score: number) {
  const settings = await getClipSettings(userId);
  
  if (!settings.autoClipEnabled) return;
  if (score < settings.autoClipThreshold) return;
  
  // Check max clips per stream limit
  const existingClips = await prisma.createdClip.count({
    where: { userId, streamId }
  });
  
  if (existingClips >= settings.maxClipsPerStream) {
    console.log(`Auto-clip skipped: max clips (${settings.maxClipsPerStream}) reached for stream ${streamId}`);
    return;
  }
  
  // Create the clip
  const result = await createClip(userId, streamId, clipMomentId);
  
  if (result.ok) {
    await prisma.clipMoment.update({
      where: { id: clipMomentId },
      data: { autoClipped: true }
    });
    
    broadcast(userId, 'clip.auto-created', {
      streamId,
      clipMomentId,
      clipId: result.clipId,
      score,
    });
  }
}

/**
 * Reject a clip moment
 */
export async function rejectClipMoment(userId: number, clipMomentId: number) {
  const moment = await prisma.clipMoment.findFirst({
    where: { id: clipMomentId, userId }
  });
  
  if (!moment) return null;
  
  return prisma.clipMoment.update({
    where: { id: clipMomentId },
    data: { status: 'rejected' }
  });
}

/**
 * Get pending clip moments for a user
 */
export async function getPendingClipMoments(userId: number, streamId?: number) {
  return prisma.clipMoment.findMany({
    where: {
      userId,
      status: 'pending',
      ...(streamId ? { streamId } : {}),
    },
    orderBy: { score: 'desc' },
    include: {
      stream: {
        select: { id: true, title: true, category: true, startedAt: true }
      }
    }
  });
}

/**
 * Get clip queue stats for a user
 */
export async function getClipQueueStats(userId: number) {
  const [pending, clipped, rejected, expired] = await Promise.all([
    prisma.clipMoment.count({ where: { userId, status: 'pending' } }),
    prisma.clipMoment.count({ where: { userId, status: 'clipped' } }),
    prisma.clipMoment.count({ where: { userId, status: 'rejected' } }),
    prisma.clipMoment.count({ where: { userId, status: 'expired' } }),
  ]);
  
  const totalClips = await prisma.createdClip.count({ where: { userId } });
  const confirmedClips = await prisma.createdClip.count({ where: { userId, confirmed: true } });
  
  return {
    moments: { pending, clipped, rejected, expired, total: pending + clipped + rejected + expired },
    clips: { total: totalClips, confirmed: confirmedClips },
  };
}

/**
 * Clean up expired clip moments
 * Run this periodically (e.g., daily via cron)
 */
export async function cleanupExpiredClipMoments() {
  const now = new Date();
  
  // Find all users with clip settings
  const allSettings = await prisma.clipSettings.findMany();
  
  let expiredCount = 0;
  
  for (const settings of allSettings) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - settings.expirationDays);
    
    const result = await prisma.clipMoment.updateMany({
      where: {
        userId: settings.userId,
        status: 'pending',
        createdAt: { lt: expirationDate },
      },
      data: { status: 'expired' }
    });
    
    expiredCount += result.count;
  }
  
  // Also handle users without settings (use default 7 days)
  const defaultExpiration = new Date();
  defaultExpiration.setDate(defaultExpiration.getDate() - 7);
  
  const defaultResult = await prisma.clipMoment.updateMany({
    where: {
      status: 'pending',
      createdAt: { lt: defaultExpiration },
      user: { clipSettings: null }
    },
    data: { status: 'expired' }
  });
  
  expiredCount += defaultResult.count;
  
  console.log(`Cleaned up ${expiredCount} expired clip moments`);
  return expiredCount;
}

/**
 * Get top moments from a stream (for compilation)
 */
export async function getTopMoments(streamId: number, limit: number = 10) {
  // Get clipped moments first, then pending ones
  const clipped = await prisma.clipMoment.findMany({
    where: { streamId, status: 'clipped' },
    orderBy: { score: 'desc' },
    take: limit,
    include: {
      stream: { select: { title: true, category: true, startedAt: true } }
    }
  });
  
  const remaining = limit - clipped.length;
  
  let pending: any[] = [];
  if (remaining > 0) {
    pending = await prisma.clipMoment.findMany({
      where: { streamId, status: 'pending' },
      orderBy: { score: 'desc' },
      take: remaining,
      include: {
        stream: { select: { title: true, category: true, startedAt: true } }
      }
    });
  }
  
  return [...clipped, ...pending];
}

/**
 * Get all clips for compilation
 */
export async function getClipsForCompilation(userId: number, streamIds?: number[]) {
  return prisma.createdClip.findMany({
    where: {
      userId,
      confirmed: true,
      url: { not: null },
      ...(streamIds ? { streamId: { in: streamIds } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      stream: { select: { id: true, title: true, category: true, startedAt: true } }
    }
  });
}

// Schedule cleanup to run daily (call this from index.ts)
let cleanupInterval: NodeJS.Timeout | null = null;

export function startClipCleanupScheduler() {
  // Run cleanup every 24 hours
  cleanupInterval = setInterval(async () => {
    try {
      await cleanupExpiredClipMoments();
    } catch (e) {
      console.error('Clip cleanup failed:', e);
    }
  }, 24 * 60 * 60 * 1000);
  
  // Also run once at startup (after a delay)
  setTimeout(() => cleanupExpiredClipMoments().catch(console.error), 60000);
}

export function stopClipCleanupScheduler() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
