const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    await client.connect();
    console.log('✅ DB Connected!');

    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('✅ Schema applied! Saari tables ban gayi.');

    await client.end();
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});