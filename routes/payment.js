// Stripe webhook endpoint (no auth, raw body required)
const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../Helpers/auth.middleware");
const {
  createPaymentIntent,
  processPayment,
  verifySession,
} = require("../Controllers/payment.Controller");

const { stripeWebhook } = require("../Controllers/payment.Controller");
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);
/**
 * @swagger
 * /api/payment/create-payment-intent:
 *   post:
 *     summary: Create a payment intent for book purchase
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - CartId
 *             properties:
 *               CartId:
 *                 type: string
 *                 description: The MongoDB ObjectId of the user's cart
 *             example:
 *               CartId: "67a34c98b1d3f905ea5d4a11"
 *     responses:
 *       200:
 *         description: Payment intent created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 clientSecret:
 *                   type: string
 *                   description: Stripe client secret for frontend
 *                 paymentIntentId:
 *                   type: string
 *                   description: Stripe payment intent ID
 *                 amount:
 *                   type: number
 *                   description: Total amount in dollars
 *                 amountInCents:
 *                   type: integer
 *                   description: Total amount in cents
 *                 books:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       quantity:
 *                         type: integer
 *                       price:
 *                         type: number
 *       400:
 *         description: Validation error or insufficient stock
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Book not found
 *       500:
 *         description: Internal server error
 */

// Create payment intent
router.post("/create-payment-intent", authMiddleware, createPaymentIntent);

// Verify a Stripe Checkout session and create order if paid
router.post("/verify-session", authMiddleware, verifySession);

/**
 * @swagger
 * /api/payment/process-payment:
 *   post:
 *     summary: Process and confirm payment, create order
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
/**
 * @swagger
 * /api/payment/create-payment-intent:
 *   post:
 *     summary: Create a Stripe Checkout session for book purchase (UI redirect)
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - CartId
 *             properties:
 *               CartId:
 *                 type: string
 *                 description: The MongoDB ObjectId of the user's cart
 *             example:
 *               CartId: "67a34c98b1d3f905ea5d4a11"
 *     responses:
 *       200:
 *         description: Stripe Checkout session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 url:
 *                   type: string
 *                   description: Stripe Checkout session URL for redirect
 *                 sessionId:
 *                   type: string
 *                   description: Stripe Checkout session ID
 *                 amount:
 *                   type: number
 *                   description: Total amount in dollars
 *                 amountInCents:
 *                   type: integer
 *                   description: Total amount in cents
 *                 books:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       bookId:
 *                         type: string
 *                       title:
 *                         type: string
 *                       quantity:
 *                         type: integer
 *                       price:
 *                         type: number
 *       400:
 *         description: Validation error or insufficient stock
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Book not found
 *       500:
 *         description: Internal server error
 */

// Ensure router is exported for Express
module.exports = router;
