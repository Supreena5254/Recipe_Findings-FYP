const express = require('express');
const router = express.Router();
const multer = require('multer');
const { minioClient, BUCKET_NAME } = require('../config/minio');
const { v4: uuidv4 } = require('uuid');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const ext = req.file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${ext}`;

    await minioClient.putObject(
      BUCKET_NAME,
      fileName,
      req.file.buffer,
      req.file.buffer.length,
      { 'Content-Type': req.file.mimetype }
    );

    // ✅ Store ONLY the filename — backend builds full URL dynamically
    console.log(`✅ Image uploaded, filename: ${fileName}`);
    res.json({ success: true, imageUrl: fileName });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

module.exports = router;