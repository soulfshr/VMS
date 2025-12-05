import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// Zone boundaries extracted from Google Maps KML
const zoneBoundaries: Record<string, Array<{ lat: number; lng: number }>> = {
  'Durham 1': [
    { lat: 36.0146095, lng: -78.8667584 },
    { lat: 36.009453, lng: -78.8790231 },
    { lat: 36.0037494, lng: -78.8897008 },
    { lat: 35.9871319, lng: -78.8873321 },
    { lat: 35.9413122, lng: -78.9172851 },
    { lat: 35.8699478, lng: -78.9198304 },
    { lat: 35.8673503, lng: -78.8280807 },
    { lat: 35.8921256, lng: -78.7777091 },
    { lat: 35.9077788, lng: -78.7580091 },
    { lat: 35.9216556, lng: -78.7736409 },
    { lat: 35.9299677, lng: -78.8016385 },
    { lat: 35.9453473, lng: -78.8264187 },
    { lat: 35.9631625, lng: -78.8402949 },
  ],
  'Durham 2': [
    { lat: 36.020848, lng: -78.9875647 },
    { lat: 35.957226, lng: -79.000006 },
    { lat: 35.923362, lng: -79.005883 },
    { lat: 35.880929, lng: -79.013243 },
    { lat: 35.86323, lng: -79.016308 },
    { lat: 35.866403, lng: -78.943735 },
    { lat: 35.873023, lng: -78.9127657 },
    { lat: 35.897933, lng: -78.925647 },
    { lat: 35.928411, lng: -78.920573 },
    { lat: 35.9840578, lng: -78.8928416 },
    { lat: 36.0018328, lng: -78.9187928 },
    { lat: 35.9989808, lng: -78.9298769 },
    { lat: 35.9960675, lng: -78.9383228 },
  ],
  'Durham 3': [
    { lat: 36.239126, lng: -78.950874 },
    { lat: 36.103743, lng: -78.974386 },
    { lat: 36.0912321, lng: -78.9299983 },
    { lat: 36.0809831, lng: -78.9217348 },
    { lat: 36.0707325, lng: -78.9064364 },
    { lat: 36.051352, lng: -78.9014387 },
    { lat: 36.0321101, lng: -78.8894067 },
    { lat: 36.0014573, lng: -78.8920023 },
    { lat: 36.0634111, lng: -78.7874292 },
    { lat: 36.1391482, lng: -78.8016759 },
    { lat: 36.235811, lng: -78.802344 },
  ],
  'Durham 4': [
    { lat: 36.103743, lng: -78.974386 },
    { lat: 36.0239068, lng: -78.9886953 },
    { lat: 36.0077968, lng: -78.961631 },
    { lat: 35.9960675, lng: -78.9383228 },
    { lat: 36.0018328, lng: -78.9187928 },
    { lat: 35.9861914, lng: -78.8897069 },
    { lat: 36.0253915, lng: -78.8907345 },
    { lat: 36.0584828, lng: -78.8979457 },
    { lat: 36.0605028, lng: -78.9024977 },
    { lat: 36.070602, lng: -78.9076284 },
    { lat: 36.0932501, lng: -78.9344506 },
  ],
  'Durham 5': [
    { lat: 36.0809128, lng: -78.7620992 },
    { lat: 36.0429996, lng: -78.8184073 },
    { lat: 36.0151105, lng: -78.8656723 },
    { lat: 35.9485931, lng: -78.8310952 },
    { lat: 35.9305359, lng: -78.7999124 },
    { lat: 35.9145794, lng: -78.7566557 },
    { lat: 35.9587857, lng: -78.7125652 },
    { lat: 36.0089687, lng: -78.6948677 },
  ],
  'Wake 1': [
    { lat: 35.8493323, lng: -78.7672934 },
    { lat: 35.7631137, lng: -78.7313083 },
    { lat: 35.7142959, lng: -78.7107107 },
    { lat: 35.7444965, lng: -78.6325517 },
    { lat: 35.814261, lng: -78.6240753 },
  ],
  'Wake 2': [
    { lat: 35.814261, lng: -78.6240753 },
    { lat: 35.7444965, lng: -78.6325517 },
    { lat: 35.7272445, lng: -78.5538243 },
    { lat: 35.7732186, lng: -78.5188054 },
    { lat: 35.8213932, lng: -78.5253285 },
    { lat: 35.8665813, lng: -78.5588475 },
    { lat: 35.8406622, lng: -78.589467 },
  ],
  'Wake 3': [
    { lat: 35.7126829, lng: -78.7133688 },
    { lat: 35.6205082, lng: -78.6335549 },
    { lat: 35.659148, lng: -78.5556286 },
    { lat: 35.6959845, lng: -78.5595334 },
    { lat: 35.7272445, lng: -78.5538243 },
    { lat: 35.7406919, lng: -78.6421376 },
  ],
  'Wake 4': [
    { lat: 35.9171989, lng: -78.7401118 },
    { lat: 35.8664425, lng: -78.8237082 },
    { lat: 35.8366976, lng: -78.7177704 },
    { lat: 35.814261, lng: -78.6240753 },
    { lat: 35.8665813, lng: -78.5588475 },
    { lat: 35.9222033, lng: -78.6391805 },
  ],
  'Wake 5': [
    { lat: 35.8669897, lng: -78.9383534 },
    { lat: 35.6826245, lng: -78.9259028 },
    { lat: 35.6882187, lng: -78.8229994 },
    { lat: 35.7032237, lng: -78.710383 },
    { lat: 35.8498764, lng: -78.7687487 },
    { lat: 35.8652096, lng: -78.8507938 },
  ],
  'Wake 6': [
    { lat: 35.6826245, lng: -78.9259028 },
    { lat: 35.5855196, lng: -78.9224696 },
    { lat: 35.4681671, lng: -78.8386988 },
    { lat: 35.4357252, lng: -78.7796473 },
    { lat: 35.4871786, lng: -78.6862635 },
    { lat: 35.6201337, lng: -78.6491847 },
    { lat: 35.7018641, lng: -78.714416 },
    { lat: 35.6862885, lng: -78.8345796 },
  ],
  'Orange 1': [
    { lat: 35.9509408, lng: -79.1859313 },
    { lat: 35.8591718, lng: -79.1680785 },
    { lat: 35.8541632, lng: -79.0142699 },
    { lat: 35.9887298, lng: -79.0067168 },
  ],
  'Orange 2': [
    { lat: 36.2424769, lng: -79.2426683 },
    { lat: 36.0846037, lng: -79.2686621 },
    { lat: 35.9267193, lng: -79.3274667 },
    { lat: 35.9931313, lng: -79.003366 },
    { lat: 36.0889131, lng: -79.0122864 },
    { lat: 36.2427438, lng: -79.0350328 },
  ],
};

// Zone colors by county
const zoneColors: Record<string, string> = {
  'Durham': '#3b82f6',  // Blue
  'Wake': '#22c55e',    // Green
  'Orange': '#f59e0b',  // Amber
};

async function main() {
  console.log('Updating zone boundaries in production...\n');

  for (const [zoneName, boundaries] of Object.entries(zoneBoundaries)) {
    const zone = await prisma.zone.findUnique({
      where: { name: zoneName },
    });

    if (!zone) {
      console.log(`❌ Zone not found: ${zoneName}`);
      continue;
    }

    // Determine color based on county
    const color = zoneColors[zone.county || ''] || '#6366f1';

    await prisma.zone.update({
      where: { id: zone.id },
      data: {
        boundaries: boundaries,
        color: color,
        fillOpacity: 0.25,
        strokeWeight: 2,
      },
    });

    console.log(`✅ Updated ${zoneName} with ${boundaries.length} points (${color})`);
  }

  console.log('\nDone!');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
