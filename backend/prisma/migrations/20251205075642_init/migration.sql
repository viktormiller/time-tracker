-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "project" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeEntry_date_idx" ON "TimeEntry"("date");
