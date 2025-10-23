const express = require("express");
const router = express.Router();
const { verifyToken: authMiddleware } = require("../middlewares/auth");
const {
  createPaymentIntent,
  processPayment,
} = require("../Controllers/payment.Controller");

// Create payment intent
router.post("/create-payment-intent", authMiddleware, createPaymentIntent);

// Process payment and create order
router.post("/process-payment", authMiddleware, processPayment);

module.exports = router;
