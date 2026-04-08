const Minio = require('minio');
require('dotenv').config();
const os = require('os');

// ✅ Auto-detect current LAN IP — works on both WiFi and hotspot!
const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (127.x.x.x) and non-IPv4
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`🌐 Detected network interface: ${name} → ${iface.address}`);
        return iface.address;
      }
    }
  }
  return 'localhost';
};

// Backend connects to MinIO via localhost (same machine)
const MINIO_HOST = process.env.MINIO_HOST || 'localhost';

// ✅ Public IP auto-detected — no need to update .env when switching networks!
const MINIO_PUBLIC_HOST = process.env.MINIO_PUBLIC_HOST || getLocalIP();

const BUCKET_NAME = process.env.MINIO_BUCKET || 'recipe-images';

const minioClient = new Minio.Client({
  endPoint: MINIO_HOST,
  port: 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
});

// ✅ Build full image URL dynamically from just a filename
// Called by recipeController when serving recipe data
const buildImageUrl = (imageUrl) => {
  if (!imageUrl) return null;

  // Already a full URL (old data not yet migrated) — replace IP with current
  if (imageUrl.startsWith('http')) {
    // Extract just the filename from the old URL
    const filename = imageUrl.split('/').pop();
    return `http://${MINIO_PUBLIC_HOST}:9000/${BUCKET_NAME}/${filename}`;
  }

  // Just a filename (new format) — build full URL
  return `http://${MINIO_PUBLIC_HOST}:9000/${BUCKET_NAME}/${imageUrl}`;
};

// Ensure bucket exists and is publicly readable
const ensureBucket = async () => {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`✅ MinIO bucket '${BUCKET_NAME}' created`);
    } else {
      console.log(`✅ MinIO bucket '${BUCKET_NAME}' exists`);
    }

    const policy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
      }],
    });
    await minioClient.setBucketPolicy(BUCKET_NAME, policy);
    console.log(`✅ MinIO bucket policy set to public read`);
    console.log(`📸 Images served at: http://${MINIO_PUBLIC_HOST}:9000/${BUCKET_NAME}/`);
  } catch (err) {
    console.error('❌ MinIO setup error:', err.message);
    console.error('💡 Make sure MinIO is running: http://localhost:9001');
  }
};

ensureBucket();

module.exports = { minioClient, BUCKET_NAME, MINIO_PUBLIC_HOST, buildImageUrl };