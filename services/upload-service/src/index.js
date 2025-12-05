require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const cors = require('cors');
const http = require('http');

const app = express();
const PORT = process.env.CUSTOMER_MESSAGE_PORT || 3001;
const SEARCH_EXCEPTIONS_URL = process.env.SEARCH_EXCEPTIONS_URL || 'http://localhost:3002';
const NOTIFY_SERVICE_URL = process.env.NOTIFY_SERVICE_URL || 'http://localhost:3003';

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
 * Make HTTP POST request
 * @param {string} url - Full URL to POST to
 * @param {object} data - Data to send as JSON
 */
function makeHttpRequest(url, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({ raw: body });
        }
      });
    });

    req.on('error', (error) => {
      console.warn(`  ⚠️  Request to ${url} failed: ${error.message}`);
      resolve({ error: error.message });
    });

    req.write(JSON.stringify(data));
    req.end();
  });
}

/**
 * Extract text content from file
 * @param {string} filePath - Path to file
 * @returns {string} File content
 */
function extractFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch (error) {
    return null;
  }
}

/**
 * Process extracted files for messages and exceptions
 * @param {string} extractDir - Directory containing extracted files
 * @param {string} fileName - Original zip file name
 */
async function processExtractedFiles(extractDir, fileName) {
  console.log(`\n⚙️  Processing extracted files...`);

  const files = await fs.promises.readdir(extractDir);
  
  // Look for support message file
  const messageFile = files.find(f => 
    f.toLowerCase().includes('message') || f.toLowerCase().includes('support')
  );
  
  // Look for exception file
  const exceptionFile = files.find(f => 
    f.toLowerCase().includes('exception') || f.toLowerCase().includes('error') || f.toLowerCase().includes('log')
  );

  // Process support message
  if (messageFile) {
    const messageContent = extractFileContent(path.join(extractDir, messageFile));
    if (messageContent) {
      console.log(`\n📧 Support Message Found:`);
      console.log(`  File: ${messageFile}`);
      console.log(`  Content: ${messageContent.substring(0, 100)}...`);
      
      // Notify support team
      await makeHttpRequest(`${NOTIFY_SERVICE_URL}/notify`, {
        type: 'message',
        title: 'New Support Message',
        message: messageContent,
        zipFile: fileName,
        details: { file: messageFile }
      });
    }
  }

  // Process exception
  if (exceptionFile) {
    const exceptionContent = extractFileContent(path.join(extractDir, exceptionFile));
    if (exceptionContent) {
      console.log(`\n⚠️  Exception Found:`);
      console.log(`  File: ${exceptionFile}`);
      console.log(`  Content: ${exceptionContent.substring(0, 100)}...`);
      
      // Search for similar exceptions
      const searchResult = await makeHttpRequest(`${SEARCH_EXCEPTIONS_URL}/exceptions`, {
        message: exceptionContent,
        zipFile: fileName
      });

      if (searchResult.isDuplicate) {
        console.log(`\n🔔 Duplicate Exception Detected!`);
        console.log(`  This is occurrence #${searchResult.duplicateCount}`);
        
        // Notify support team of duplicate
        await makeHttpRequest(`${NOTIFY_SERVICE_URL}/notify`, {
          type: 'duplicate_exception',
          title: 'Duplicate Exception Detected',
          message: `Exception has been seen ${searchResult.duplicateCount} times before`,
          zipFile: fileName,
          details: { 
            file: exceptionFile,
            exception: exceptionContent.substring(0, 100)
          }
        });
      } else {
        console.log(`\n✨ New Exception`);
        
        // Notify support team of new exception
        await makeHttpRequest(`${NOTIFY_SERVICE_URL}/notify`, {
          type: 'new_exception',
          title: 'New Exception Logged',
          message: exceptionContent,
          zipFile: fileName,
          details: { file: exceptionFile }
        });
      }
    }
  }
}


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
          await processExtractedFiles(extractDir, fileName);
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
