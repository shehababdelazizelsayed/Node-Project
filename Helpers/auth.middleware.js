const jwt = require("jsonwebtoken");
const config = require("../config/config");
const logger = require("../utils/logger")

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      logger.error("Authentication required")
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    logger.error("Invalid Token");
    res.status(401).json({
      message: "Invalid token",
    });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.Role)) {
      logger.error("Access denied")
      return res.status(403).json({
        message: "Access denied",
      });
    }
    next();
  };
};

module.exports = {
  authMiddleware,
  authorizeRoles,
};
