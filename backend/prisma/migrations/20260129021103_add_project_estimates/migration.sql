-- CreateTable
CREATE TABLE "ProjectEstimate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clientName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "estimatedHours" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ProjectEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateProject" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "estimateId" UUID NOT NULL,
    "projectName" TEXT NOT NULL,

    CONSTRAINT "EstimateProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EstimateProject_projectName_idx" ON "EstimateProject"("projectName");

-- CreateIndex
CREATE UNIQUE INDEX "EstimateProject_estimateId_projectName_key" ON "EstimateProject"("estimateId", "projectName");

-- AddForeignKey
ALTER TABLE "EstimateProject" ADD CONSTRAINT "EstimateProject_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "ProjectEstimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
