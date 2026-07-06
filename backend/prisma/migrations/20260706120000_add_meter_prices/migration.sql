-- CreateTable
CREATE TABLE "MeterPrice" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meterId" UUID NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "validFrom" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeterPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeterPrice_meterId_validFrom_key" ON "MeterPrice"("meterId", "validFrom");

-- AddForeignKey
ALTER TABLE "MeterPrice" ADD CONSTRAINT "MeterPrice_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "Meter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
