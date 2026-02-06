-- CreateTable
CREATE TABLE "Meter" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "location" TEXT,
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Meter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meterId" UUID NOT NULL,
    "readingDate" DATE NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "photoPath" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeterReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Meter_type_idx" ON "Meter"("type");

-- CreateIndex
CREATE INDEX "Meter_deletedAt_idx" ON "Meter"("deletedAt");

-- CreateIndex
CREATE INDEX "MeterReading_meterId_readingDate_idx" ON "MeterReading"("meterId", "readingDate");

-- CreateIndex
CREATE UNIQUE INDEX "MeterReading_meterId_readingDate_key" ON "MeterReading"("meterId", "readingDate");

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "Meter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Monotonic validation trigger: ensures meter readings increase over time
CREATE OR REPLACE FUNCTION check_meter_reading_monotonic()
RETURNS TRIGGER AS $$
DECLARE
  prev_value FLOAT;
  next_value FLOAT;
BEGIN
  -- Find the most recent reading before this one for the same meter
  SELECT value INTO prev_value
  FROM "MeterReading"
  WHERE "meterId" = NEW."meterId"
    AND "readingDate" < NEW."readingDate"
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
  ORDER BY "readingDate" DESC
  LIMIT 1;

  -- If there's a previous reading and new value is less, reject
  IF prev_value IS NOT NULL AND NEW.value < prev_value THEN
    RAISE EXCEPTION 'Meter reading value (%) must be >= previous reading value (%)',
      NEW.value, prev_value;
  END IF;

  -- Also check that no future reading is less than this new value
  SELECT value INTO next_value
  FROM "MeterReading"
  WHERE "meterId" = NEW."meterId"
    AND "readingDate" > NEW."readingDate"
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
  ORDER BY "readingDate" ASC
  LIMIT 1;

  IF next_value IS NOT NULL AND NEW.value > next_value THEN
    RAISE EXCEPTION 'Meter reading value (%) must be <= next reading value (%)',
      NEW.value, next_value;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_monotonic_reading
  BEFORE INSERT OR UPDATE ON "MeterReading"
  FOR EACH ROW
  EXECUTE FUNCTION check_meter_reading_monotonic();
