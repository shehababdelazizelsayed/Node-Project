const config = {
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRATION: "24h",
  SALT_ROUNDS: 10,
};

module.exports = config;
