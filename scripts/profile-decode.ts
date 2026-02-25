import iconv from 'iconv-lite';

async function main() {
  const dummySize = 300000;
  console.log(`Profiling iconv.decode on ${dummySize} records...`);
  
  // Create 300K dummy items with EUC-KR Buffers
  const dummyNameStr = '현대요트(주)부산지점_긴급';
  const dummyBuffer = iconv.encode(dummyNameStr, 'euckr');
  
  const records = Array.from({ length: dummySize }).map((_, i) => ({
    B_DATE: `2025-02-15`,
    B_C_CODE: `C${i % 100}`,
    B_C_NAME: dummyBuffer,
    B_QTY: Math.floor(Math.random() * 10) + 1,
    B_IN_QTY: 2,
    B_KG: Math.random() * 50
  }));

  console.time('Decoding all records');
  let matchCount = 0;
  
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    // 1. Decode
    const nameStr = iconv.decode(Buffer.from(row.B_C_NAME), 'euckr').trim();
    // 2. Filter
    if (nameStr.includes('긴급') || nameStr.includes('*') || nameStr.includes('★')) {
      matchCount++;
    }
  }
  
  console.timeEnd('Decoding all records');
  console.log(`Matches found: ${matchCount}`);
}

main().catch(console.error);
