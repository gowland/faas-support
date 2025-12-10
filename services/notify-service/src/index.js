require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.NOTIFY_PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());

// Create notifications directory if it doesn't exist
const notificationsDir = path.join(__dirname, '..', process.env.NOTIFICATIONS_DIR || './notifications');
if (!fs.existsSync(notificationsDir)) {
  fs.mkdirSync(notificationsDir, { recursive: true });
}

/**
 * Write notification to file
 * @param {string} type - Type of notification (message, exception, duplicate)
 * @param {object} data - Notification data
 * @returns {object} Object containing fileName and filePath
 */
function writeNotificationToFile(type, data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${type}_${timestamp}.json`;
  const filePath = path.join(notificationsDir, fileName);

  const notification = {
    type,
    timestamp: new Date().toISOString(),
    data,
    status: 'unread'
  };

  fs.writeFileSync(filePath, JSON.stringify(notification, null, 2));

  return { fileName, filePath };
}

/**
 * POST /notify - Send a notification
 * Body: { type: string, title: string, message: string, zipFile?: string, details?: object }
 */
app.post('/notify', (req, res) => {
  try {
    const { type, title, message, zipFile, details } = req.body;

    if (!type || !title || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: type, title, message' 
      });
    }

    const notificationData = {
      type,
      title,
      message,
      zipFile: zipFile || null,
      details: details || {}
    };

    const result = writeNotificationToFile(type, notificationData);

    console.log(`\n🔔 Notification Sent`);
    console.log(`  Type: ${type}`);
    console.log(`  Title: ${title}`);
    console.log(`  Message: ${message}`);
    if (zipFile) {
      console.log(`  Zip File: ${zipFile}`);
    }
    console.log(`  Saved to: ${path.relative(process.cwd(), result.filePath)}`);
    console.log();

    res.json({
      success: true,
      message: 'Notification sent',
      file: result.fileName,
      filePath: result.filePath
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({
      error: 'Error sending notification',
      details: error.message
    });
  }
});

/**
 * GET /notifications - Get all notifications
 */
app.get('/notifications', (req, res) => {
  try {
    const files = fs.readdirSync(notificationsDir);
    const notifications = files.map(file => {
      const content = fs.readFileSync(path.join(notificationsDir, file), 'utf8');
      return JSON.parse(content);
    });

    res.json({
      count: notifications.length,
      notifications
    });
  } catch (error) {
    console.error('Error retrieving notifications:', error);
    res.status(500).json({
      error: 'Error retrieving notifications',
      details: error.message
    });
  }
});

/**
 * GET /notifications/count - Get notification count
 */
app.get('/notifications/count', (req, res) => {
  try {
    const files = fs.readdirSync(notificationsDir);
    res.json({
      count: files.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error counting notifications',
      details: error.message
    });
  }
});

/**
 * GET /health - Health check endpoint
 */
app.get('/health', (req, res) => {
  try {
    const files = fs.readdirSync(notificationsDir);
    res.json({ 
      status: 'ok', 
      service: 'notify-service',
      notificationCount: files.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error checking health',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Notify Service running on http://localhost:${PORT}`);
  console.log(`POST   http://localhost:${PORT}/notify - Send a notification`);
  console.log(`GET    http://localhost:${PORT}/notifications - Get all notifications`);
  console.log(`GET    http://localhost:${PORT}/notifications/count - Get notification count`);
  console.log(`GET    http://localhost:${PORT}/health - Health check`);
});
