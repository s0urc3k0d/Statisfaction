/**
 * Notification Service - Discord Webhooks & Push Notifications
 * Sends notifications to configured webhooks based on user preferences
 */

import { prisma } from './prisma';

// ================================================
// Types
// ================================================

export type NotificationType = 
  | 'stream_start'
  | 'stream_end'
  | 'new_follower'
  | 'raid_received'
  | 'viewer_milestone'
  | 'goal_completed'
  | 'clip_suggestion'
  | 'giveaway_winner';

export type NotificationPayload = {
  type: NotificationType;
  title: string;
  message: string;
  color?: number; // Discord embed color
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  thumbnail?: string;
  footer?: string;
  timestamp?: Date;
};

// Discord colors
const COLORS = {
  success: 0x10b981, // emerald
  info: 0x6366f1, // indigo
  warning: 0xf59e0b, // amber
  error: 0xef4444, // red
  special: 0x8b5cf6, // violet
  brand: 0xa855f7, // purple (Twitch)
};

// ================================================
// Core Functions
// ================================================

/**
 * Get notification settings for a user, creating defaults if needed
 */
export async function getNotificationSettings(userId: number) {
  let settings = await prisma.notificationSettings.findUnique({ where: { userId } });
  
  if (!settings) {
    settings = await prisma.notificationSettings.create({
      data: { userId }
    });
  }
  
  return {
    ...settings,
    viewerMilestones: JSON.parse(settings.viewerMilestones) as number[],
    followerMilestones: JSON.parse(settings.followerMilestones) as number[],
  };
}

/**
 * Update notification settings
 */
export async function updateNotificationSettings(
  userId: number, 
  data: Partial<{
    onStreamStart: boolean;
    onStreamEnd: boolean;
    onNewFollower: boolean;
    onRaidReceived: boolean;
    onViewerMilestone: boolean;
    onGoalCompleted: boolean;
    onClipSuggestion: boolean;
    onGiveawayWinner: boolean;
    viewerMilestones: number[];
    followerMilestones: number[];
  }>
) {
  const updateData: any = { ...data };
  if (data.viewerMilestones) {
    updateData.viewerMilestones = JSON.stringify(data.viewerMilestones);
  }
  if (data.followerMilestones) {
    updateData.followerMilestones = JSON.stringify(data.followerMilestones);
  }
  
  return prisma.notificationSettings.upsert({
    where: { userId },
    create: { userId, ...updateData },
    update: updateData,
  });
}

/**
 * Get all active webhooks for a user
 */
export async function getUserWebhooks(userId: number) {
  return prisma.notificationWebhook.findMany({
    where: { userId, active: true }
  });
}

/**
 * Add a new webhook
 */
export async function addWebhook(userId: number, url: string, kind: string = 'discord') {
  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new Error('Invalid webhook URL');
  }
  
  // Check if already exists
  const existing = await prisma.notificationWebhook.findFirst({
    where: { userId, url }
  });
  
  if (existing) {
    return prisma.notificationWebhook.update({
      where: { id: existing.id },
      data: { active: true }
    });
  }
  
  return prisma.notificationWebhook.create({
    data: { userId, url, kind }
  });
}

/**
 * Remove a webhook
 */
export async function removeWebhook(userId: number, webhookId: number) {
  return prisma.notificationWebhook.deleteMany({
    where: { id: webhookId, userId }
  });
}

/**
 * Test a webhook by sending a test notification
 */
export async function testWebhook(url: string): Promise<boolean> {
  try {
    const payload = buildDiscordPayload({
      type: 'stream_start',
      title: '🧪 Test de notification',
      message: 'Votre webhook Discord est correctement configuré !',
      color: COLORS.success,
      footer: 'Statisfaction • Test',
      timestamp: new Date(),
    });
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Send notification to all user's webhooks if the event type is enabled
 */
export async function sendNotification(userId: number, payload: NotificationPayload) {
  const settings = await getNotificationSettings(userId);
  
  // Check if this notification type is enabled
  const typeToSetting: Record<NotificationType, keyof typeof settings> = {
    stream_start: 'onStreamStart',
    stream_end: 'onStreamEnd',
    new_follower: 'onNewFollower',
    raid_received: 'onRaidReceived',
    viewer_milestone: 'onViewerMilestone',
    goal_completed: 'onGoalCompleted',
    clip_suggestion: 'onClipSuggestion',
    giveaway_winner: 'onGiveawayWinner',
  };
  
  const settingKey = typeToSetting[payload.type];
  if (!settings[settingKey]) {
    return { sent: false, reason: 'notification_disabled' };
  }
  
  // Get active webhooks
  const webhooks = await getUserWebhooks(userId);
  if (webhooks.length === 0) {
    return { sent: false, reason: 'no_webhooks' };
  }
  
  // Send to all webhooks
  const results = await Promise.allSettled(
    webhooks.map(async (webhook) => {
      if (webhook.kind === 'discord') {
        return sendDiscordWebhook(webhook.url, payload);
      }
      // Generic webhook (JSON POST)
      return sendGenericWebhook(webhook.url, payload);
    })
  );
  
  const successful = results.filter(r => r.status === 'fulfilled').length;
  return { sent: true, webhooksTriggered: successful, total: webhooks.length };
}

// ================================================
// Discord Webhook
// ================================================

function buildDiscordPayload(payload: NotificationPayload) {
  return {
    embeds: [{
      title: payload.title,
      description: payload.message,
      color: payload.color ?? COLORS.info,
      fields: payload.fields?.map(f => ({
        name: f.name,
        value: f.value,
        inline: f.inline ?? true,
      })),
      thumbnail: payload.thumbnail ? { url: payload.thumbnail } : undefined,
      footer: payload.footer ? { text: payload.footer } : { text: 'Statisfaction' },
      timestamp: payload.timestamp?.toISOString() ?? new Date().toISOString(),
    }],
  };
}

async function sendDiscordWebhook(url: string, payload: NotificationPayload): Promise<boolean> {
  const discordPayload = buildDiscordPayload(payload);
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(discordPayload),
  });
  
  if (!res.ok) {
    console.error(`Discord webhook failed: ${res.status}`);
    return false;
  }
  
  return true;
}

async function sendGenericWebhook(url: string, payload: NotificationPayload): Promise<boolean> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: payload.type,
      title: payload.title,
      message: payload.message,
      fields: payload.fields,
      timestamp: payload.timestamp?.toISOString() ?? new Date().toISOString(),
    }),
  });
  
  return res.ok;
}

// ================================================
// Notification Builders
// ================================================

export function buildStreamStartNotification(streamTitle: string, category: string | null, thumbnail?: string): NotificationPayload {
  return {
    type: 'stream_start',
    title: '🔴 Stream démarré !',
    message: streamTitle || 'Nouveau stream',
    color: COLORS.brand,
    fields: category ? [{ name: 'Catégorie', value: category, inline: true }] : undefined,
    thumbnail,
    timestamp: new Date(),
  };
}

export function buildStreamEndNotification(
  streamTitle: string,
  durationMinutes: number,
  avgViewers: number,
  peakViewers: number,
  newFollowers: number
): NotificationPayload {
  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  const durationStr = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  
  return {
    type: 'stream_end',
    title: '⏹️ Stream terminé',
    message: streamTitle || 'Stream sans titre',
    color: COLORS.info,
    fields: [
      { name: '⏱️ Durée', value: durationStr, inline: true },
      { name: '👥 Moyenne', value: String(avgViewers), inline: true },
      { name: '📈 Pic', value: String(peakViewers), inline: true },
      { name: '❤️ Followers', value: `+${newFollowers}`, inline: true },
    ],
    timestamp: new Date(),
  };
}

export function buildNewFollowerNotification(followerName: string, totalFollowers?: number): NotificationPayload {
  return {
    type: 'new_follower',
    title: '❤️ Nouveau follower !',
    message: `**${followerName}** t'a follow`,
    color: COLORS.success,
    fields: totalFollowers ? [{ name: 'Total followers', value: String(totalFollowers), inline: true }] : undefined,
    timestamp: new Date(),
  };
}

export function buildRaidNotification(raiderName: string, viewerCount: number): NotificationPayload {
  return {
    type: 'raid_received',
    title: '🚀 Raid reçu !',
    message: `**${raiderName}** t'envoie ${viewerCount} viewers !`,
    color: COLORS.special,
    fields: [
      { name: 'Viewers', value: String(viewerCount), inline: true },
    ],
    timestamp: new Date(),
  };
}

export function buildViewerMilestoneNotification(currentViewers: number, milestone: number): NotificationPayload {
  return {
    type: 'viewer_milestone',
    title: '🎉 Milestone atteint !',
    message: `Tu as dépassé **${milestone} viewers** !`,
    color: COLORS.special,
    fields: [
      { name: 'Viewers actuels', value: String(currentViewers), inline: true },
    ],
    timestamp: new Date(),
  };
}

export function buildGoalCompletedNotification(goalKind: string, target: number, current: number): NotificationPayload {
  const kindLabels: Record<string, string> = {
    followers: 'Followers',
    avgViewers: 'Viewers moyens',
    duration: 'Heures streamées',
    streams: 'Streams',
  };
  
  return {
    type: 'goal_completed',
    title: '🏆 Objectif atteint !',
    message: `Tu as atteint ton objectif de **${target} ${kindLabels[goalKind] || goalKind}** !`,
    color: COLORS.success,
    fields: [
      { name: 'Objectif', value: String(target), inline: true },
      { name: 'Actuel', value: String(current), inline: true },
    ],
    timestamp: new Date(),
  };
}

export function buildClipSuggestionNotification(streamTitle: string, score: number, timestamp: Date): NotificationPayload {
  return {
    type: 'clip_suggestion',
    title: '🎬 Moment à clipper détecté !',
    message: `Un moment fort a été détecté dans ton stream`,
    color: COLORS.warning,
    fields: [
      { name: 'Stream', value: streamTitle || 'Sans titre', inline: true },
      { name: 'Score', value: String(score), inline: true },
      { name: 'Timestamp', value: timestamp.toLocaleTimeString(), inline: true },
    ],
    timestamp: new Date(),
  };
}

export function buildGiveawayWinnerNotification(giveawayTitle: string, winnerName: string, prize: string): NotificationPayload {
  return {
    type: 'giveaway_winner',
    title: '🎲 Gagnant du giveaway !',
    message: `**${winnerName}** a gagné "${giveawayTitle}"`,
    color: COLORS.success,
    fields: [
      { name: 'Lot', value: prize, inline: true },
      { name: 'Gagnant', value: winnerName, inline: true },
    ],
    timestamp: new Date(),
  };
}

// ================================================
// Milestone Tracking
// ================================================

// Track which milestones have been triggered to avoid duplicates
const triggeredMilestones = new Map<string, Set<number>>();

export async function checkAndTriggerViewerMilestone(userId: number, currentViewers: number) {
  const settings = await getNotificationSettings(userId);
  if (!settings.onViewerMilestone) return;
  
  const key = `viewers-${userId}`;
  if (!triggeredMilestones.has(key)) {
    triggeredMilestones.set(key, new Set());
  }
  const triggered = triggeredMilestones.get(key)!;
  
  for (const milestone of settings.viewerMilestones) {
    if (currentViewers >= milestone && !triggered.has(milestone)) {
      triggered.add(milestone);
      await sendNotification(userId, buildViewerMilestoneNotification(currentViewers, milestone));
    }
  }
}

export function resetMilestones(userId: number) {
  triggeredMilestones.delete(`viewers-${userId}`);
  triggeredMilestones.delete(`followers-${userId}`);
}
