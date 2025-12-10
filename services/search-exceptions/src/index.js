require('dotenv').config();
const express = require('express');
const cors = require('cors');
const redis = require('redis');
const crypto = require('crypto');

const app = express();
const PORT = process.env.EXCEPTION_SEARCH_PORT || 3002;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Middleware
app.use(cors());
app.use(express.json());

// Redis client setup
const redisClient = redis.createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
  }
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

// Connect to Redis
redisClient.connect().catch(console.error);

/**
 * Normalize exception message for searching (lowercase, trim, etc.)
 */
function normalizeMessage(message) {
  return message.toLowerCase().trim();
}

/**
 * Create a hash of the normalized message for use as a Redis key
 */
function hashMessage(message) {
  const normalized = normalizeMessage(message);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * POST /exceptions - Store a new exception message
 * Body: { message: string, zipFile: string }
 */
app.post('/exceptions', async (req, res) => {
  try {
    const { message, zipFile } = req.body;

    if (!message || !zipFile) {
      return res.status(400).json({ error: 'Missing required fields: message, zipFile' });
    }

    const messageHash = hashMessage(message);
    const key = `exception:${messageHash}`;
    
    // Get current count
    const countStr = await redisClient.get(`${key}:count`);
    const count = (countStr ? parseInt(countStr) : 0) + 1;

    // Store the exception record
    const exceptionRecord = {
      message,
      zipFile,
      timestamp: new Date().toISOString(),
      count
    };

    // Save to Redis
    await redisClient.hSet(key, {
      message,
      zipFile,
      timestamp: new Date().toISOString(),
      count: count.toString()
    });

    // Update count
    await redisClient.set(`${key}:count`, count.toString());

    // Add to sorted set for tracking all exceptions (sorted by timestamp)
    await redisClient.zAdd('exceptions:all', [{
      score: Date.now(),
      value: messageHash
    }]);

    console.log(`\n📋 Exception Stored`);
    console.log(`  Message: ${message.substring(0, 100)}...`);
    console.log(`  Hash: ${messageHash}`);
    console.log(`  Zip File: ${zipFile}`);
    console.log(`  Count: ${count}`);
    console.log();

    res.json({
      success: true,
      message: 'Exception stored',
      isDuplicate: count > 1,
      duplicateCount: count
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
app.get('/exceptions/search', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Missing required query parameter: query' });
    }

    const messageHash = hashMessage(query);
    const key = `exception:${messageHash}`;
    
    // Try to get the exception from Redis
    const exceptionData = await redisClient.hGetAll(key);
    const countStr = await redisClient.get(`${key}:count`);
    const count = countStr ? parseInt(countStr) : 0;

    const isDuplicate = count > 0;
    const results = isDuplicate ? [exceptionData] : [];

    console.log(`\n🔍 Exception Search`);
    console.log(`  Query: ${query}`);
    console.log(`  Matches found: ${results.length}`);
    console.log();

    res.json({
      query,
      matchCount: results.length,
      matches: results,
      isDuplicate: isDuplicate,
      duplicateCount: count
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
app.get('/exceptions', async (req, res) => {
  try {
    // Get all exception keys from sorted set
    const allExceptions = await redisClient.zRangeByScore('exceptions:all', '-inf', '+inf');
    
    const exceptions = [];
    for (const messageHash of allExceptions) {
      const key = `exception:${messageHash}`;
      const exceptionData = await redisClient.hGetAll(key);
      const countStr = await redisClient.get(`${key}:count`);
      
      exceptions.push({
        hash: messageHash,
        count: countStr ? parseInt(countStr) : 0,
        data: exceptionData
      });
    }

    res.json({
      totalUniqueExceptions: exceptions.length,
      exceptions
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
app.get('/health', async (req, res) => {
  try {
    const count = await redisClient.get('exceptions:count:total');
    res.json({ 
      status: 'ok', 
      service: 'search-exceptions-service',
      redis: redisClient.isOpen ? 'connected' : 'disconnected',
      exceptionCount: count || 0
    });
  } catch (error) {
    res.status(500).json({
      error: 'Health check failed',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Search Exceptions Service running on http://localhost:${PORT}`);
  console.log(`POST   http://localhost:${PORT}/exceptions - Store an exception`);
  console.log(`GET    http://localhost:${PORT}/exceptions/search - Search for exceptions`);
  console.log(`GET    http://localhost:${PORT}/exceptions - Get all exceptions`);
  console.log(`GET    http://localhost:${PORT}/health - Health check`);
});

