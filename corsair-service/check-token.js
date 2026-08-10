require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
client.connect()
  .then(() => client.query(`
    SELECT a.id, i.name, a.tenant_id, a.updated_at
    FROM corsair_accounts a
    JOIN corsair_integrations i ON a.integration_id = i.id
    ORDER BY a.updated_at DESC
  `))
  .then(res => {
    console.log(JSON.stringify(res.rows, null, 2));
    return client.end();
  })
  .catch(err => {
    console.error('FULL ERROR OBJECT:', err);
    process.exit(1);
  });
