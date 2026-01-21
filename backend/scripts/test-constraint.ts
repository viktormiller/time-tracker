import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testConstraint() {
  console.log('Testing unique constraint on source + externalId...\n');

  try {
    // Insert first entry
    const entry1 = await prisma.timeEntry.create({
      data: {
        source: 'TEST',
        externalId: 'test-123',
        date: new Date('2024-01-15T10:00:00Z'),
        duration: 2.5,
        project: 'Test Project',
        description: 'First entry'
      }
    });
    console.log('✓ First entry created:', entry1.id);

    // Try to insert duplicate - should fail
    try {
      const entry2 = await prisma.timeEntry.create({
        data: {
          source: 'TEST',
          externalId: 'test-123',
          date: new Date('2024-01-16T10:00:00Z'),
          duration: 3.0,
          project: 'Test Project',
          description: 'Duplicate entry (different date)'
        }
      });
      console.log('✗ ERROR: Duplicate entry was created! Constraint not working.');
      process.exit(1);
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log('✓ Duplicate entry correctly rejected (P2002 error)');
        console.log('  Target fields:', error.meta?.target);
      } else {
        console.log('✗ Unexpected error:', error.message);
        process.exit(1);
      }
    }

    // Clean up
    await prisma.timeEntry.delete({ where: { id: entry1.id } });
    console.log('✓ Test entry cleaned up');

    console.log('\n========================================');
    console.log('CONSTRAINT TEST PASSED');
    console.log('========================================');

  } catch (error: any) {
    console.error('Test failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConstraint();
