-- CreateTable
CREATE TABLE "Giveaway" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "prize" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "entryMethod" TEXT NOT NULL DEFAULT 'chat',
    "keyword" TEXT,
    "minFollowAge" INTEGER,
    "subscriberOnly" BOOLEAN NOT NULL DEFAULT false,
    "maxEntries" INTEGER,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "winnersCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Giveaway_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GiveawayEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "giveawayId" INTEGER NOT NULL,
    "twitchUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "isSubscriber" BOOLEAN NOT NULL DEFAULT false,
    "followAge" INTEGER,
    "entries" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GiveawayEntry_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GiveawayWinner" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "giveawayId" INTEGER NOT NULL,
    "twitchUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "position" INTEGER NOT NULL DEFAULT 1,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GiveawayWinner_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "onStreamStart" BOOLEAN NOT NULL DEFAULT false,
    "onStreamEnd" BOOLEAN NOT NULL DEFAULT true,
    "onNewFollower" BOOLEAN NOT NULL DEFAULT false,
    "onRaidReceived" BOOLEAN NOT NULL DEFAULT true,
    "onViewerMilestone" BOOLEAN NOT NULL DEFAULT true,
    "onGoalCompleted" BOOLEAN NOT NULL DEFAULT true,
    "onClipSuggestion" BOOLEAN NOT NULL DEFAULT false,
    "onGiveawayWinner" BOOLEAN NOT NULL DEFAULT true,
    "viewerMilestones" TEXT NOT NULL DEFAULT '[50,100,200,500,1000]',
    "followerMilestones" TEXT NOT NULL DEFAULT '[100,500,1000,5000,10000]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StreamAchievement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "streamId" INTEGER,
    "badge" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "earnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StreamAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Giveaway_userId_status_idx" ON "Giveaway"("userId", "status");

-- CreateIndex
CREATE INDEX "Giveaway_userId_createdAt_idx" ON "Giveaway"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GiveawayEntry_giveawayId_idx" ON "GiveawayEntry"("giveawayId");

-- CreateIndex
CREATE UNIQUE INDEX "GiveawayEntry_giveawayId_twitchUserId_key" ON "GiveawayEntry"("giveawayId", "twitchUserId");

-- CreateIndex
CREATE INDEX "GiveawayWinner_giveawayId_idx" ON "GiveawayWinner"("giveawayId");

-- CreateIndex
CREATE UNIQUE INDEX "GiveawayWinner_giveawayId_twitchUserId_key" ON "GiveawayWinner"("giveawayId", "twitchUserId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSettings_userId_key" ON "NotificationSettings"("userId");

-- CreateIndex
CREATE INDEX "StreamAchievement_userId_earnedAt_idx" ON "StreamAchievement"("userId", "earnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StreamAchievement_userId_streamId_badge_key" ON "StreamAchievement"("userId", "streamId", "badge");
