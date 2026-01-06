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
    "userId" INTEGER NOT NULL,
    "twitchStreamId" TEXT,
    "title" TEXT,
    "category" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatedClip" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "streamId" INTEGER NOT NULL,
    "twitchClipId" TEXT NOT NULL,
    "editUrl" TEXT,
    "url" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatedClip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamMetric" (
    "id" SERIAL NOT NULL,
    "streamId" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewerCount" INTEGER NOT NULL,

    CONSTRAINT "StreamMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowerEvent" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "followerId" TEXT NOT NULL,
    "followerLogin" TEXT,
    "followerName" TEXT,
    "followedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Annotation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "streamId" INTEGER,
    "at" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Annotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationWebhook" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaidEvent" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "streamId" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromViewers" INTEGER NOT NULL,
    "toViewers" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaidEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClipMoment" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "streamId" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "linkedClipId" TEXT,
    "autoClipped" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClipMoment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMetric" (
    "id" SERIAL NOT NULL,
    "streamId" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messages" INTEGER NOT NULL,

    CONSTRAINT "ChatMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClipSettings" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "autoClipEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoClipThreshold" INTEGER NOT NULL DEFAULT 80,
    "notifyOnSuggest" BOOLEAN NOT NULL DEFAULT true,
    "expirationDays" INTEGER NOT NULL DEFAULT 7,
    "maxClipsPerStream" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClipSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" SERIAL NOT NULL,
    "streamId" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "username" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isEmote" BOOLEAN NOT NULL DEFAULT false,
    "sentiment" INTEGER,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleEntry" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT,
    "twitchSegmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ABTest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "variantA" TEXT NOT NULL,
    "variantB" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ABTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compilation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "jobId" TEXT NOT NULL,
    "clipCount" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "outputPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Compilation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Giveaway" (
    "id" SERIAL NOT NULL,
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
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "winnersCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Giveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiveawayEntry" (
    "id" SERIAL NOT NULL,
    "giveawayId" INTEGER NOT NULL,
    "twitchUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "isSubscriber" BOOLEAN NOT NULL DEFAULT false,
    "followAge" INTEGER,
    "entries" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiveawayEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiveawayWinner" (
    "id" SERIAL NOT NULL,
    "giveawayId" INTEGER NOT NULL,
    "twitchUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "position" INTEGER NOT NULL DEFAULT 1,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiveawayWinner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSettings" (
    "id" SERIAL NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamAchievement" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "streamId" INTEGER,
    "badge" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_twitchId_key" ON "User"("twitchId");

-- CreateIndex
CREATE INDEX "Stream_userId_startedAt_idx" ON "Stream"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreatedClip_twitchClipId_key" ON "CreatedClip"("twitchClipId");

-- CreateIndex
CREATE INDEX "CreatedClip_userId_streamId_createdAt_idx" ON "CreatedClip"("userId", "streamId", "createdAt");

-- CreateIndex
CREATE INDEX "StreamMetric_streamId_timestamp_idx" ON "StreamMetric"("streamId", "timestamp");

-- CreateIndex
CREATE INDEX "FollowerEvent_userId_followedAt_idx" ON "FollowerEvent"("userId", "followedAt");

-- CreateIndex
CREATE INDEX "FollowerEvent_userId_createdAt_idx" ON "FollowerEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Annotation_userId_streamId_at_idx" ON "Annotation"("userId", "streamId", "at");

-- CreateIndex
CREATE INDEX "Goal_userId_kind_from_to_idx" ON "Goal"("userId", "kind", "from", "to");

-- CreateIndex
CREATE INDEX "NotificationWebhook_userId_kind_idx" ON "NotificationWebhook"("userId", "kind");

-- CreateIndex
CREATE INDEX "RaidEvent_userId_streamId_at_idx" ON "RaidEvent"("userId", "streamId", "at");

-- CreateIndex
CREATE INDEX "ClipMoment_userId_streamId_at_idx" ON "ClipMoment"("userId", "streamId", "at");

-- CreateIndex
CREATE INDEX "ClipMoment_userId_status_idx" ON "ClipMoment"("userId", "status");

-- CreateIndex
CREATE INDEX "ClipMoment_expiresAt_idx" ON "ClipMoment"("expiresAt");

-- CreateIndex
CREATE INDEX "ChatMetric_streamId_timestamp_idx" ON "ChatMetric"("streamId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ClipSettings_userId_key" ON "ClipSettings"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_streamId_timestamp_idx" ON "ChatMessage"("streamId", "timestamp");

-- CreateIndex
CREATE INDEX "ChatMessage_streamId_content_idx" ON "ChatMessage"("streamId", "content");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleEntry_twitchSegmentId_key" ON "ScheduleEntry"("twitchSegmentId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_userId_start_end_idx" ON "ScheduleEntry"("userId", "start", "end");

-- CreateIndex
CREATE INDEX "ABTest_userId_idx" ON "ABTest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Compilation_jobId_key" ON "Compilation"("jobId");

-- CreateIndex
CREATE INDEX "Compilation_userId_createdAt_idx" ON "Compilation"("userId", "createdAt");

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

-- AddForeignKey
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatedClip" ADD CONSTRAINT "CreatedClip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatedClip" ADD CONSTRAINT "CreatedClip_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamMetric" ADD CONSTRAINT "StreamMetric_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowerEvent" ADD CONSTRAINT "FollowerEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationWebhook" ADD CONSTRAINT "NotificationWebhook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidEvent" ADD CONSTRAINT "RaidEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidEvent" ADD CONSTRAINT "RaidEvent_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClipMoment" ADD CONSTRAINT "ClipMoment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClipMoment" ADD CONSTRAINT "ClipMoment_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMetric" ADD CONSTRAINT "ChatMetric_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClipSettings" ADD CONSTRAINT "ClipSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ABTest" ADD CONSTRAINT "ABTest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compilation" ADD CONSTRAINT "Compilation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Giveaway" ADD CONSTRAINT "Giveaway_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiveawayEntry" ADD CONSTRAINT "GiveawayEntry_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiveawayWinner" ADD CONSTRAINT "GiveawayWinner_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamAchievement" ADD CONSTRAINT "StreamAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
