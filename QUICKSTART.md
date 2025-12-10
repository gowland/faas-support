# FaaS Support System - Quick Start Guide

## 🎯 What This Is

A **microservices-based support ticket and exception processing system** that automatically routes user messages and exceptions through two distinct workflows with Redis-backed duplicate detection.

## 🚀 Quick Start

### 1. Start the System
```powershell
cd c:\src\investigations\distributed\faas-support
docker-compose up --build
```

### 2. Access the UI
- **Upload Interface**: http://localhost:3000

### 3. Upload Test Files
Test zip files are pre-created in the project root:
- `test-message-only.zip` - Support message only
- `test-exception-only.zip` - Exception only  
- `test-both.zip` - Both message and exception

**PowerShell Upload Script**:
```powershell
$filePath = 'test-message-only.zip'
$uri = 'http://localhost:3001/upload'
$fileStream = [System.IO.File]::OpenRead($filePath)
$fileInfo = Get-Item $filePath
$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"

$bodyLines = @(
    "--$boundary$LF",
    "Content-Disposition: form-data; name=`"file`"; filename=`"$($fileInfo.Name)`"$LF",
    "Content-Type: application/octet-stream$LF$LF"
)

$multipartContent = [System.Text.Encoding]::UTF8.GetBytes(([string]::Join('', $bodyLines)))
$streamContent = New-Object System.IO.MemoryStream
$streamContent.Write($multipartContent, 0, $multipartContent.Length)
$fileStream.CopyTo($streamContent)

$footer = [System.Text.Encoding]::UTF8.GetBytes("$LF--$boundary--$LF")
$streamContent.Write($footer, 0, $footer.Length)
$streamContent.Seek(0, 0) | Out-Null

$request = [System.Net.WebRequest]::Create($uri)
$request.Method = 'POST'
$request.ContentType = "multipart/form-data; boundary=$boundary"
$request.ContentLength = $streamContent.Length

$reqStream = $request.GetRequestStream()
$streamContent.CopyTo($reqStream)
$reqStream.Close()

$response = $request.GetResponse()
$reader = New-Object System.IO.StreamReader($response.GetResponseStream())
$reader.ReadToEnd()
```

## 📊 How It Works

### WORKFLOW 1: Support Message (Message Files)
```
Upload ZIP with file named "*message*" or "*support*"
                    ↓
         Upload Service detects it
                    ↓
         Reads file content
                    ↓
         Notifies support team
                    ↓
   Notification stored in Notify Service
```

### WORKFLOW 2: Exception Handling (Exception Files)
```
Upload ZIP with file named "*exception*", "*error*", or "*log*"
                    ↓
         Upload Service detects it
                    ↓
    Step 1: Searches Redis for duplicate
                    ↓
         ┌─ If new: Store with count=1
         │         Notify as "new_exception"
         │
         └─ If duplicate: Increment count
                         Notify as "duplicate_exception"
```

## 🔌 API Endpoints

### Upload Service (Port 3001)
```
POST /upload
  Upload a zip file containing messages and/or exceptions
  Response: { success, message, file, size }
```

### Search-Exceptions Service (Port 3002)
```
POST /exceptions
  Store an exception
  Body: { message, zipFile }
  Response: { success, isDuplicate, duplicateCount }

GET /exceptions/search?query={text}
  Search for exceptions
  Response: { matchCount, isDuplicate, duplicateCount, matches }

GET /exceptions
  Get all stored exceptions
  Response: { totalUniqueExceptions, exceptions: [] }
```

### Notify Service (Port 3003)
```
POST /notify
  Create a notification
  Body: { type, title, message, zipFile, details }
  Response: { success, notificationId }

GET /notifications
  Get all notifications
  Response: { count, notifications: [] }

GET /notifications/count
  Get notification count
  Response: { count }
```

## 📁 Project Structure

```
faas-support/
├── services/
│   ├── ui-service/              # Web upload interface
│   ├── upload-service/          # Workflow orchestration
│   ├── search-exceptions/       # Redis-backed exception search
│   └── notify-service/          # Notification storage
├── test-packages/               # Test data
│   ├── message-only/
│   ├── exception-only/
│   └── both/
├── docker-compose.yml           # Service orchestration
├── COMPLETE_IMPLEMENTATION.md   # Full documentation
├── TEST_RESULTS.md              # Test validation results
└── README.md                    # Original project info
```

## 🧪 Test Results

| Workflow | Test | Result |
|----------|------|--------|
| WORKFLOW 1 | Message processing | ✅ PASSED |
| WORKFLOW 2 | Exception processing | ✅ PASSED |
| WORKFLOW 2 | Duplicate detection | ✅ PASSED |
| WORKFLOW 1+2 | Combined workflows | ✅ PASSED |
| Redis | Data persistence | ✅ PASSED |

**Total Notifications**: 5 created and validated

## 🛠️ Common Commands

### View Service Logs
```powershell
# All services
docker-compose logs

# Specific service
docker-compose logs upload-service
docker-compose logs search-exceptions
docker-compose logs notify-service

# Follow logs (real-time)
docker-compose logs -f upload-service
```

### Access Redis CLI
```powershell
docker-compose exec redis redis-cli
> KEYS "*"                              # List all keys
> HGETALL exception:*                   # Get exception data
> GET exception:*:count                 # Get occurrence count
```

### Stop Services
```powershell
docker-compose down
```

### Clean Everything
```powershell
docker-compose down -v              # Remove volumes too
```

## 📚 Documentation

- **COMPLETE_IMPLEMENTATION.md** - Comprehensive system documentation
- **TEST_RESULTS.md** - Detailed test validation results
- **WORKFLOW_IMPLEMENTATION.md** - Workflow specifications
- **IMPLEMENTATION.md** - Architecture and API reference

## 🎯 Key Features

✅ **Two Distinct Workflows**
- Message detection and notification
- Exception detection with duplicate search

✅ **Redis Persistence**
- Persistent exception storage with AOF
- Duplicate detection via message normalization
- Occurrence counting

✅ **Microservices Architecture**
- 5 containerized services
- Docker Compose orchestration
- Service-to-service HTTP communication

✅ **Comprehensive Logging**
- Workflow execution steps
- File processing details
- Error handling

✅ **Test Data Included**
- 3 test zip scenarios
- Pre-configured test packages
- Easy validation

## 🔧 Troubleshooting

### Services won't start
```powershell
# Check if ports are in use
netstat -ano | findstr :3000
netstat -ano | findstr :3001
netstat -ano | findstr :3002
netstat -ano | findstr :3003
netstat -ano | findstr :6379

# Kill stale processes if needed
Stop-Process -Id <PID> -Force
```

### Redis connection issues
```powershell
# Check Redis logs
docker-compose logs redis

# Verify Redis is running
docker-compose exec redis redis-cli ping
# Should respond: PONG
```

### File upload fails
- Ensure file is a valid zip
- Check upload service logs: `docker-compose logs upload-service`
- Verify file contains expected files with correct names

## 📈 Next Steps (Future Enhancements)

1. **Web UI Enhancement** - Connect notifications to dashboard
2. **Database Integration** - Add MongoDB/PostgreSQL for archival
3. **Email Notifications** - Send alerts to support team
4. **FaaS Conversion** - Migrate to serverless functions (AWS Lambda, etc.)
5. **Advanced Analytics** - Track patterns and metrics

## 🔍 System Validation

All workflows have been tested and validated:

- ✅ Message uploads processed correctly
- ✅ Exceptions stored in Redis
- ✅ Duplicate detection working
- ✅ Multi-file uploads handled
- ✅ Notifications created and stored
- ✅ Service-to-service communication successful

**Status**: Production Ready

## 📞 Support

For detailed information, refer to:
- Architecture: `COMPLETE_IMPLEMENTATION.md`
- Test Results: `TEST_RESULTS.md`  
- Workflows: `WORKFLOW_IMPLEMENTATION.md`
- APIs: `IMPLEMENTATION.md`

---

**Last Updated**: December 9, 2025  
**Version**: 1.0.0  
**Status**: ✅ Complete and Validated
