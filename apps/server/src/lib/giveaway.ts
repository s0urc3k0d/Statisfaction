/**
 * Giveaway Manager - Tirages au sort pour streamers
 * Gère la création, participation et tirage des giveaways
 */

import { prisma } from './prisma';
import { sendNotification, buildGiveawayWinnerNotification } from './notifications';

// ================================================
// Types
// ================================================

export type GiveawayStatus = 'draft' | 'active' | 'ended' | 'cancelled';
export type EntryMethod = 'chat' | 'followers' | 'manual';

export interface CreateGiveawayInput {
  title: string;
  description?: string;
  prize: string;
  entryMethod: EntryMethod;
  keyword?: string;
  minFollowAge?: number;
  subscriberOnly?: boolean;
  maxEntries?: number;
  winnersCount?: number;
}

export interface GiveawayWithStats {
  id: number;
  title: string;
  description: string | null;
  prize: string;
  status: string;
  entryMethod: string;
  keyword: string | null;
  minFollowAge: number | null;
  subscriberOnly: boolean;
  maxEntries: number | null;
  winnersCount: number;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  entriesCount: number;
  uniqueParticipants: number;
  winners: Array<{
    username: string;
    displayName: string | null;
    position: number;
    claimed: boolean;
  }>;
}

// ================================================
// Giveaway CRUD
// ================================================

/**
 * Create a new giveaway
 */
export async function createGiveaway(userId: number, input: CreateGiveawayInput) {
  return prisma.giveaway.create({
    data: {
      userId,
      title: input.title,
      description: input.description,
      prize: input.prize,
      entryMethod: input.entryMethod,
      keyword: input.keyword?.toLowerCase(),
      minFollowAge: input.minFollowAge,
      subscriberOnly: input.subscriberOnly ?? false,
      maxEntries: input.maxEntries,
      winnersCount: input.winnersCount ?? 1,
      status: 'draft',
    },
  });
}

/**
 * Update a giveaway (only if draft)
 */
export async function updateGiveaway(userId: number, giveawayId: number, input: Partial<CreateGiveawayInput>) {
  const giveaway = await prisma.giveaway.findFirst({
    where: { id: giveawayId, userId },
  });
  
  if (!giveaway) throw new Error('Giveaway not found');
  if (giveaway.status !== 'draft') throw new Error('Cannot edit active or ended giveaway');
  
  return prisma.giveaway.update({
    where: { id: giveawayId },
    data: {
      title: input.title,
      description: input.description,
      prize: input.prize,
      entryMethod: input.entryMethod,
      keyword: input.keyword?.toLowerCase(),
      minFollowAge: input.minFollowAge,
      subscriberOnly: input.subscriberOnly,
      maxEntries: input.maxEntries,
      winnersCount: input.winnersCount,
    },
  });
}

/**
 * Delete a giveaway (only if draft)
 */
export async function deleteGiveaway(userId: number, giveawayId: number) {
  const giveaway = await prisma.giveaway.findFirst({
    where: { id: giveawayId, userId },
  });
  
  if (!giveaway) throw new Error('Giveaway not found');
  if (giveaway.status !== 'draft') throw new Error('Cannot delete active or ended giveaway');
  
  return prisma.giveaway.delete({ where: { id: giveawayId } });
}

/**
 * Get all giveaways for a user
 */
export async function getUserGiveaways(userId: number): Promise<GiveawayWithStats[]> {
  const giveaways = await prisma.giveaway.findMany({
    where: { userId },
    include: {
      entries: true,
      winners: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  
  return giveaways.map(g => ({
    id: g.id,
    title: g.title,
    description: g.description,
    prize: g.prize,
    status: g.status,
    entryMethod: g.entryMethod,
    keyword: g.keyword,
    minFollowAge: g.minFollowAge,
    subscriberOnly: g.subscriberOnly,
    maxEntries: g.maxEntries,
    winnersCount: g.winnersCount,
    startedAt: g.startedAt,
    endedAt: g.endedAt,
    createdAt: g.createdAt,
    entriesCount: g.entries.reduce((sum, e) => sum + e.entries, 0),
    uniqueParticipants: g.entries.length,
    winners: g.winners.map(w => ({
      username: w.username,
      displayName: w.displayName,
      position: w.position,
      claimed: w.claimed,
    })),
  }));
}

/**
 * Get a single giveaway with full details
 */
export async function getGiveaway(userId: number, giveawayId: number): Promise<GiveawayWithStats | null> {
  const giveaway = await prisma.giveaway.findFirst({
    where: { id: giveawayId, userId },
    include: {
      entries: true,
      winners: true,
    },
  });
  
  if (!giveaway) return null;
  
  return {
    id: giveaway.id,
    title: giveaway.title,
    description: giveaway.description,
    prize: giveaway.prize,
    status: giveaway.status,
    entryMethod: giveaway.entryMethod,
    keyword: giveaway.keyword,
    minFollowAge: giveaway.minFollowAge,
    subscriberOnly: giveaway.subscriberOnly,
    maxEntries: giveaway.maxEntries,
    winnersCount: giveaway.winnersCount,
    startedAt: giveaway.startedAt,
    endedAt: giveaway.endedAt,
    createdAt: giveaway.createdAt,
    entriesCount: giveaway.entries.reduce((sum, e) => sum + e.entries, 0),
    uniqueParticipants: giveaway.entries.length,
    winners: giveaway.winners.map(w => ({
      username: w.username,
      displayName: w.displayName,
      position: w.position,
      claimed: w.claimed,
    })),
  };
}

// ================================================
// Giveaway Lifecycle
// ================================================

/**
 * Start a giveaway (change status to active)
 */
export async function startGiveaway(userId: number, giveawayId: number) {
  const giveaway = await prisma.giveaway.findFirst({
    where: { id: giveawayId, userId },
  });
  
  if (!giveaway) throw new Error('Giveaway not found');
  if (giveaway.status !== 'draft') throw new Error('Giveaway already started');
  
  return prisma.giveaway.update({
    where: { id: giveawayId },
    data: { status: 'active', startedAt: new Date() },
  });
}

/**
 * End a giveaway (change status to ended)
 */
export async function endGiveaway(userId: number, giveawayId: number) {
  const giveaway = await prisma.giveaway.findFirst({
    where: { id: giveawayId, userId },
  });
  
  if (!giveaway) throw new Error('Giveaway not found');
  if (giveaway.status !== 'active') throw new Error('Giveaway not active');
  
  return prisma.giveaway.update({
    where: { id: giveawayId },
    data: { status: 'ended', endedAt: new Date() },
  });
}

/**
 * Cancel a giveaway
 */
export async function cancelGiveaway(userId: number, giveawayId: number) {
  const giveaway = await prisma.giveaway.findFirst({
    where: { id: giveawayId, userId },
  });
  
  if (!giveaway) throw new Error('Giveaway not found');
  if (giveaway.status === 'ended') throw new Error('Cannot cancel ended giveaway');
  
  return prisma.giveaway.update({
    where: { id: giveawayId },
    data: { status: 'cancelled', endedAt: new Date() },
  });
}

// ================================================
// Entries Management
// ================================================

/**
 * Add an entry to a giveaway
 */
export async function addEntry(
  giveawayId: number,
  participant: {
    twitchUserId: string;
    username: string;
    displayName?: string;
    isSubscriber?: boolean;
    followAge?: number; // Days since follow
  },
  bonusEntries: number = 0
) {
  const giveaway = await prisma.giveaway.findUnique({
    where: { id: giveawayId },
    include: { entries: { where: { twitchUserId: participant.twitchUserId } } },
  });
  
  if (!giveaway) throw new Error('Giveaway not found');
  if (giveaway.status !== 'active') throw new Error('Giveaway not active');
  
  // Check eligibility
  if (giveaway.subscriberOnly && !participant.isSubscriber) {
    throw new Error('Giveaway is subscriber only');
  }
  
  if (giveaway.minFollowAge && participant.followAge !== undefined) {
    if (participant.followAge < giveaway.minFollowAge) {
      throw new Error(`Must be following for at least ${giveaway.minFollowAge} days`);
    }
  }
  
  // Check existing entry
  const existingEntry = giveaway.entries[0];
  
  if (existingEntry) {
    // Check max entries
    if (giveaway.maxEntries && existingEntry.entries >= giveaway.maxEntries) {
      throw new Error(`Maximum ${giveaway.maxEntries} entries per user`);
    }
    
    // Add bonus entries
    return prisma.giveawayEntry.update({
      where: { id: existingEntry.id },
      data: { entries: existingEntry.entries + 1 + bonusEntries },
    });
  }
  
  // Create new entry
  return prisma.giveawayEntry.create({
    data: {
      giveawayId,
      twitchUserId: participant.twitchUserId,
      username: participant.username,
      displayName: participant.displayName,
      isSubscriber: participant.isSubscriber ?? false,
      followAge: participant.followAge,
      entries: 1 + bonusEntries,
    },
  });
}

/**
 * Remove an entry from a giveaway
 */
export async function removeEntry(giveawayId: number, twitchUserId: string) {
  return prisma.giveawayEntry.deleteMany({
    where: { giveawayId, twitchUserId },
  });
}

/**
 * Get all entries for a giveaway
 */
export async function getEntries(giveawayId: number) {
  return prisma.giveawayEntry.findMany({
    where: { giveawayId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Add entry from chat message (keyword detection)
 */
export async function processKeywordEntry(
  userId: number,
  message: string,
  participant: {
    twitchUserId: string;
    username: string;
    displayName?: string;
    isSubscriber?: boolean;
  }
) {
  // Find active giveaway with keyword
  const activeGiveaways = await prisma.giveaway.findMany({
    where: {
      userId,
      status: 'active',
      entryMethod: 'chat',
      keyword: { not: null },
    },
  });
  
  const loweredMessage = message.toLowerCase();
  
  for (const giveaway of activeGiveaways) {
    if (giveaway.keyword && loweredMessage.includes(giveaway.keyword)) {
      try {
        await addEntry(giveaway.id, participant);
        return { success: true, giveawayId: giveaway.id, giveawayTitle: giveaway.title };
      } catch (error) {
        // Entry failed (likely already entered or ineligible)
        return { success: false, error: (error as Error).message };
      }
    }
  }
  
  return null; // No matching giveaway
}

// ================================================
// Drawing Winners
// ================================================

/**
 * Draw winners for a giveaway
 */
export async function drawWinners(userId: number, giveawayId: number): Promise<{
  winners: Array<{ username: string; displayName: string | null; position: number }>;
  totalEntries: number;
}> {
  const giveaway = await prisma.giveaway.findFirst({
    where: { id: giveawayId, userId },
    include: { entries: true, winners: true },
  });
  
  if (!giveaway) throw new Error('Giveaway not found');
  if (giveaway.status !== 'active' && giveaway.status !== 'ended') {
    throw new Error('Giveaway must be active or ended to draw');
  }
  if (giveaway.winners.length > 0) {
    throw new Error('Winners already drawn');
  }
  if (giveaway.entries.length === 0) {
    throw new Error('No entries to draw from');
  }
  
  // Build weighted pool
  const pool: Array<{ twitchUserId: string; username: string; displayName: string | null }> = [];
  for (const entry of giveaway.entries) {
    for (let i = 0; i < entry.entries; i++) {
      pool.push({
        twitchUserId: entry.twitchUserId,
        username: entry.username,
        displayName: entry.displayName,
      });
    }
  }
  
  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  
  // Pick unique winners
  const winnersCount = Math.min(giveaway.winnersCount, giveaway.entries.length);
  const selectedWinners: Array<{ twitchUserId: string; username: string; displayName: string | null }> = [];
  const seenIds = new Set<string>();
  
  for (const candidate of pool) {
    if (!seenIds.has(candidate.twitchUserId)) {
      seenIds.add(candidate.twitchUserId);
      selectedWinners.push(candidate);
      if (selectedWinners.length >= winnersCount) break;
    }
  }
  
  // Save winners
  const winnersData = selectedWinners.map((w, i) => ({
    giveawayId,
    twitchUserId: w.twitchUserId,
    username: w.username,
    displayName: w.displayName,
    position: i + 1,
  }));
  
  await prisma.giveawayWinner.createMany({ data: winnersData });
  
  // Update giveaway status
  await prisma.giveaway.update({
    where: { id: giveawayId },
    data: { status: 'ended', endedAt: new Date() },
  });
  
  // Send notifications
  for (const winner of selectedWinners) {
    await sendNotification(userId, buildGiveawayWinnerNotification(
      giveaway.title,
      winner.displayName || winner.username,
      giveaway.prize
    ));
  }
  
  return {
    winners: selectedWinners.map((w, i) => ({
      username: w.username,
      displayName: w.displayName,
      position: i + 1,
    })),
    totalEntries: pool.length,
  };
}

/**
 * Reroll a specific winner position
 */
export async function rerollWinner(userId: number, giveawayId: number, position: number) {
  const giveaway = await prisma.giveaway.findFirst({
    where: { id: giveawayId, userId },
    include: { entries: true, winners: true },
  });
  
  if (!giveaway) throw new Error('Giveaway not found');
  if (giveaway.status !== 'ended') throw new Error('Giveaway not ended');
  
  const currentWinner = giveaway.winners.find(w => w.position === position);
  if (!currentWinner) throw new Error('Winner position not found');
  
  // Get all current winner IDs to exclude
  const excludeIds = new Set(giveaway.winners.map(w => w.twitchUserId));
  
  // Build pool excluding current winners
  const pool: Array<{ twitchUserId: string; username: string; displayName: string | null }> = [];
  for (const entry of giveaway.entries) {
    if (!excludeIds.has(entry.twitchUserId)) {
      for (let i = 0; i < entry.entries; i++) {
        pool.push({
          twitchUserId: entry.twitchUserId,
          username: entry.username,
          displayName: entry.displayName,
        });
      }
    }
  }
  
  if (pool.length === 0) {
    throw new Error('No more eligible participants to draw');
  }
  
  // Pick random from pool
  const newWinner = pool[Math.floor(Math.random() * pool.length)];
  
  // Update winner
  await prisma.giveawayWinner.update({
    where: { id: currentWinner.id },
    data: {
      twitchUserId: newWinner.twitchUserId,
      username: newWinner.username,
      displayName: newWinner.displayName,
      claimed: false,
      claimedAt: null,
    },
  });
  
  // Send notification
  await sendNotification(userId, buildGiveawayWinnerNotification(
    giveaway.title,
    newWinner.displayName || newWinner.username,
    giveaway.prize
  ));
  
  return {
    username: newWinner.username,
    displayName: newWinner.displayName,
    position,
  };
}

/**
 * Mark a winner as claimed
 */
export async function markWinnerClaimed(userId: number, giveawayId: number, twitchUserId: string) {
  const giveaway = await prisma.giveaway.findFirst({
    where: { id: giveawayId, userId },
  });
  
  if (!giveaway) throw new Error('Giveaway not found');
  
  return prisma.giveawayWinner.updateMany({
    where: { giveawayId, twitchUserId },
    data: { claimed: true, claimedAt: new Date() },
  });
}

// ================================================
// Stats
// ================================================

/**
 * Get giveaway statistics for a user
 */
export async function getGiveawayStats(userId: number) {
  const giveaways = await prisma.giveaway.findMany({
    where: { userId },
    include: {
      entries: true,
      winners: true,
    },
  });
  
  const totalGiveaways = giveaways.length;
  const activeGiveaways = giveaways.filter(g => g.status === 'active').length;
  const endedGiveaways = giveaways.filter(g => g.status === 'ended').length;
  const totalParticipants = new Set(giveaways.flatMap(g => g.entries.map(e => e.twitchUserId))).size;
  const totalEntries = giveaways.reduce((sum, g) => sum + g.entries.reduce((s, e) => s + e.entries, 0), 0);
  const totalWinners = giveaways.reduce((sum, g) => sum + g.winners.length, 0);
  
  return {
    totalGiveaways,
    activeGiveaways,
    endedGiveaways,
    totalParticipants,
    totalEntries,
    totalWinners,
  };
}
