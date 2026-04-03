import { getRecent } from '../src/logger.js';

const rows = getRecent(20);

if (rows.length === 0) {
  console.log('\nNo intake records found.\n');
  process.exit(0);
}

console.log(`\n=== Recent Intakes (${rows.length}) ===\n`);

const colWidths = { id: 14, type: 12, urgency: 8, venture: 14, dest: 18, ms: 6, email: 28 };

const header = [
  'ID'.padEnd(colWidths.id),
  'Type'.padEnd(colWidths.type),
  'Urgency'.padEnd(colWidths.urgency),
  'Venture'.padEnd(colWidths.venture),
  'Route'.padEnd(colWidths.dest),
  'Ms'.padStart(colWidths.ms),
  '  Sender',
].join(' ');

console.log(header);
console.log('-'.repeat(header.length + 10));

for (const row of rows) {
  const line = [
    (row.id || '').padEnd(colWidths.id),
    (row.type || '').padEnd(colWidths.type),
    (row.urgency || '').padEnd(colWidths.urgency),
    (row.venture || '').padEnd(colWidths.venture),
    (row.route_destination || '').padEnd(colWidths.dest),
    String(row.processing_ms || 0).padStart(colWidths.ms),
    '  ' + (row.sender_email || ''),
  ].join(' ');
  console.log(line);
}

console.log(`\n=== ${rows.length} records ===\n`);
