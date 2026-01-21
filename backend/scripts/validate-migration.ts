import { PrismaClient } from '@prisma/client';

async function validateMigration() {
  const prisma = new PrismaClient();

  try {
    console.log('Starting migration validation...\n');

    // 1. Count total entries
    const totalEntries = await prisma.timeEntry.count();
    console.log(`Total entries: ${totalEntries}`);

    // Compare to expected if provided
    const expectedCount = process.env.EXPECTED_COUNT
      ? parseInt(process.env.EXPECTED_COUNT, 10)
      : null;
    if (expectedCount !== null) {
      if (totalEntries !== expectedCount) {
        throw new Error(`Count mismatch: expected ${expectedCount}, got ${totalEntries}`);
      }
      console.log(`  ✓ Count matches expected: ${expectedCount}`);
    }

    // 2. Check for null IDs (using raw query)
    const nullIdCheck = await prisma.$queryRaw<{count: bigint}[]>`
      SELECT COUNT(*) as count
      FROM "TimeEntry"
      WHERE id IS NULL
    `;
    const nullIds = Number(nullIdCheck[0]?.count || 0);
    console.log(`\nEntries with null IDs: ${nullIds}`);
    if (nullIds > 0) {
      throw new Error(`Found ${nullIds} entries with null IDs`);
    }
    console.log(`  ✓ All entries have valid IDs`);

    // 3. Check for duplicates
    const duplicates = await prisma.$queryRaw<{count: bigint}[]>`
      SELECT COUNT(*) as count FROM (
        SELECT source, "externalId"
        FROM "TimeEntry"
        WHERE "externalId" IS NOT NULL
        GROUP BY source, "externalId"
        HAVING COUNT(*) > 1
      ) as dupes
    `;
    const dupeCount = Number(duplicates[0]?.count || 0);
    console.log(`\nDuplicate source+externalId combinations: ${dupeCount}`);
    if (dupeCount > 0) {
      throw new Error(`Found ${dupeCount} duplicate entries`);
    }
    console.log(`  ✓ No duplicate entries found`);

    // 4. Sample recent entries
    const samples = await prisma.timeEntry.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' }
    });
    console.log('\nLatest entries sample:');
    samples.forEach((entry, i) => {
      console.log(`  ${i + 1}. [${entry.source}] ${entry.project} - ${entry.duration}h on ${entry.date.toISOString()}`);
    });

    // 5. Verify UUID format for IDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const invalidUuids = samples.filter(e => !uuidRegex.test(e.id));
    if (invalidUuids.length > 0) {
      console.log(`\nWarning: ${invalidUuids.length} IDs are not UUID format (may be legacy data)`);
    } else if (samples.length > 0) {
      console.log(`\n  ✓ All sampled entries have valid UUID format`);
    }

    console.log('\n========================================');
    console.log('VALIDATION PASSED');
    console.log('========================================');

    process.exit(0);
  } catch (error) {
    console.error('\n========================================');
    console.error('VALIDATION FAILED');
    console.error('========================================');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

validateMigration();
