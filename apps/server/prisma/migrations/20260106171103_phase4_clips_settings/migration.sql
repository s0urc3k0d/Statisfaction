-- CreateTable
CREATE TABLE "ClipSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "autoClipEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoClipThreshold" INTEGER NOT NULL DEFAULT 80,
    "notifyOnSuggest" BOOLEAN NOT NULL DEFAULT true,
    "expirationDays" INTEGER NOT NULL DEFAULT 7,
    "maxClipsPerStream" INTEGER NOT NULL DEFAULT 10,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClipSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "streamId" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "username" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isEmote" BOOLEAN NOT NULL DEFAULT false,
    "sentiment" INTEGER,
    CONSTRAINT "ChatMessage_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ClipMoment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "streamId" INTEGER NOT NULL,
    "at" DATETIME NOT NULL,
    "label" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "linkedClipId" TEXT,
    "autoClipped" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClipMoment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClipMoment_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ClipMoment" ("at", "createdAt", "id", "label", "score", "streamId", "userId") SELECT "at", "createdAt", "id", "label", "score", "streamId", "userId" FROM "ClipMoment";
DROP TABLE "ClipMoment";
ALTER TABLE "new_ClipMoment" RENAME TO "ClipMoment";
CREATE INDEX "ClipMoment_userId_streamId_at_idx" ON "ClipMoment"("userId", "streamId", "at");
CREATE INDEX "ClipMoment_userId_status_idx" ON "ClipMoment"("userId", "status");
CREATE INDEX "ClipMoment_expiresAt_idx" ON "ClipMoment"("expiresAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ClipSettings_userId_key" ON "ClipSettings"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_streamId_timestamp_idx" ON "ChatMessage"("streamId", "timestamp");

-- CreateIndex
CREATE INDEX "ChatMessage_streamId_content_idx" ON "ChatMessage"("streamId", "content");
