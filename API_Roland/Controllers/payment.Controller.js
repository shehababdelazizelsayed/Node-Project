const stripe = require("../Helpers/stripe");
const Order = require("../models/Order");
const Book = require("../models/Book");
const Cart = require("../models/Cart");
const User = require("../models/User");
const Joi = require("joi");
const mongoose = require("mongoose");

// Create Payment Intent
async function createPaymentIntent(req, res) {
  try {
    // Get user from JWT token (set by auth middleware)
    const userId = req.user.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const schema = Joi.object({
      Books: Joi.array()
        .items(
          Joi.object({
            BookId: Joi.string()
              .trim()
              .pattern(/^[0-9a-fA-F]{24}$/)
              .required()
              .messages({
                "string.pattern.base": "BookId must be a valid ObjectId",
              }),
            Quantity: Joi.number().integer().min(1).required(),
          })
        )
        .min(1)
        .required(),
    });

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.details.map((d) => d.message.replace(/"/g, "")),
      });
    }

    const { Books } = value;
    let totalPrice = 0;
    const bookDetails = [];

    // Calculate total price and validate books
    for (let i = 0; i < Books.length; i++) {
      const item = Books[i];

      const book = await Book.findById(item.BookId);
      if (!book) {
        return res.status(404).json({
          message: `Book not found at index ${i}`,
        });
      }

      if (book.Stock < item.Quantity) {
        return res.status(400).json({
          message: `Insufficient stock for "${book.Title}". Available: ${book.Stock}, Requested: ${item.Quantity}`,
        });
      }

      const itemTotal = book.Price * item.Quantity;
      totalPrice += itemTotal;

      bookDetails.push({
        id: book._id.toString(),
        title: book.Title,
        quantity: item.Quantity,
        price: book.Price,
      });
    }

    // Stripe requires amount in cents and minimum 50 cents
    const amountInCents = Math.round(totalPrice * 100);

    if (amountInCents < 50) {
      return res.status(400).json({
        message: "Total amount must be at least $0.50",
      });
    }

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      metadata: {
        userId: userId.toString(),
        books: JSON.stringify(Books),
        bookDetails: JSON.stringify(bookDetails),
      },
      payment_method_types: ["card"], // Only accept card payments
      automatic_payment_methods: {
        enabled: false, // Disable automatic payment methods
      },
    });

    return res.status(200).json({
      message: "Payment intent created successfully",
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: totalPrice,
      amountInCents: amountInCents,
      books: bookDetails,
    });
  } catch (error) {
    console.error("createPaymentIntent error:", error);
    return res.status(500).json({
      message: error.message || "Failed to create payment intent",
    });
  }
}

// Process Payment (Confirm with Stripe and Create Order)
async function processPayment(req, res) {
  const session = await mongoose.startSession();

  try {
    // Get user from JWT token (set by auth middleware)
    const userId = req.user.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    // Get user details from database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const schema = Joi.object({
      paymentIntentId: Joi.string().trim().required(),
      paymentMethodId: Joi.string().trim().required().messages({
        "string.empty": "Payment method is required",
        "any.required": "Payment method is required",
      }),
    });

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.details.map((d) => d.message.replace(/"/g, "")),
      });
    }

    const { paymentIntentId, paymentMethodId } = value;

    // Check if order already exists for this payment
    const existingOrder = await Order.findOne({
      PaymentIntentId: paymentIntentId,
    });
    if (existingOrder) {
      return res.status(400).json({
        message: "Order already created for this payment",
        orderId: existingOrder._id,
      });
    }

    // Confirm payment with Stripe
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId,
      });
    } catch (stripeError) {
      return res.status(400).json({
        message: "Payment failed",
        error: stripeError.message,
      });
    }

    // Check if payment succeeded
    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({
        message: "Payment not completed",
        status: paymentIntent.status,
        requiresAction: paymentIntent.status === "requires_action",
        clientSecret:
          paymentIntent.status === "requires_action"
            ? paymentIntent.client_secret
            : undefined,
      });
    }

    // Parse books from metadata
    const books = JSON.parse(paymentIntent.metadata.books);
    const totalPrice = paymentIntent.amount / 100;

    let order = null;

    try {
      await session.withTransaction(async () => {
        // Validate and update stock
        for (let i = 0; i < books.length; i++) {
          const item = books[i];
          const book = await Book.findById(item.BookId).session(session);

          if (!book) {
            throw new Error(`BOOK_NOT_FOUND_${i}`);
          }

          const qtyNum = Number(item.Quantity);

          if (qtyNum < 1) {
            throw new Error(`INVALID_QUANTITY_${i}`);
          }

          // Atomic stock update
          const reserve = await Book.updateOne(
            {
              _id: item.BookId,
              Stock: { $gte: qtyNum },
            },
            {
              $inc: { Stock: -qtyNum },
            },
            { session }
          );

          if (reserve.matchedCount === 0 || reserve.modifiedCount === 0) {
            throw new Error(`INSUFFICIENT_STOCK_${i}_${book.Title}`);
          }
        }

        // Create order
        const orderResult = await Order.create(
          [
            {
              User: user._id,
              Books: books.map((item) => ({
                BookId: item.BookId,
                Quantity: Number(item.Quantity),
              })),
              TotalPrice: totalPrice,
              Status: "completed",
              PaymentIntentId: paymentIntentId,
            },
          ],
          { session }
        );

        order = orderResult[0];

        // Clear user's cart
        await Cart.findOneAndDelete({ User: user._id }, { session });
      });

      await session.commitTransaction();

      return res.status(201).json({
        message: "Payment confirmed and order created successfully",
        orderId: order._id,
        total: order.TotalPrice,
        paymentIntentId: paymentIntentId,
        status: order.Status,
        paymentStatus: paymentIntent.status,
      });
    } catch (trxErr) {
      await session.abortTransaction();

      if (typeof trxErr.message === "string") {
        if (trxErr.message.startsWith("BOOK_NOT_FOUND_")) {
          const i = trxErr.message.split("_").pop();
          return res.status(404).json({
            message: `Book not found at index ${i}`,
          });
        }
        if (trxErr.message.startsWith("INVALID_QUANTITY_")) {
          const i = trxErr.message.split("_").pop();
          return res.status(400).json({
            message: `Invalid quantity at index ${i}`,
          });
        }
        if (trxErr.message.startsWith("INSUFFICIENT_STOCK_")) {
          const parts = trxErr.message.split("_");
          const i = parts[2];
          const bookTitle = parts.slice(3).join("_");
          return res.status(400).json({
            message: `Insufficient stock for "${bookTitle}" at index ${i}`,
          });
        }
      }
      throw trxErr;
    }
  } catch (error) {
    console.error("processPayment error:", error);
    return res.status(500).json({
      message: error.message || "Failed to process payment",
    });
  } finally {
    session.endSession();
  }
}

// Confirm Payment and Create Order (for already confirmed payments)
async function confirmPayment(req, res) {
  const session = await mongoose.startSession();

  try {
    // Get user from JWT token (set by auth middleware)
    const userId = req.user.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    // Get user details from database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const schema = Joi.object({
      paymentIntentId: Joi.string().trim().required(),
    });

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.details.map((d) => d.message.replace(/"/g, "")),
      });
    }

    const { paymentIntentId } = value;

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({
        message: "Payment not completed",
        status: paymentIntent.status,
      });
    }

    // Check if order already exists for this payment
    const existingOrder = await Order.findOne({
      PaymentIntentId: paymentIntentId,
    });
    if (existingOrder) {
      return res.status(400).json({
        message: "Order already created for this payment",
        orderId: existingOrder._id,
      });
    }

    // Parse books from metadata
    const books = JSON.parse(paymentIntent.metadata.books);
    const totalPrice = paymentIntent.amount / 100;

    let order = null;

    try {
      await session.withTransaction(async () => {
        // Validate and update stock
        for (let i = 0; i < books.length; i++) {
          const item = books[i];
          const book = await Book.findById(item.BookId).session(session);

          if (!book) {
            throw new Error(`BOOK_NOT_FOUND_${i}`);
          }

          const qtyNum = Number(item.Quantity);

          if (qtyNum < 1) {
            throw new Error(`INVALID_QUANTITY_${i}`);
          }

          // Atomic stock update
          const reserve = await Book.updateOne(
            {
              _id: item.BookId,
              Stock: { $gte: qtyNum },
            },
            {
              $inc: { Stock: -qtyNum },
            },
            { session }
          );

          if (reserve.matchedCount === 0 || reserve.modifiedCount === 0) {
            throw new Error(`INSUFFICIENT_STOCK_${i}_${book.Title}`);
          }
        }

        // Create order
        const orderResult = await Order.create(
          [
            {
              User: user._id,
              Books: books.map((item) => ({
                BookId: item.BookId,
                Quantity: Number(item.Quantity),
              })),
              TotalPrice: totalPrice,
              Status: "completed",
              PaymentIntentId: paymentIntentId,
            },
          ],
          { session }
        );

        order = orderResult[0];

        // Clear user's cart
        await Cart.findOneAndDelete({ User: user._id }, { session });
      });

      await session.commitTransaction();

      return res.status(201).json({
        message: "Payment confirmed and order created successfully",
        orderId: order._id,
        total: order.TotalPrice,
        paymentIntentId: paymentIntentId,
        status: order.Status,
      });
    } catch (trxErr) {
      await session.abortTransaction();

      if (typeof trxErr.message === "string") {
        if (trxErr.message.startsWith("BOOK_NOT_FOUND_")) {
          const i = trxErr.message.split("_").pop();
          return res.status(404).json({
            message: `Book not found at index ${i}`,
          });
        }
        if (trxErr.message.startsWith("INVALID_QUANTITY_")) {
          const i = trxErr.message.split("_").pop();
          return res.status(400).json({
            message: `Invalid quantity at index ${i}`,
          });
        }
        if (trxErr.message.startsWith("INSUFFICIENT_STOCK_")) {
          const parts = trxErr.message.split("_");
          const i = parts[2];
          const bookTitle = parts.slice(3).join("_");
          return res.status(400).json({
            message: `Insufficient stock for "${bookTitle}" at index ${i}`,
          });
        }
      }
      throw trxErr;
    }
  } catch (error) {
    console.error("confirmPayment error:", error);
    return res.status(500).json({
      message: error.message || "Failed to confirm payment",
    });
  } finally {
    session.endSession();
  }
}

// Get Payment Intent Status
async function getPaymentStatus(req, res) {
  try {
    const schema = Joi.object({
      paymentIntentId: Joi.string().trim().required(),
    });

    const { error, value } = schema.validate(req.params, {
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        message: "Invalid payment intent ID",
      });
    }

    const { paymentIntentId } = value;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Check if order exists
    const order = await Order.findOne({ PaymentIntentId: paymentIntentId });

    return res.status(200).json({
      paymentStatus: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      orderCreated: !!order,
      orderId: order?._id,
      orderStatus: order?.Status,
    });
  } catch (error) {
    console.error("getPaymentStatus error:", error);
    return res.status(500).json({
      message: error.message || "Failed to get payment status",
    });
  }
}

// Webhook handler for Stripe events
async function handleWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object;
        console.log("PaymentIntent succeeded:", paymentIntent.id);
        // Additional logic can be added here
        break;

      case "payment_intent.payment_failed":
        const failedPayment = event.data.object;
        console.log("PaymentIntent failed:", failedPayment.id);
        // Handle failed payment - could send email notification
        break;

      case "payment_intent.canceled":
        const canceledPayment = event.data.object;
        console.log("PaymentIntent canceled:", canceledPayment.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
}

// Refund a payment
async function refundPayment(req, res) {
  try {
    // Get user from JWT token
    const userId = req.user.userId;
    if (!userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Only admins can process refunds
    if (user.Role !== "Admin" && user.Role !== "Owner") {
      return res.status(403).json({
        message: "Access denied. Admin privileges required.",
      });
    }

    const schema = Joi.object({
      paymentIntentId: Joi.string().trim().required(),
      amount: Joi.number().min(0).optional(),
      reason: Joi.string().trim().optional(),
    });

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.details.map((d) => d.message.replace(/"/g, "")),
      });
    }

    const { paymentIntentId, amount, reason } = value;

    // Find the order
    const order = await Order.findOne({ PaymentIntentId: paymentIntentId });
    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (order.Status === "refunded") {
      return res.status(400).json({
        message: "Order already refunded",
      });
    }

    const refundData = {
      payment_intent: paymentIntentId,
    };

    if (amount) {
      refundData.amount = Math.round(amount * 100); // Convert to cents
    }

    if (reason) {
      refundData.reason = reason;
    }

    // Process refund with Stripe
    const refund = await stripe.refunds.create(refundData);

    // Update order status
    await Order.findOneAndUpdate(
      { PaymentIntentId: paymentIntentId },
      {
        Status: "refunded",
        RefundId: refund.id,
        RefundedAt: new Date(),
      }
    );

    // Restore book stock
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const item of order.Books) {
          await Book.updateOne(
            { _id: item.BookId },
            { $inc: { Stock: item.Quantity } },
            { session }
          );
        }
      });
    } finally {
      session.endSession();
    }

    return res.status(200).json({
      message: "Refund processed successfully",
      refundId: refund.id,
      amount: refund.amount / 100,
      status: refund.status,
      orderId: order._id,
    });
  } catch (error) {
    console.error("refundPayment error:", error);
    return res.status(500).json({
      message: error.message || "Failed to process refund",
    });
  }
}

module.exports = {
  createPaymentIntent,
  processPayment,
  confirmPayment,
  getPaymentStatus,
  handleWebhook,
  refundPayment,
};
