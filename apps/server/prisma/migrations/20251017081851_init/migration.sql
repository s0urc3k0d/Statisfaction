-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "twitchId" TEXT NOT NULL,
    "login" TEXT,
    "displayName" TEXT,
    "email" TEXT,
    "profileImageUrl" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" DATETIME NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "recapEmailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Stream" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "twitchStreamId" TEXT,
    "title" TEXT,
    "category" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Stream_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreatedClip" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "streamId" INTEGER NOT NULL,
    "twitchClipId" TEXT NOT NULL,
    "editUrl" TEXT,
    "url" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreatedClip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CreatedClip_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StreamMetric" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "streamId" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewerCount" INTEGER NOT NULL,
    CONSTRAINT "StreamMetric_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FollowerEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "followerId" TEXT NOT NULL,
    "followerLogin" TEXT,
    "followerName" TEXT,
    "followedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FollowerEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Annotation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "streamId" INTEGER,
    "at" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Annotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Annotation_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "from" DATETIME NOT NULL,
    "to" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationWebhook" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationWebhook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RaidEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "streamId" INTEGER NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromViewers" INTEGER NOT NULL,
    "toViewers" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RaidEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RaidEvent_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClipMoment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "streamId" INTEGER NOT NULL,
    "at" DATETIME NOT NULL,
    "label" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClipMoment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClipMoment_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMetric" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "streamId" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messages" INTEGER NOT NULL,
    CONSTRAINT "ChatMetric_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "start" DATETIME NOT NULL,
    "end" DATETIME NOT NULL,
    "timezone" TEXT,
    "twitchSegmentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ABTest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "variantA" TEXT NOT NULL,
    "variantB" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ABTest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
CREATE INDEX "ChatMetric_streamId_timestamp_idx" ON "ChatMetric"("streamId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleEntry_twitchSegmentId_key" ON "ScheduleEntry"("twitchSegmentId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_userId_start_end_idx" ON "ScheduleEntry"("userId", "start", "end");

-- CreateIndex
CREATE INDEX "ABTest_userId_idx" ON "ABTest"("userId");
