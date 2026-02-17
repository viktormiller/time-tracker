-- CreateTable: Property
CREATE TABLE "Property" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "address" TEXT,
    "movedIn" DATE,
    "movedOut" DATE,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- Add nullable propertyId column first
ALTER TABLE "Meter" ADD COLUMN "propertyId" UUID;

-- Insert default property for existing meters
INSERT INTO "Property" ("id", "name", "updatedAt")
VALUES (gen_random_uuid(), 'Meine Wohnung', CURRENT_TIMESTAMP);

-- Assign all existing meters to the default property
UPDATE "Meter" SET "propertyId" = (SELECT "id" FROM "Property" LIMIT 1);

-- Now make propertyId NOT NULL
ALTER TABLE "Meter" ALTER COLUMN "propertyId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Meter_propertyId_idx" ON "Meter"("propertyId");

-- AddForeignKey
ALTER TABLE "Meter" ADD CONSTRAINT "Meter_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
