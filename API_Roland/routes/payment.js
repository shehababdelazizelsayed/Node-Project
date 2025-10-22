const express = require("express");
const router = express.Router();
const {
  verifyToken: authMiddleware,
  authorizeRoles,
} = require("../middlewares/auth");
const {
  createPaymentIntent,
  confirmPayment,
  getPaymentStatus,
  handleWebhook,
  refundPayment,
} = require("../Controllers/payment.Controller");

// Create payment intent
router.post("/create-payment-intent", authMiddleware, createPaymentIntent);

// Confirm payment and create order
router.post("/confirm-payment", authMiddleware, confirmPayment);

// Get payment status
router.get("/status/:paymentIntentId", authMiddleware, getPaymentStatus);

// Refund payment (Admin only)
router.post(
  "/refund",
  authMiddleware,
  authorizeRoles("Admin", "Owner"),
  refundPayment
);

// Stripe webhook (no auth middleware - Stripe validates with signature)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

module.exports = router;
