const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../Helpers/auth.middleware");
const {
  createPaymentIntent,
  processPayment,
} = require("../Controllers/payment.Controller");


// Create payment intent
router.post("/create-payment-intent", authMiddleware, createPaymentIntent);


// Process payment and create order
router.post("/process-payment", authMiddleware, processPayment);

module.exports = router;
