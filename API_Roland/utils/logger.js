const { createLogger, format, transports } = require("winston");
const { combine, timestamp, printf, colorize, errors } = format;
require("winston-daily-rotate-file");
const path = require("path");

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}] ${stack || message}`;
});

const logger = createLogger({
  level: "info",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    
    new transports.DailyRotateFile({
      filename: path.join("logs", "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d", 
      level: "error",
    }),
    
    new transports.DailyRotateFile({
      filename: path.join("logs", "combined-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
    }),
  ],
});


if (process.env.NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      format: combine(colorize(), logFormat),
    })
  );
}

module.exports = logger;
