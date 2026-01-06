/**
 * Goal Tracker - Objectifs personnalisés pour streamers
 * Suivi de progression avec notifications et badges
 */

import { prisma } from './prisma';
import { sendNotification, buildGoalCompletedNotification } from './notifications';

// ================================================
// Types
// ================================================

export type GoalKind = 
  | 'followers'      // Total followers to reach
  | 'avgViewers'     // Average viewers per stream
  | 'peakViewers'    // Peak viewers in a stream
  | 'streamHours'    // Total hours streamed
  | 'streamCount'    // Number of streams
  | 'newFollowers'   // New followers during period
  | 'chatMessages';  // Total chat messages

export interface CreateGoalInput {
  kind: GoalKind;
  target: number;
  from: Date;
  to: Date;
  title?: string;
  description?: string;
}

export interface GoalWithProgress {
  id: number;
  kind: string;
  target: number;
  from: Date;
  to: Date;
  title: string | null;
  description: string | null;
  createdAt: Date;
  current: number;
  progress: number; // 0-100
  completed: boolean;
  daysRemaining: number;
  dailyRequired: number | null; // Required daily progress to reach goal
}

// ================================================
// Goal CRUD
// ================================================

/**
 * Create a new goal
 */
export async function createGoal(userId: number, input: CreateGoalInput) {
  return prisma.goal.create({
    data: {
      userId,
      kind: input.kind,
      target: input.target,
      from: input.from,
      to: input.to,
    },
  });
}

/**
 * Update a goal
 */
export async function updateGoal(userId: number, goalId: number, input: Partial<CreateGoalInput>) {
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId },
  });
  
  if (!goal) throw new Error('Goal not found');
  
  return prisma.goal.update({
    where: { id: goalId },
    data: {
      kind: input.kind,
      target: input.target,
      from: input.from,
      to: input.to,
    },
  });
}

/**
 * Delete a goal
 */
export async function deleteGoal(userId: number, goalId: number) {
  return prisma.goal.deleteMany({
    where: { id: goalId, userId },
  });
}

/**
 * Get all goals for a user with progress
 */
export async function getUserGoals(userId: number): Promise<GoalWithProgress[]> {
  const goals = await prisma.goal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  
  // Compute progress for each goal
  const goalsWithProgress: GoalWithProgress[] = [];
  
  for (const goal of goals) {
    const current = await computeGoalProgress(userId, goal.kind, goal.from, goal.to);
    const progress = Math.min(100, Math.round((current / goal.target) * 100));
    const completed = current >= goal.target;
    const daysRemaining = Math.max(0, Math.ceil((goal.to.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    const remaining = goal.target - current;
    const dailyRequired = daysRemaining > 0 && remaining > 0 ? Math.ceil(remaining / daysRemaining) : null;
    
    goalsWithProgress.push({
      id: goal.id,
      kind: goal.kind,
      target: goal.target,
      from: goal.from,
      to: goal.to,
      title: null,
      description: null,
      createdAt: goal.createdAt,
      current,
      progress,
      completed,
      daysRemaining,
      dailyRequired,
    });
  }
  
  return goalsWithProgress;
}

/**
 * Get active goals (not expired and not completed)
 */
export async function getActiveGoals(userId: number): Promise<GoalWithProgress[]> {
  const now = new Date();
  const goals = await getUserGoals(userId);
  
  return goals.filter(g => !g.completed && new Date(g.to) >= now);
}

// ================================================
// Progress Computation
// ================================================

/**
 * Compute current progress for a goal kind
 */
async function computeGoalProgress(
  userId: number,
  kind: string,
  from: Date,
  to: Date
): Promise<number> {
  switch (kind) {
    case 'followers':
      return computeFollowersProgress(userId);
    
    case 'newFollowers':
      return computeNewFollowersProgress(userId, from, to);
    
    case 'avgViewers':
      return computeAvgViewersProgress(userId, from, to);
    
    case 'peakViewers':
      return computePeakViewersProgress(userId, from, to);
    
    case 'streamHours':
      return computeStreamHoursProgress(userId, from, to);
    
    case 'streamCount':
      return computeStreamCountProgress(userId, from, to);
    
    case 'chatMessages':
      return computeChatMessagesProgress(userId, from, to);
    
    default:
      return 0;
  }
}

async function computeFollowersProgress(userId: number): Promise<number> {
  // Total follower count (approximate from events)
  const count = await prisma.followerEvent.count({
    where: { userId },
  });
  return count;
}

async function computeNewFollowersProgress(userId: number, from: Date, to: Date): Promise<number> {
  const count = await prisma.followerEvent.count({
    where: {
      userId,
      followedAt: { gte: from, lte: to },
    },
  });
  return count;
}

async function computeAvgViewersProgress(userId: number, from: Date, to: Date): Promise<number> {
  const streams = await prisma.stream.findMany({
    where: {
      userId,
      startedAt: { gte: from, lte: to },
    },
    include: { metrics: true },
  });
  
  if (streams.length === 0) return 0;
  
  let totalViewers = 0;
  let totalPoints = 0;
  
  for (const stream of streams) {
    for (const metric of stream.metrics) {
      totalViewers += metric.viewerCount;
      totalPoints++;
    }
  }
  
  return totalPoints > 0 ? Math.round(totalViewers / totalPoints) : 0;
}

async function computePeakViewersProgress(userId: number, from: Date, to: Date): Promise<number> {
  const metrics = await prisma.streamMetric.findMany({
    where: {
      stream: {
        userId,
        startedAt: { gte: from, lte: to },
      },
    },
    select: { viewerCount: true },
    orderBy: { viewerCount: 'desc' },
    take: 1,
  });
  
  return metrics[0]?.viewerCount ?? 0;
}

async function computeStreamHoursProgress(userId: number, from: Date, to: Date): Promise<number> {
  const streams = await prisma.stream.findMany({
    where: {
      userId,
      startedAt: { gte: from, lte: to },
    },
    select: { startedAt: true, endedAt: true },
  });
  
  let totalMinutes = 0;
  for (const stream of streams) {
    const end = stream.endedAt ?? new Date();
    totalMinutes += Math.round((end.getTime() - stream.startedAt.getTime()) / 60000);
  }
  
  return Math.round(totalMinutes / 60);
}

async function computeStreamCountProgress(userId: number, from: Date, to: Date): Promise<number> {
  return prisma.stream.count({
    where: {
      userId,
      startedAt: { gte: from, lte: to },
    },
  });
}

async function computeChatMessagesProgress(userId: number, from: Date, to: Date): Promise<number> {
  const result = await prisma.chatMetric.aggregate({
    where: {
      stream: {
        userId,
        startedAt: { gte: from, lte: to },
      },
    },
    _sum: { messages: true },
  });
  
  return result._sum.messages ?? 0;
}

// ================================================
// Goal Checking & Notifications
// ================================================

/**
 * Check all goals and send notifications for completed ones
 */
export async function checkGoalsCompletion(userId: number): Promise<void> {
  const goals = await getUserGoals(userId);
  
  for (const goal of goals) {
    if (goal.completed && !isGoalNotified(userId, goal.id)) {
      // Mark as notified and send notification
      markGoalNotified(userId, goal.id);
      
      await sendNotification(userId, buildGoalCompletedNotification(
        goal.kind,
        goal.target,
        goal.current
      ));
      
      // Award achievement badge
      await awardGoalBadge(userId, goal);
    }
  }
}

// In-memory tracking of notified goals (would use Redis/DB in production)
const notifiedGoals = new Map<string, Set<number>>();

function isGoalNotified(userId: number, goalId: number): boolean {
  const key = `user-${userId}`;
  return notifiedGoals.get(key)?.has(goalId) ?? false;
}

function markGoalNotified(userId: number, goalId: number): void {
  const key = `user-${userId}`;
  if (!notifiedGoals.has(key)) {
    notifiedGoals.set(key, new Set());
  }
  notifiedGoals.get(key)!.add(goalId);
}

/**
 * Award a badge for completing a goal
 */
async function awardGoalBadge(userId: number, goal: GoalWithProgress): Promise<void> {
  const badges = getBadgesForGoal(goal);
  
  for (const badge of badges) {
    try {
      await prisma.streamAchievement.create({
        data: {
          userId,
          streamId: null, // Global achievement
          badge: badge.badge,
          title: badge.title,
          description: badge.description,
        },
      });
    } catch {
      // Badge already exists, ignore
    }
  }
}

function getBadgesForGoal(goal: GoalWithProgress): Array<{ badge: string; title: string; description: string }> {
  const badges: Array<{ badge: string; title: string; description: string }> = [];
  
  // Generic goal completion badge
  badges.push({
    badge: `goal_${goal.kind}_${goal.target}`,
    title: `Objectif ${goal.kind} atteint`,
    description: `A atteint ${goal.target} ${getKindLabel(goal.kind)}`,
  });
  
  // Special milestone badges
  if (goal.kind === 'followers') {
    if (goal.target >= 100) badges.push({ badge: 'followers_100', title: '💯 Première centaine', description: '100 followers atteints' });
    if (goal.target >= 1000) badges.push({ badge: 'followers_1k', title: '🎉 Club des 1000', description: '1000 followers atteints' });
    if (goal.target >= 10000) badges.push({ badge: 'followers_10k', title: '⭐ Rising Star', description: '10000 followers atteints' });
  }
  
  if (goal.kind === 'streamHours') {
    if (goal.target >= 100) badges.push({ badge: 'hours_100', title: '⏰ Centenaire', description: '100 heures de stream' });
    if (goal.target >= 500) badges.push({ badge: 'hours_500', title: '🏆 Marathonien', description: '500 heures de stream' });
  }
  
  if (goal.kind === 'peakViewers') {
    if (goal.target >= 100) badges.push({ badge: 'peak_100', title: '👥 Triple chiffres', description: '100 viewers simultanés' });
    if (goal.target >= 1000) badges.push({ badge: 'peak_1k', title: '🔥 Viral moment', description: '1000 viewers simultanés' });
  }
  
  return badges;
}

function getKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    followers: 'followers',
    newFollowers: 'nouveaux followers',
    avgViewers: 'viewers moyens',
    peakViewers: 'pic de viewers',
    streamHours: 'heures de stream',
    streamCount: 'streams',
    chatMessages: 'messages chat',
  };
  return labels[kind] ?? kind;
}

// ================================================
// Presets & Templates
// ================================================

export const GOAL_PRESETS = [
  { kind: 'followers', target: 100, label: '100 followers', icon: '❤️' },
  { kind: 'followers', target: 500, label: '500 followers', icon: '❤️' },
  { kind: 'followers', target: 1000, label: '1000 followers', icon: '❤️' },
  { kind: 'avgViewers', target: 10, label: '10 viewers moyens', icon: '👥' },
  { kind: 'avgViewers', target: 50, label: '50 viewers moyens', icon: '👥' },
  { kind: 'avgViewers', target: 100, label: '100 viewers moyens', icon: '👥' },
  { kind: 'streamHours', target: 10, label: '10h de stream', icon: '⏰' },
  { kind: 'streamHours', target: 50, label: '50h de stream', icon: '⏰' },
  { kind: 'streamHours', target: 100, label: '100h de stream', icon: '⏰' },
  { kind: 'streamCount', target: 10, label: '10 streams', icon: '🎬' },
  { kind: 'streamCount', target: 30, label: '30 streams', icon: '🎬' },
  { kind: 'peakViewers', target: 100, label: 'Pic à 100 viewers', icon: '📈' },
  { kind: 'peakViewers', target: 500, label: 'Pic à 500 viewers', icon: '📈' },
];

/**
 * Get goal presets with current progress
 */
export async function getGoalPresetsWithProgress(userId: number) {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const presetsWithProgress = [];
  
  for (const preset of GOAL_PRESETS) {
    const current = await computeGoalProgress(userId, preset.kind, monthAgo, now);
    const progress = Math.min(100, Math.round((current / preset.target) * 100));
    
    presetsWithProgress.push({
      ...preset,
      current,
      progress,
      completed: current >= preset.target,
    });
  }
  
  return presetsWithProgress;
}

// ================================================
// Achievements
// ================================================

/**
 * Get all achievements for a user
 */
export async function getUserAchievements(userId: number) {
  return prisma.streamAchievement.findMany({
    where: { userId },
    orderBy: { earnedAt: 'desc' },
  });
}

/**
 * Check and award stream-specific achievements
 */
export async function checkStreamAchievements(userId: number, streamId: number): Promise<void> {
  const stream = await prisma.stream.findUnique({
    where: { id: streamId },
    include: { metrics: true },
  });
  
  if (!stream) return;
  
  const peakViewers = stream.metrics.reduce((max, m) => Math.max(max, m.viewerCount), 0);
  const avgViewers = stream.metrics.length > 0 
    ? Math.round(stream.metrics.reduce((sum, m) => sum + m.viewerCount, 0) / stream.metrics.length)
    : 0;
  const durationHours = stream.endedAt 
    ? (stream.endedAt.getTime() - stream.startedAt.getTime()) / (1000 * 60 * 60)
    : 0;
  
  const achievements: Array<{ badge: string; title: string; description: string }> = [];
  
  // Peak viewer achievements
  if (peakViewers >= 50) achievements.push({ badge: 'stream_peak_50', title: '👀 Petit public', description: '50+ viewers simultanés' });
  if (peakViewers >= 100) achievements.push({ badge: 'stream_peak_100', title: '👥 Foule', description: '100+ viewers simultanés' });
  if (peakViewers >= 500) achievements.push({ badge: 'stream_peak_500', title: '🔥 En feu', description: '500+ viewers simultanés' });
  
  // Duration achievements
  if (durationHours >= 4) achievements.push({ badge: 'stream_long_4h', title: '⏱️ Long stream', description: 'Stream de 4h+' });
  if (durationHours >= 8) achievements.push({ badge: 'stream_marathon_8h', title: '🏃 Marathon', description: 'Stream de 8h+' });
  if (durationHours >= 12) achievements.push({ badge: 'stream_ultra_12h', title: '🦸 Ultra marathonien', description: 'Stream de 12h+' });
  
  // Save achievements
  for (const achievement of achievements) {
    try {
      await prisma.streamAchievement.create({
        data: {
          userId,
          streamId,
          badge: achievement.badge,
          title: achievement.title,
          description: achievement.description,
        },
      });
    } catch {
      // Already exists, ignore
    }
  }
}
