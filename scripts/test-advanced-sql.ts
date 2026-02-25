import dbPool from '../src/lib/mysql';

async function main() {
  try {
    // Test 1: Let's check the MySQL variables for character sets and version
    console.log("Fetching MySQL Environment info...");
    const [vars]: any = await dbPool.execute("SHOW VARIABLES LIKE '%char%'");
    console.log("Charset Configs:");
    vars.forEach(v => console.log(`- ${v.Variable_name}: ${v.Value}`));
    
    const [version]: any = await dbPool.execute("SELECT VERSION() as ver");
    console.log("\nMySQL Version:", version[0].ver);

    // Test 2: Try to force EUC-KR matching via HEX or binary casting
    console.log("\nTesting '긴급' matching with HEX/BINARY workarounds...");
    
    // In euckr, '긴' is B1 E4, '급' is B1 DE
    // We can try to cast the column to binary or use hex literals
    const queries = [
      "SELECT COUNT(*) as c FROM t_balju WHERE B_C_NAME LIKE '%긴급%'",
      "SELECT COUNT(*) as c FROM t_balju WHERE B_C_NAME LIKE CONCAT('%', CONVERT('긴급' USING euckr), '%')",
      "SELECT COUNT(*) as c FROM t_balju WHERE B_C_NAME LIKE _euckr '%긴급%'",
      "SELECT COUNT(*) as c FROM t_balju WHERE HEX(B_C_NAME) LIKE '%B1E4B1DE%'"
    ];

    for (const q of queries) {
      console.time(q);
      try {
        const [res]: any = await dbPool.execute(q);
        console.log(`Success -> Count: ${res[0].c}`);
      } catch (e) {
        console.log(`Failed -> ${e.message}`);
      }
      console.timeEnd(q);
    }

    // Test 3: Can we find the max ID and just scan backwards limit 50000?
    // t_balju might have a primary key or sequence column.
    console.log("\nTesting ID-based limitation...");
    const [cols]: any = await dbPool.execute("SHOW COLUMNS FROM t_balju");
    const pk = cols.find(c => c.Key === 'PRI' || c.Key === 'UNI');
    console.log("Primary Key info:", pk ? pk.Field : "No single PK found");

    process.exit(0);
  } catch (error) {
    console.error('DB Connection failed or offline:', error.message);
    process.exit(1);
  }
}

main();
