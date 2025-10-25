const jwt = require("jsonwebtoken");
const logger = require("../utils/logger"); 

const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.warn("No token provided", { path: req.originalUrl });
      return res.status(401).json({ message: "No Token Provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    logger.info("Token verified successfully", {
      userId: decoded.userId,
      role: decoded.Role,
      path: req.originalUrl
    });

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      logger.warn("Token expired", { error: error.message, path: req.originalUrl });
      return res.status(401).json({ message: "Token has expired" });
    }

    logger.error("Invalid token", { error: error.message, stack: error.stack });
    return res.status(403).json({ message: "Invalid token" });
  }
};

// Roles
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.Role)) {
      logger.warn("Access denied", {
        user: req.user ? req.user.userId : "Unknown",
        role: req.user ? req.user.Role : "None",
        required: allowedRoles
      });
      return res.status(403).json({ message: "Access denied" });
    }

    logger.info("Access granted", {
      userId: req.user.userId,
      role: req.user.Role,
      path: req.originalUrl
    });
    next();
  };
};

module.exports = { verifyToken, authorizeRoles };
