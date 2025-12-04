require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const cors = require('cors');

const app = express();
const PORT = process.env.CUSTOMER_MESSAGE_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Keep original filename for now
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

/**
 * Log zip file contents
 * @param {string} filePath - Path to the zip file
 * @param {string} fileName - Name of the zip file
 */
async function logZipContents(filePath, fileName) {
  console.log('\n' + '='.repeat(60));
  console.log(`📦 ZIP File Received: ${fileName}`);
  console.log('='.repeat(60));

  try {
    const files = await fs.promises.readdir(filePath);
    
    console.log(`\n📋 File Count: ${files.length}`);
    console.log('\n📄 Contents:\n');

    let totalSize = 0;
    for (const file of files) {
      const fileStat = await fs.promises.stat(path.join(filePath, file));
      totalSize += fileStat.size;
      const sizeKB = (fileStat.size / 1024).toFixed(2);
      console.log(`  - ${file} (${sizeKB} KB)`);
    }

    console.log(`\n📊 Total Size: ${(totalSize / 1024).toFixed(2)} KB`);
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('Error reading zip contents:', error);
  }
}

/**
 * Extract and process zip file
 * @param {string} filePath - Path to the zip file
 * @param {string} fileName - Name of the zip file
 */
async function extractZipFile(filePath, fileName) {
  const extractDir = path.join(uploadsDir, `${fileName}_extracted_${Date.now()}`);

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(unzipper.Extract({ path: extractDir }))
      .on('close', async () => {
        try {
          await logZipContents(extractDir, fileName);
          resolve(extractDir);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

/**
 * POST /upload - Upload and process a zip file
 */
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname;

    // Extract and log zip contents
    await extractZipFile(filePath, fileName);

    res.json({
      success: true,
      message: 'File received and logged',
      file: fileName,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error processing upload:', error);
    res.status(500).json({
      error: 'Error processing file',
      details: error.message
    });
  }
});

/**
 * GET /health - Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'upload-service' });
});

app.listen(PORT, () => {
  console.log(`Upload Service running on http://localhost:${PORT}`);
  console.log(`Accepting file uploads at POST http://localhost:${PORT}/upload`);
});
