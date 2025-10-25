const redis = require('redis');
const config = require('../config/config');

let client;

async function connectRedis() {
  try {
    client = redis.createClient({
      host: config.REDIS_HOST || 'localhost',
      port: config.REDIS_PORT || 6379,
      password: config.REDIS_PASSWORD || undefined,
    });

    client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    client.on('connect', () => {
      console.log('Connected to Redis');
    });

    await client.connect();
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    client = null; // Disable caching if connection fails
  }
}

async function getCache(key) {
  if (!client) return null;
  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Redis GET error:', error);
    return null;
  }
}

async function setCache(key, value, ttl = 300) { // Default TTL 5 minutes
  if (!client) return;
  try {
    await client.setEx(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error('Redis SET error:', error);
  }
}

async function deleteCache(pattern) {
  if (!client) return;
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (error) {
    console.error('Redis DEL error:', error);
  }
}

module.exports = {
  connectRedis,
  getCache,
  setCache,
  deleteCache,
  getClient: () => client,
};
