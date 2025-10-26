const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../Helpers/auth.middleware");
const {
  createPaymentIntent,
  processPayment,
} = require("../Controllers/payment.Controller");

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
 *               - Books
 *             properties:
 *               Books:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - BookId
 *                     - Quantity
 *                   properties:
 *                     BookId:
 *                       type: string
 *                       description: Valid MongoDB ObjectId of the book
 *                     Quantity:
 *                       type: integer
 *                       minimum: 1
 *                       description: Quantity of the book to purchase
 *             example:
 *               Books:
 *                 - BookId: "507f1f77bcf86cd799439011"
 *                   Quantity: 2
 *                 - BookId: "507f1f77bcf86cd799439012"
 *                   Quantity: 1
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
 *             required:
 *               - paymentIntentId
 *               - paymentMethodId
 *             properties:
 *               paymentIntentId:
 *                 type: string
 *                 description: Stripe payment intent ID
 *               paymentMethodId:
 *                 type: string
 *                 description: Stripe payment method ID
 *             example:
 *               paymentIntentId: "pi_1234567890"
 *               paymentMethodId: "pm_1234567890"
 *     responses:
 *       201:
 *         description: Payment confirmed and order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 orderId:
 *                   type: string
 *                   description: Order ID
 *                 total:
 *                   type: number
 *                   description: Total amount
 *                 paymentIntentId:
 *                   type: string
 *                   description: Stripe payment intent ID
 *                 status:
 *                   type: string
 *                   description: Order status
 *                 paymentStatus:
 *                   type: string
 *                   description: Payment status
 *       400:
 *         description: Validation error, payment failed, or order already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */

// Process payment and create order
router.post("/process-payment", authMiddleware, processPayment);

module.exports = router;
