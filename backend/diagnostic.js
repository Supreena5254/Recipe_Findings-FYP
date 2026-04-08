// diagnostic.js
// Run this from your backend folder: node diagnostic.js
// It will tell you EXACTLY what's wrong

const { Pool } = require('pg');
const http = require('http');
const os = require('os');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 2,
});

// Step 1: Show all network interfaces
console.log('\n========================================');
console.log('STEP 1: Your Network Interfaces (IPs)');
console.log('========================================');
const interfaces = os.networkInterfaces();
for (const [name, addrs] of Object.entries(interfaces)) {
  for (const addr of addrs) {
    if (addr.family === 'IPv4') {
      console.log(`  ${name}: ${addr.address} ${addr.internal ? '(localhost)' : '← USE THIS'}`);
    }
  }
}

// Step 2: Check what image_urls look like in DB
console.log('\n========================================');
console.log('STEP 2: Sample image_url values in DB');
console.log('========================================');
pool.query(`
  SELECT recipe_id, title, image_url
  FROM recipes
  WHERE image_url IS NOT NULL
  LIMIT 5
`).then(result => {
  if (result.rows.length === 0) {
    console.log('❌ NO RECIPES HAVE image_url set!');
    console.log('   → You need to add image_url values to your recipes table');
  } else {
    result.rows.forEach(r => {
      console.log(`  Recipe ${r.recipe_id} (${r.title}):`);
      console.log(`    image_url = "${r.image_url}"`);

      if (!r.image_url) {
        console.log('    ❌ NULL image_url');
      } else if (r.image_url.startsWith('http')) {
        console.log('    ⚠️  Still a full URL — SQL strip not run yet');
        const ip = r.image_url.match(/http:\/\/([^:]+):/)?.[1];
        console.log(`    ⚠️  Embedded IP: ${ip}`);
      } else {
        console.log('    ✅ Just filename — good format');
      }
    });
  }

  // Step 3: Test if MinIO is reachable
  console.log('\n========================================');
  console.log('STEP 3: Testing MinIO connectivity');
  console.log('========================================');

  // Test localhost:9000
  const req = http.get('http://localhost:9000', (res) => {
    console.log(`  localhost:9000 → HTTP ${res.statusCode} ✅ MinIO is running!`);
    testImageUrl(result.rows[0]);
  });
  req.on('error', () => {
    console.log('  localhost:9000 → ❌ CANNOT CONNECT — MinIO is NOT running!');
    console.log('  💡 Start MinIO first before starting your backend');
  });
  req.setTimeout(3000, () => {
    console.log('  localhost:9000 → ❌ TIMEOUT — MinIO is NOT running!');
    req.destroy();
  });

  pool.end();
}).catch(err => {
  console.error('❌ DB Error:', err.message);
  pool.end();
});

// Step 4: Test if a specific image URL is accessible
function testImageUrl(recipe) {
  if (!recipe?.image_url) return;

  console.log('\n========================================');
  console.log('STEP 4: Testing image URL accessibility');
  console.log('========================================');

  // Build test URL
  let filename = recipe.image_url;
  if (filename.startsWith('http')) {
    filename = filename.split('/').pop();
  }

  const testUrl = `http://localhost:9000/recipe-images/${filename}`;
  console.log(`  Testing: ${testUrl}`);

  const req = http.get(testUrl, (res) => {
    if (res.statusCode === 200) {
      console.log(`  ✅ Image accessible! File exists in MinIO`);
      console.log(`\n  📱 YOUR PHONE needs this URL:`);

      // Get LAN IP
      const ifaces = os.networkInterfaces();
      for (const addrs of Object.values(ifaces)) {
        for (const addr of addrs) {
          if (addr.family === 'IPv4' && !addr.internal) {
            console.log(`  http://${addr.address}:9000/recipe-images/${filename}`);
          }
        }
      }
    } else if (res.statusCode === 403) {
      console.log(`  ❌ HTTP 403 — Bucket is NOT public! Run setBucketPolicy`);
    } else if (res.statusCode === 404) {
      console.log(`  ❌ HTTP 404 — File "${filename}" does NOT exist in MinIO!`);
      console.log(`  💡 Check MinIO console: http://localhost:9001`);
      console.log(`  💡 The file name in DB doesn't match what's in MinIO`);
    } else {
      console.log(`  ⚠️  HTTP ${res.statusCode}`);
    }
  });

  req.on('error', (err) => {
    console.log(`  ❌ Error: ${err.message}`);
  });
}