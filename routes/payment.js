// routes/payment.js
const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");

// PayPal success & cancel callback endpoints
router.get("/success", paymentController.paypalSuccess);
router.get("/cancel", paymentController.paypalCancel);

// (Optional) endpoint to create a payment from backend, if you want server-side creation
router.post("/create", paymentController.createPayment);

module.exports = router;
