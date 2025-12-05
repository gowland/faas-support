require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.EXCEPTION_SEARCH_PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

/**
 * In-memory storage for exceptions
 * Structure: {
 *   "exception-message": [
 *     { message: "...", zipFile: "...", timestamp: "..." },
 *     ...
 *   ]
 * }
 */
const exceptionDatabase = {};

/**
 * Normalize exception message for searching (lowercase, trim, etc.)
 */
function normalizeMessage(message) {
  return message.toLowerCase().trim();
}

/**
 * POST /exceptions - Store a new exception message
 * Body: { message: string, zipFile: string }
 */
app.post('/exceptions', (req, res) => {
  try {
    const { message, zipFile } = req.body;

    if (!message || !zipFile) {
      return res.status(400).json({ error: 'Missing required fields: message, zipFile' });
    }

    const normalized = normalizeMessage(message);
    
    if (!exceptionDatabase[normalized]) {
      exceptionDatabase[normalized] = [];
    }

    const exceptionRecord = {
      message,
      zipFile,
      timestamp: new Date().toISOString(),
      count: exceptionDatabase[normalized].length + 1
    };

    exceptionDatabase[normalized].push(exceptionRecord);

    console.log(`\n📋 Exception Stored`);
    console.log(`  Message: ${message}`);
    console.log(`  Zip File: ${zipFile}`);
    console.log(`  Count: ${exceptionRecord.count}`);
    console.log();

    res.json({
      success: true,
      message: 'Exception stored',
      isDuplicate: exceptionRecord.count > 1,
      duplicateCount: exceptionRecord.count
    });
  } catch (error) {
    console.error('Error storing exception:', error);
    res.status(500).json({
      error: 'Error storing exception',
      details: error.message
    });
  }
});

/**
 * GET /exceptions/search - Search for similar exceptions
 * Query: { query: string }
 */
app.get('/exceptions/search', (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Missing required query parameter: query' });
    }

    const normalized = normalizeMessage(query);
    const results = exceptionDatabase[normalized] || [];

    console.log(`\n🔍 Exception Search`);
    console.log(`  Query: ${query}`);
    console.log(`  Matches found: ${results.length}`);
    console.log();

    res.json({
      query,
      matchCount: results.length,
      matches: results,
      isDuplicate: results.length > 0
    });
  } catch (error) {
    console.error('Error searching exceptions:', error);
    res.status(500).json({
      error: 'Error searching exceptions',
      details: error.message
    });
  }
});

/**
 * GET /exceptions - Get all exceptions
 */
app.get('/exceptions', (req, res) => {
  try {
    const allExceptions = [];
    
    for (const [key, records] of Object.entries(exceptionDatabase)) {
      allExceptions.push({
        normalized: key,
        count: records.length,
        records
      });
    }

    res.json({
      totalUniqueExceptions: allExceptions.length,
      exceptions: allExceptions
    });
  } catch (error) {
    console.error('Error retrieving exceptions:', error);
    res.status(500).json({
      error: 'Error retrieving exceptions',
      details: error.message
    });
  }
});

/**
 * GET /health - Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'search-exceptions-service',
    exceptionCount: Object.keys(exceptionDatabase).length
  });
});

app.listen(PORT, () => {
  console.log(`Search Exceptions Service running on http://localhost:${PORT}`);
  console.log(`POST   http://localhost:${PORT}/exceptions - Store an exception`);
  console.log(`GET    http://localhost:${PORT}/exceptions/search - Search for exceptions`);
  console.log(`GET    http://localhost:${PORT}/exceptions - Get all exceptions`);
  console.log(`GET    http://localhost:${PORT}/health - Health check`);
});
