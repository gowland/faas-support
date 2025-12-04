# faas-support# faas-support

Vibe coded toy project to explore FaaS

Toy project to explore FaaS architecture with a support file upload system.

Use cases: faas-usecase.puml

## Project StatusArchitecture diagram: faas-architecture.puml


Currently implemented as a **non-FaaS system** for testing and validation. The system accepts support zip files through a web UI, extracts them, and logs the contents to the server console.

### Use Cases
See: `faas-usecase.puml`

### Architecture Diagram
See: `faas-architecture.puml`

## System Components

### 1. UI Service (Port 3000)
- Simple, modern web interface for uploading support zip files
- Drag-and-drop support
- File validation
- Real-time feedback

**Location**: `services/ui-service/`

### 2. Upload Service (Port 3001)
- Receives zip file uploads
- Extracts zip file contents
- Logs file information to console
- Stores extracted files in `uploads/` directory

**Location**: `services/upload-service/`

## Quick Start

### Prerequisites
- Node.js 18+
- npm

### Running Locally

1. **Install dependencies for both services:**
   ```powershell
   cd services/ui-service
   npm install
   cd ../upload-service
   npm install
   cd ../..
   ```

2. **Start the Upload Service (Terminal 1):**
   ```powershell
   cd services/upload-service
   npm start
   ```

3. **Start the UI Service (Terminal 2):**
   ```powershell
   cd services/ui-service
   npm start
   ```

4. **Open the UI in your browser:**
   ```
   http://localhost:3000
   ```

### Using Docker Compose

```bash
docker-compose up
```

This will start both services. Access the UI at `http://localhost:3000`.

## Testing

### Creating a Test Zip File

A sample test support package is included. To create and upload a new test:

1. Create files in a directory
2. Compress the directory into a .zip file:
   ```powershell
   Compress-Archive -Path test-support-package -DestinationPath test-support.zip -Force
   ```

3. Use the UI to upload, or run the test script:
   ```powershell
   node test-upload.js
   ```

### Expected Output

When a zip file is uploaded, the Upload Service logs:
```
============================================================
📦 ZIP File Received: filename.zip
============================================================

📋 File Count: N

📄 Contents:
  - file1.txt (X.XX KB)
  - file2.txt (X.XX KB)
  ...

📊 Total Size: X.XX KB
============================================================
```

## File Structure

```
faas-support/
├── services/
│   ├── ui-service/              # Web UI for uploads
│   │   ├── public/
│   │   │   └── index.html       # Upload form
│   │   ├── index.js
│   │   └── package.json
│   └── upload-service/          # Upload processor
│       ├── src/
│       │   └── index.js
│       ├── uploads/             # Extracted files
│       └── package.json
├── docker-compose.yml
├── package.json
└── README.md
```

## Environment Configuration

See `.env` file for port and directory configuration:
- `PORT` - UI Service port (default: 3000)
- `CUSTOMER_MESSAGE_PORT` - Upload Service port (default: 3001)
- `UPLOAD_DIR` - Directory for uploaded files (default: ./uploads)

## Future: FaaS Integration

This system will be extended to use Function-as-a-Service for:
- Extracting customer messages
- Processing exception logs
- Searching for similar exceptions
- Notifying support teams
