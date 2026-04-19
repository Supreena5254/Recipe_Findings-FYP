const Minio = require('minio');
require('dotenv').config();
const os = require('os');


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


const MINIO_HOST = process.env.MINIO_HOST || 'localhost';

const MINIO_PUBLIC_HOST = process.env.MINIO_PUBLIC_HOST || getLocalIP();

const BUCKET_NAME = process.env.MINIO_BUCKET || 'recipe-images';

const minioClient = new Minio.Client({
  endPoint: MINIO_HOST,
  port: 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
});

const buildImageUrl = (imageUrl) => {
  if (!imageUrl) return null;


  if (imageUrl.startsWith('http')) {
    // Extract just the filename from the old URL
    const filename = imageUrl.split('/').pop();
    return `http://${MINIO_PUBLIC_HOST}:9000/${BUCKET_NAME}/${filename}`;
  }

  return `http://${MINIO_PUBLIC_HOST}:9000/${BUCKET_NAME}/${imageUrl}`;
};

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