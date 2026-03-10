const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'prisma/schema.prisma');
let schemaContent = fs.readFileSync(schemaPath, 'utf8');
schemaContent = schemaContent.replace(/@@map\("NDY_/g, '@@map("NBC_');
fs.writeFileSync(schemaPath, schemaContent);
console.log('Updated schema.prisma table mappings to NBC_');

const verifyPath = path.join(__dirname, 'final_verify.js');
let verifyContent = fs.readFileSync(verifyPath, 'utf8');
verifyContent = verifyContent.replace(/LIKE 'NDY_%'/g, "LIKE 'NBC_%'");
verifyContent = verifyContent.replace(/NDY_ 테이블 레코드/g, 'NBC_ 테이블 레코드');
fs.writeFileSync(verifyPath, verifyContent);
console.log('Updated final_verify.js to check NBC_ tables');
