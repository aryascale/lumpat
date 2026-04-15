import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { geocodeLocation } from '../src/lib/geocoding';

/**
 * Migration script to geocode existing events
 * This will add latitude/longitude coordinates to all events
 * that have a location but no coordinates yet.
 */

async function migrateEventCoordinates() {
  console.log('Starting event coordinate migration...\n');

  try {
    // Get all events without coordinates but with location
    const events = await prisma.event.findMany({
      where: {
        AND: [
          { location: { not: null } },
          { location: { not: '' } },
          {
            OR: [
              { latitude: null },
              { longitude: null }
            ]
          }
        ]
      },
      select: {
        id: true,
        name: true,
        location: true,
      }
    });

    console.log(`Found ${events.length} events to geocode\n`);

    if (events.length === 0) {
      console.log('No events need geocoding. All events already have coordinates.');
      process.exit(0);
    }

    let successCount = 0;
    let failureCount = 0;
    const skippedEvents: string[] = [];

    for (const event of events) {
      console.log(`Geocoding: ${event.name} (${event.location})`);

      const result = await geocodeLocation(event.location!);

      if (result) {
        await prisma.event.update({
          where: { id: event.id },
          data: {
            latitude: result.latitude,
            longitude: result.longitude,
          }
        });

        console.log(`✓ Success: ${result.latitude}, ${result.longitude}`);
        successCount++;
      } else {
        console.log(`✗ Failed: No coordinates found`);
        failureCount++;
        skippedEvents.push(event.name);
      }

      // Rate limiting: wait 1.1 seconds between requests
      // Nominatim allows 1 request per second
      await new Promise(resolve => setTimeout(resolve, 1100));
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`Migration complete:`);
    console.log(`  ✓ Success: ${successCount}`);
    console.log(`  ✗ Failed: ${failureCount}`);

    if (skippedEvents.length > 0) {
      console.log(`\nSkipped events:`);
      skippedEvents.forEach(name => console.log(`  - ${name}`));
      console.log(`\nNote: These events may have invalid locations or geocoding service issues.`);
      console.log(`You can manually update their coordinates in the database or update the location text.`);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateEventCoordinates();
