const config = {
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRATION: "24h",
  SALT_ROUNDS: 10,
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: process.env.REDIS_PORT || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
};

module.exports = config;
