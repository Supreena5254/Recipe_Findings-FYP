const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("UPDATE recipes SET image_url = REPLACE(image_url, '192.168.10.82', '172.20.10.2')")
  .then(() => { console.log('✅ Done! All URLs updated.'); pool.end(); })
  .catch(err => console.error(err));