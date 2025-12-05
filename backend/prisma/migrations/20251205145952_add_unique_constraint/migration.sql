/*
  Warnings:

  - A unique constraint covering the columns `[source,externalId]` on the table `TimeEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "TimeEntry_source_externalId_key" ON "TimeEntry"("source", "externalId");
