const winston = require("winston");
const path = require("path");

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

const logger = winston.createLogger({
  format: logFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/combined.log"),
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

module.exports = logger;
