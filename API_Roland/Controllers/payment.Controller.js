const stripe = require("../Helpers/stripe");
const Order = require("../models/Order");
const Book = require("../models/Book");
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

    let transactionError = null;

    try {
      await session.withTransaction(async () => {
        // Validate and update stock
        for (let i = 0; i < books.length; i++) {
          const item = books[i];
          const book = await Book.findById(item.BookId).session(session);

          if (!book) {
            transactionError = `Book not found at index ${i}`;
            return false; // This will trigger transaction abort
          }

          const qtyNum = Number(item.Quantity);

          if (qtyNum < 1) {
            transactionError = `Invalid quantity at index ${i}`;
            return false;
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
            transactionError = `Insufficient stock for "${book.Title}" at index ${i}`;
            return false;
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
        return true; // Commit the transaction
      });

      if (transactionError) {
        return res.status(400).json({
          message: transactionError,
        });
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

// Export only the required functions
module.exports = {
  createPaymentIntent,
  processPayment,
};
