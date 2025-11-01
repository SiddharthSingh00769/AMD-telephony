/*
  Warnings:

  - A unique constraint covering the columns `[jambonzCallId]` on the table `Call` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "direction" TEXT NOT NULL DEFAULT 'outbound',
ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "jambonzCallId" TEXT,
ADD COLUMN     "recordingUrl" TEXT;

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" TEXT NOT NULL,
    "testNumber" TEXT NOT NULL,
    "expectedResult" TEXT NOT NULL,
    "amdStrategy" TEXT NOT NULL,
    "actualResult" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "latency" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION,
    "correct" BOOLEAN NOT NULL,
    "callId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "TestResult_amdStrategy_idx" ON "TestResult"("amdStrategy");

-- CreateIndex
CREATE INDEX "TestResult_testNumber_idx" ON "TestResult"("testNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Call_jambonzCallId_key" ON "Call"("jambonzCallId");

-- CreateIndex
CREATE INDEX "Call_amdResult_idx" ON "Call"("amdResult");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
