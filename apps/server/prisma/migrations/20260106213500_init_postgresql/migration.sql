-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "twitchId" TEXT NOT NULL,
    "login" TEXT,
    "displayName" TEXT,
    "email" TEXT,
    "profileImageUrl" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "recapEmailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stream" (
    "id" SERIAL NOT NULL,
    "twitchStreamId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT,
    "gameName" TEXT,
    "gameId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "peakViewers" INTEGER NOT NULL DEFAULT 0,
    "avgViewers" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "uniqueChatters" INTEGER NOT NULL DEFAULT 0,
    "newFollowers" INTEGER NOT NULL DEFAULT 0,
    "newSubscribers" INTEGER NOT NULL DEFAULT 0,
    "bitsReceived" INTEGER NOT NULL DEFAULT 0,
    "raidCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewerSnapshot" (
    "id" SERIAL NOT NULL,
    "streamId" INTEGER NOT NULL,
    "viewerCount" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViewerSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" SERIAL NOT NULL,
    "streamId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "message" TEXT NOT NULL,
    "emotes" TEXT,
    "bits" INTEGER,
    "isSubscriber" BOOLEAN NOT NULL DEFAULT false,
    "isModerator" BOOLEAN NOT NULL DEFAULT false,
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowerEvent" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "streamId" INTEGER,
    "followerTwitchId" TEXT NOT NULL,
    "followerLogin" TEXT NOT NULL,
    "followerDisplayName" TEXT,
    "followedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubEvent" (
    "id" SERIAL NOT NULL,
    "streamId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "tier" TEXT NOT NULL DEFAULT '1000',
    "isGift" BOOLEAN NOT NULL DEFAULT false,
    "gifterUsername" TEXT,
    "cumulativeMonths" INTEGER NOT NULL DEFAULT 1,
    "streakMonths" INTEGER,
    "message" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaidEvent" (
    "id" SERIAL NOT NULL,
    "streamId" INTEGER,
    "userId" INTEGER NOT NULL,
    "fromBroadcasterId" TEXT NOT NULL,
    "fromBroadcasterLogin" TEXT NOT NULL,
    "fromBroadcasterName" TEXT,
    "viewerCount" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaidEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Annotation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "streamId" INTEGER,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "timestamp" TIMESTAMP(3),
    "color" TEXT DEFAULT '#3B82F6',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Annotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClipMoment" (
    "id" SERIAL NOT NULL,
    "streamId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "clipUrl" TEXT,
    "thumbnailUrl" TEXT,
    "twitchClipId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClipMoment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamSettings" (
    "id" SERIAL NOT NULL,
    "streamId" INTEGER NOT NULL,
    "autoClipEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoClipThreshold" INTEGER NOT NULL DEFAULT 50,
    "autoClipCooldown" INTEGER NOT NULL DEFAULT 300,
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "chatCommandsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compilation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "outputUrl" TEXT,
    "thumbnailUrl" TEXT,
    "totalDuration" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Compilation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompilationClip" (
    "id" SERIAL NOT NULL,
    "compilationId" INTEGER NOT NULL,
    "clipMomentId" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "startTime" INTEGER NOT NULL DEFAULT 0,
    "endTime" INTEGER,
    "transitionType" TEXT DEFAULT 'cut',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompilationClip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Giveaway" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "streamId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "keyword" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "winnerCount" INTEGER NOT NULL DEFAULT 1,
    "subscriberOnly" BOOLEAN NOT NULL DEFAULT false,
    "subscriberMultiplier" INTEGER NOT NULL DEFAULT 1,
    "minAccountAge" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Giveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiveawayEntry" (
    "id" SERIAL NOT NULL,
    "giveawayId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "isSubscriber" BOOLEAN NOT NULL DEFAULT false,
    "entries" INTEGER NOT NULL DEFAULT 1,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiveawayEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiveawayWinner" (
    "id" SERIAL NOT NULL,
    "giveawayId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "wonAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiveawayWinner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationWebhook" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'discord',
    "events" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_twitchId_key" ON "User"("twitchId");

-- CreateIndex
CREATE UNIQUE INDEX "Stream_twitchStreamId_key" ON "Stream"("twitchStreamId");

-- CreateIndex
CREATE INDEX "ViewerSnapshot_streamId_idx" ON "ViewerSnapshot"("streamId");

-- CreateIndex
CREATE INDEX "ChatMessage_streamId_idx" ON "ChatMessage"("streamId");

-- CreateIndex
CREATE INDEX "ChatMessage_username_idx" ON "ChatMessage"("username");

-- CreateIndex
CREATE INDEX "FollowerEvent_userId_idx" ON "FollowerEvent"("userId");

-- CreateIndex
CREATE INDEX "FollowerEvent_streamId_idx" ON "FollowerEvent"("streamId");

-- CreateIndex
CREATE INDEX "SubEvent_streamId_idx" ON "SubEvent"("streamId");

-- CreateIndex
CREATE INDEX "RaidEvent_streamId_idx" ON "RaidEvent"("streamId");

-- CreateIndex
CREATE INDEX "RaidEvent_userId_idx" ON "RaidEvent"("userId");

-- CreateIndex
CREATE INDEX "Annotation_userId_idx" ON "Annotation"("userId");

-- CreateIndex
CREATE INDEX "Annotation_streamId_idx" ON "Annotation"("streamId");

-- CreateIndex
CREATE INDEX "ClipMoment_streamId_idx" ON "ClipMoment"("streamId");

-- CreateIndex
CREATE INDEX "ClipMoment_userId_idx" ON "ClipMoment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StreamSettings_streamId_key" ON "StreamSettings"("streamId");

-- CreateIndex
CREATE INDEX "Compilation_userId_idx" ON "Compilation"("userId");

-- CreateIndex
CREATE INDEX "CompilationClip_compilationId_idx" ON "CompilationClip"("compilationId");

-- CreateIndex
CREATE INDEX "Giveaway_userId_idx" ON "Giveaway"("userId");

-- CreateIndex
CREATE INDEX "Giveaway_streamId_idx" ON "Giveaway"("streamId");

-- CreateIndex
CREATE INDEX "GiveawayEntry_giveawayId_idx" ON "GiveawayEntry"("giveawayId");

-- CreateIndex
CREATE UNIQUE INDEX "GiveawayEntry_giveawayId_username_key" ON "GiveawayEntry"("giveawayId", "username");

-- CreateIndex
CREATE INDEX "GiveawayWinner_giveawayId_idx" ON "GiveawayWinner"("giveawayId");

-- CreateIndex
CREATE INDEX "Goal_userId_idx" ON "Goal"("userId");

-- CreateIndex
CREATE INDEX "NotificationWebhook_userId_idx" ON "NotificationWebhook"("userId");

-- AddForeignKey
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerSnapshot" ADD CONSTRAINT "ViewerSnapshot_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowerEvent" ADD CONSTRAINT "FollowerEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowerEvent" ADD CONSTRAINT "FollowerEvent_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubEvent" ADD CONSTRAINT "SubEvent_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidEvent" ADD CONSTRAINT "RaidEvent_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidEvent" ADD CONSTRAINT "RaidEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClipMoment" ADD CONSTRAINT "ClipMoment_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClipMoment" ADD CONSTRAINT "ClipMoment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamSettings" ADD CONSTRAINT "StreamSettings_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compilation" ADD CONSTRAINT "Compilation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompilationClip" ADD CONSTRAINT "CompilationClip_compilationId_fkey" FOREIGN KEY ("compilationId") REFERENCES "Compilation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompilationClip" ADD CONSTRAINT "CompilationClip_clipMomentId_fkey" FOREIGN KEY ("clipMomentId") REFERENCES "ClipMoment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Giveaway" ADD CONSTRAINT "Giveaway_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Giveaway" ADD CONSTRAINT "Giveaway_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiveawayEntry" ADD CONSTRAINT "GiveawayEntry_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiveawayWinner" ADD CONSTRAINT "GiveawayWinner_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationWebhook" ADD CONSTRAINT "NotificationWebhook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
