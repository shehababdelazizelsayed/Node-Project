const stripe = require("../Helpers/stripe");
const Order = require("../models/Order");
const Book = require("../models/Book");
const User = require("../models/User");
const Joi = require("joi");
const mongoose = require("mongoose");
const SocketManager = require("../SocketManager");
const Cart = require("../models/Cart");

// Stripe Webhook Handler
async function stripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object;
      // TODO: Fulfill the purchase, create order, update DB, etc.
      console.log("Checkout session completed:", session.id);
      break;
    // Add more event types as needed
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.status(200).json({ received: true });
}

// Create Payment Intent
async function createPaymentIntent(req, res) {
  try {
    const userId = req.user.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const schema = Joi.object({
      CartId: Joi.string()
        .trim()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          "string.pattern.base": "CartId must be a valid ObjectId",
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

    const { CartId } = value;
    const cart = await Cart.findOne({ _id: CartId, User: userId }).populate({
      path: "Items.Book",
      select: "Title Price Stock",
    });

    if (!cart || !cart.Items.length) {
      return res.status(404).json({ message: "Cart not found or empty" });
    }
    let totalPrice = 0;
    const bookDetails = [];

    for (const item of cart.Items) {
      const book = item.Book;

      if (!book) {
        return res.status(404).json({ message: `Book not found in cart` });
      }
      if (book.Stock < item.Quantity) {
        return res.status(400).json({
          message: `Insufficient stock for "${book.Title}". Available: ${book.Stock}, Requested: ${item.Quantity}`,
        });
      }

      const itemTotal = book.Price * item.Quantity;
      totalPrice += itemTotal;

      bookDetails.push({
        bookId: book._id.toString(),
        title: book.Title,
        quantity: item.Quantity,
        price: book.Price,
      });
    }

    const amountInCents = Math.round(totalPrice * 100);

    if (amountInCents < 50) {
      return res.status(400).json({
        message: "Total amount must be at least $0.50",
      });
    }

    // Create Stripe Checkout Session and return session URL for UI redirect
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: cart.Items.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: item.Book.Title,
          },
          unit_amount: Math.round(item.Book.Price * 100),
        },
        quantity: item.Quantity,
      })),
      mode: "payment",
      success_url: `${process.env.URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL}/cancel`,
      metadata: {
        cartId: CartId,
        userId: userId,
      },
    });

    return res.status(200).json({
      message: "Stripe Checkout session created",
      url: session.url,
      sessionId: session.id,
      amount: totalPrice,
      amountInCents,
      books: bookDetails,
    });
  } catch (error) {
    console.error("createPaymentIntent error:", error);
    return res.status(500).json({
      message: error.message || "Failed to create Stripe Checkout session",
    });
  }
}

// Process Payment (Confirm with Stripe and Create Order)
async function processPayment(req, res) {
  const session = await mongoose.startSession();

  try {
    const userId = req.user.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

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

    const existingOrder = await Order.findOne({
      PaymentIntentId: paymentIntentId,
    });
    if (existingOrder) {
      return res.status(400).json({
        message: "Order already created for this payment",
        orderId: existingOrder._id,
      });
    }

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
    const cartId = paymentIntent.metadata.cartId;
    const books = JSON.parse(paymentIntent.metadata.books);
    const totalPrice = paymentIntent.amount / 100;

    let order = null;
    let transactionError = null;

    try {
      await session.withTransaction(async () => {
        for (const item of books) {
          const book = await Book.findById(item.bookId).session(session);

          if (!book) {
            transactionError = `Book not found: ${item.title}`;
            return;
          }

          if (book.Stock < item.quantity) {
            transactionError = `Insufficient stock for "${book.Title}"`;
            return;
          }

          await Book.updateOne(
            { _id: item.bookId, Stock: { $gte: item.quantity } },
            { $inc: { Stock: -item.quantity } },
            { session }
          );
        }

        if (transactionError) return;

        const orderResult = await Order.create(
          [
            {
              User: user._id,
              Books: books.map((b) => ({
                BookId: b.bookId,
                Quantity: b.quantity,
              })),
              TotalPrice: totalPrice,
              Status: "completed",
              PaymentIntentId: paymentIntentId,
              CreatedAt: new Date().toISOString(),
            },
          ],
          { session }
        );

        order = orderResult[0];

        await Cart.updateOne(
          { _id: cartId, User: userId },
          {
            $pull: {
              Items: { Book: { $in: books.map((b) => b.bookId) } },
            },
          },
          { session }
        );
      });

      if (transactionError) {
        return res.status(400).json({
          message: transactionError,
        });
      }

      try {
        const admins = await User.find({ Role: { $in: ["Admin", "Owner"] } });

        const notificationPayload = {
          type: "payment_success",
          message: `New payment received from ${user.Name}`,
          data: {
            orderId: order._id,
            userId: user._id,
            userName: user.Name,
            userEmail: user.Email,
            totalAmount: `$${totalPrice.toFixed(2)}`,
            itemCount: books.length,
            timestamp: new Date().toISOString(),
          },
        };

        // Broadcast to all connected admins
        for (const admin of admins) {
          SocketManager.notifyUser(
            admin._id.toString(),
            "payment_notification",
            notificationPayload
          );
        }

        console.log(`[Payment Notification] Sent to ${admins.length} admin(s)`);
      } catch (notificationError) {
        console.error("[Payment Notification Error]", notificationError);
        // Don't fail the payment if notification fails
      }

      return res.status(201).json({
        message: "Payment confirmed and order created successfully",
        success: true,
        orderId: order._id,
        total: order.TotalPrice,
        paymentIntentId: paymentIntentId,
        status: order.Status,
        paymentStatus: paymentIntent.status,
      });
    } catch (error) {
      console.error("Transaction error:", error);

      return res.status(500).json({
        message: "Transaction failed",
        error: error.message,
      });
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

// Verify Checkout Session and create order locally if paid
async function verifySession(req, res) {
  const mongooseSession = await mongoose.startSession();
  try {
    const userId = req.user && req.user.userId;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const schema = Joi.object({
      sessionId: Joi.string().trim().required(),
    });
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.details.map((d) => d.message.replace(/\"/g, "")),
      });
    }

    const { sessionId } = value;

    let stripeSession;
    try {
      stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (err) {
      console.error("Failed to retrieve Stripe session:", err);
      return res.status(400).json({ message: "Invalid sessionId" });
    }

    if (!stripeSession) {
      return res.status(404).json({ message: "Session not found" });
    }

    // ensure session belongs to the same user (if metadata present)
    const metaUserId = stripeSession.metadata && stripeSession.metadata.userId;
    if (metaUserId && metaUserId !== userId) {
      return res
        .status(403)
        .json({ message: "Session does not belong to this user" });
    }

    if (stripeSession.payment_status !== "paid") {
      return res.status(400).json({
        message: "Payment not completed",
        status: stripeSession.payment_status,
      });
    }

    const paymentIntentId = stripeSession.payment_intent;
    if (!paymentIntentId) {
      return res
        .status(400)
        .json({ message: "No payment intent associated with session" });
    }

    const existingOrder = await Order.findOne({
      PaymentIntentId: paymentIntentId,
    });
    if (existingOrder) {
      return res
        .status(200)
        .json({ message: "Order already created", orderId: existingOrder._id });
    }

    const cartId = stripeSession.metadata && stripeSession.metadata.cartId;
    if (!cartId) {
      return res
        .status(400)
        .json({ message: "No cartId found in session metadata" });
    }

    const cart = await Cart.findOne({ _id: cartId, User: userId }).populate({
      path: "Items.Book",
      select: "Title Price Stock",
    });
    if (!cart || !cart.Items.length) {
      return res.status(404).json({ message: "Cart not found or empty" });
    }

    const books = cart.Items.map((it) => ({
      bookId: it.Book._id.toString(),
      title: it.Book.Title,
      quantity: it.Quantity,
      price: it.Book.Price,
    }));
    const totalPrice = books.reduce((s, b) => s + b.price * b.quantity, 0);

    let order = null;
    let transactionError = null;

    try {
      await mongooseSession.withTransaction(async () => {
        for (const item of books) {
          const bookDoc = await Book.findById(item.bookId).session(
            mongooseSession
          );
          if (!bookDoc) {
            transactionError = `Book not found: ${item.title}`;
            return;
          }
          if (bookDoc.Stock < item.quantity) {
            transactionError = `Insufficient stock for \"${bookDoc.Title}\"`;
            return;
          }

          await Book.updateOne(
            { _id: item.bookId, Stock: { $gte: item.quantity } },
            { $inc: { Stock: -item.quantity } },
            { session: mongooseSession }
          );
        }

        if (transactionError) return;

        const orderResult = await Order.create(
          [
            {
              User: userId,
              Books: books.map((b) => ({
                BookId: b.bookId,
                Quantity: b.quantity,
              })),
              TotalPrice: totalPrice,
              Status: "completed",
              PaymentIntentId: paymentIntentId,
              CreatedAt: new Date().toISOString(),
            },
          ],
          { session: mongooseSession }
        );

        order = orderResult[0];

        await Cart.updateOne(
          { _id: cartId, User: userId },
          { $pull: { Items: { Book: { $in: books.map((b) => b.bookId) } } } },
          { session: mongooseSession }
        );
      });

      if (transactionError) {
        return res.status(400).json({ message: transactionError });
      }

      try {
        const admins = await User.find({ Role: { $in: ["Admin", "Owner"] } });
        const notificationPayload = {
          type: "payment_success",
          message: `New payment received from ${userId}`,
          data: {
            orderId: order._id,
            userId: userId,
            totalAmount: `$${totalPrice.toFixed(2)}`,
            itemCount: books.length,
            timestamp: new Date().toISOString(),
          },
        };
        for (const admin of admins) {
          SocketManager.notifyUser(
            admin._id.toString(),
            "payment_notification",
            notificationPayload
          );
        }
      } catch (notificationError) {
        console.error("[Payment Notification Error]", notificationError);
      }

      return res.status(201).json({
        success: true,
        message: "Payment verified and order created",
        orderId: order._id,
        total: order.TotalPrice,
      });
    } catch (err) {
      console.error("verifySession transaction error:", err);
      return res
        .status(500)
        .json({ message: "Transaction failed", error: err.message });
    }
  } catch (error) {
    console.error("verifySession error:", error);
    return res
      .status(500)
      .json({ message: error.message || "Failed to verify session" });
  } finally {
    mongooseSession.endSession();
  }
}

module.exports = {
  createPaymentIntent,
  processPayment,
  stripeWebhook,
  verifySession,
};
