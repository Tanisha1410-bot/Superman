const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    connectionString: 'postgresql://corsair_superhuman_db_user:2C5obTdeGryourcJ8V2WOyBRR9SZFroE@dpg-d9qqit942hec73erna60-a.singapore-postgres.render.com/corsair_superhuman_db',
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