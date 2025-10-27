const stripe = require("../Helpers/stripe");
const Order = require("../models/Order");
const Book = require("../models/Book");
const User = require("../models/User");
const Joi = require("joi");
const mongoose = require("mongoose");
const SocketManager = require("../SocketManager");

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

    const amountInCents = Math.round(totalPrice * 100);

    if (amountInCents < 50) {
      return res.status(400).json({
        message: "Total amount must be at least $0.50",
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      metadata: {
        userId: userId.toString(),
        books: JSON.stringify(Books),
        bookDetails: JSON.stringify(bookDetails),
      },
      payment_method_types: ["card"],
      automatic_payment_methods: {
        enabled: false,
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

    const books = JSON.parse(paymentIntent.metadata.books);
    const totalPrice = paymentIntent.amount / 100;

    let order = null;
    let transactionError = null;

    try {
      await session.withTransaction(async () => {
        for (let i = 0; i < books.length; i++) {
          const item = books[i];
          const book = await Book.findById(item.BookId).session(session);

          if (!book) {
            transactionError = `Book not found at index ${i}`;
            return false;
          }

          const qtyNum = Number(item.Quantity);

          if (qtyNum < 1) {
            transactionError = `Invalid quantity at index ${i}`;
            return false;
          }

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
            transactionError = `Insufficient stock for "${book.Title}" at index ${i}`;
            return false;
          }
        }

        const orderResult = await Order.create(
          [
            {
              _id: new mongoose.Types.ObjectId(),
              User: user._id,
              Books: books,
              TotalPrice: totalPrice,
              Status: "completed",
              PaymentIntentId: paymentIntentId,
              CreatedAt: new Date().toISOString(),
              __v: 0,
            },
          ],
          { session }
        );

        order = orderResult[0];
        return true;
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

module.exports = {
  createPaymentIntent,
  processPayment,
};
