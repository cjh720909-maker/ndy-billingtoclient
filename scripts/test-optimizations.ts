import { getDailySettlements, getEmergencyShipments, getMonthlyBillingSummary } from '../src/actions/billing';
import { getDailySettlements as getDaily } from '../src/actions/settlements';

async function main() {
  console.log('Testing getting daily settlements...');
  console.time('daily');
  const daily = await getDaily({ startDate: '2025-01-26', endDate: '2025-02-25', type: 'daily' });
  console.timeEnd('daily');
  console.log(`Success: ${daily.success}, items: ${daily.data?.length}`);

  console.log('\nTesting getting GS settlements...');
  console.time('gs');
  const gs = await getDaily({ startDate: '2025-01-26', endDate: '2025-02-25', type: 'gs' });
  console.timeEnd('gs');
  console.log(`Success: ${gs.success}, items: ${gs.data?.length}`);

  console.log('\nTesting emergency shipments...');
  console.time('emergency');
  const emergency = await getEmergencyShipments({ startDate: '2025-01-26', endDate: '2025-02-25' });
  console.timeEnd('emergency');
  console.log(`Success: ${emergency.success}, items: ${emergency.data?.length}`);

  console.log('\nTesting monthly summary...');
  console.time('summary');
  const summary = await getMonthlyBillingSummary({ startDate: '2025-01-26', endDate: '2025-02-25' });
  console.timeEnd('summary');
  console.log(`Success: ${summary.success}, items: ${summary.data?.length}`);
  
  process.exit(0);
}

main().catch(console.error);
