-- CreateTable
CREATE TABLE "Compilation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "jobId" TEXT NOT NULL,
    "clipCount" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "outputPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "title" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Compilation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Compilation_jobId_key" ON "Compilation"("jobId");

-- CreateIndex
CREATE INDEX "Compilation_userId_createdAt_idx" ON "Compilation"("userId", "createdAt");
