const stripe = require("../Helpers/stripe");
const Order = require("../models/Order");
const Book = require("../models/Book");
const Cart = require("../models/Cart");
const { CheckForUser } = require("../Helpers/Login.Helper");
const Joi = require("joi");
const mongoose = require("mongoose");

// Create Payment Intent
async function createPaymentIntent(req, res) {
  try {
    // Get user from JWT token (set by auth middleware)
    const userId = req.user.userId;

    const schema = Joi.object({
      Books: Joi.array()
        .items(
          Joi.object({
            BookId: Joi.string().trim().required(),
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
          message: `Insufficient stock for book at index ${i}`,
        });
      }

      totalPrice += book.Price * item.Quantity;
    }

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalPrice * 100), // Convert to cents
      currency: "usd",
      payment_method_types: ["card"],
      metadata: {
        userId: userId,
        books: JSON.stringify(Books),
      },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
    });

    return res.status(200).json({
      message: "Payment intent created successfully",
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: totalPrice,
    });
  } catch (error) {
    console.error("createPaymentIntent:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

// Confirm Payment and Create Order
async function confirmPayment(req, res) {
  try {
    const CheckUser = await CheckForUser(req, res);
    if (!CheckUser) return;

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

    // Parse books from metadata
    const books = JSON.parse(paymentIntent.metadata.books);
    const totalPrice = paymentIntent.amount / 100;

    // Create order using transaction
    const session = await mongoose.startSession();
    let order = null;

    try {
      await session.withTransaction(async () => {
        // Validate and update stock
        for (let i = 0; i < books.length; i++) {
          const item = books[i];
          const book = await Book.findById(item.BookId).session(session);

          if (!book) {
            throw new Error(`Book not found at index ${i}`);
          }

          const qtyNum = Number(item.Quantity);

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
            throw new Error(`Insufficient stock for book at index ${i}`);
          }
        }

        // Create order
        order = await Order.create(
          [
            {
              User: CheckUser._id,
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

        order = order[0];

        // Clear user's cart (optional)
        await Cart.findOneAndDelete({ User: CheckUser._id }, { session });
      });
    } finally {
      session.endSession();
    }

    return res.status(201).json({
      message: "Payment confirmed and order created",
      orderId: order._id,
      total: order.TotalPrice,
      paymentIntentId: paymentIntentId,
    });
  } catch (error) {
    console.error("confirmPayment:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

// Get Payment Intent Status
async function getPaymentStatus(req, res) {
  try {
    const CheckUser = await CheckForUser(req, res);
    if (!CheckUser) return;

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

    return res.status(200).json({
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
    });
  } catch (error) {
    console.error("getPaymentStatus:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

// Webhook handler for Stripe events
async function handleWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded":
      const paymentIntent = event.data.object;
      console.log("PaymentIntent was successful:", paymentIntent.id);
      // You can add additional logic here
      break;

    case "payment_intent.payment_failed":
      const failedPayment = event.data.object;
      console.log("PaymentIntent failed:", failedPayment.id);
      // Handle failed payment
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
}

// Refund a payment
async function refundPayment(req, res) {
  try {
    const CheckUser = await CheckForUser(req, res);
    if (!CheckUser) return;

    // Only admins can process refunds
    if (CheckUser.Role !== "Admin" && CheckUser.Role !== "Owner") {
      return res.status(403).json({
        message: "Access denied. Admin privileges required.",
      });
    }

    const schema = Joi.object({
      paymentIntentId: Joi.string().trim().required(),
      amount: Joi.number().min(0).optional(),
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

    const { paymentIntentId, amount } = value;

    const refundData = {
      payment_intent: paymentIntentId,
    };

    if (amount) {
      refundData.amount = Math.round(amount * 100); // Convert to cents
    }

    const refund = await stripe.refunds.create(refundData);

    // Update order status
    await Order.findOneAndUpdate(
      { PaymentIntentId: paymentIntentId },
      { Status: "refunded" }
    );

    return res.status(200).json({
      message: "Refund processed successfully",
      refundId: refund.id,
      amount: refund.amount / 100,
      status: refund.status,
    });
  } catch (error) {
    console.error("refundPayment:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

module.exports = {
  createPaymentIntent,
  confirmPayment,
  getPaymentStatus,
  handleWebhook,
  refundPayment,
};
