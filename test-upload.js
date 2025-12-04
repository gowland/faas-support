const fs = require('fs');
const path = require('path');
const http = require('http');

// Read the zip file
const zipPath = path.join(__dirname, 'test-support.zip');
const fileData = fs.readFileSync(zipPath);

// Create form data boundary
const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

// Create the request body
const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test-support.zip"\r\nContent-Type: application/zip\r\n\r\n`;
const endBody = `\r\n--${boundary}--`;

// Make the request
const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/upload',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': Buffer.byteLength(body) + fileData.length + Buffer.byteLength(endBody)
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n✅ Upload Response:');
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${data}`);
  });
});

req.on('error', (error) => {
  console.error('❌ Upload Error:', error);
});

// Send the request
req.write(body);
req.write(fileData);
req.write(endBody);
req.end();

console.log('📤 Uploading test-support.zip to http://localhost:3001/upload...');
