const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../Helpers/auth.middleware");
const { queryBooksWithAI } = require("../Controllers/ai.controller");

// AI Routes
router.post("/", authMiddleware, queryBooksWithAI);

module.exports = router;
