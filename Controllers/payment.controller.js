const { client, storeInfo } = require("../config/paypal");
const checkoutNodeJssdk = require("@paypal/checkout-server-sdk");
const Order = require("../models/Order");
const Book = require("../models/Book");
const User = require("../models/User");
const Joi = require("joi");
const mongoose = require("mongoose");

// Create PayPal Order
async function createPayPalOrder(req, res) {
  try {
    console.log("req.user:", req.user); // ← ADD THIS
    console.log("req.body:", req.body);
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

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

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.details.map((d) => d.message.replace(/"/g, "")),
      });
    }

    const body = value;

    // Calculate total price
    let totalPrice = 0;
    const bookDetails = [];

    for (let i = 0; i < body.Books.length; i++) {
      const item = body.Books[i];
      const book = await Book.findById(item.BookId);

      if (!book) {
        return res.status(404).json({
          message: `Book not found at index ${i}`,
        });
      }

      if (book.Stock < item.Quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${book.Title}`,
        });
      }

      const itemTotal = Number(book.Price) * Number(item.Quantity);
      totalPrice += itemTotal;

      bookDetails.push({
        name: book.Title,
        description: `by ${book.Author}`,
        sku: book._id.toString(),
        unit_amount: {
          currency_code: storeInfo.currency,
          value: book.Price.toFixed(2),
        },
        quantity: item.Quantity.toString(),
        category: "PHYSICAL_GOODS",
      });
    }

    // Create PayPal order request
    const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: `${storeInfo.storeId}_${Date.now()}`,
          description: `Order from ${storeInfo.storeName}`,
          custom_id: user._id.toString(),
          soft_descriptor: storeInfo.storeName,
          amount: {
            currency_code: storeInfo.currency,
            value: totalPrice.toFixed(2),
            breakdown: {
              item_total: {
                currency_code: storeInfo.currency,
                value: totalPrice.toFixed(2),
              },
            },
          },
          items: bookDetails,
          payee: {
            email_address: storeInfo.storeEmail,
          },
        },
      ],
      application_context: {
        brand_name: storeInfo.storeName,
        locale: "en-US",
        landing_page: "NO_PREFERENCE",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        return_url: `${process.env.BASE_URL}/api/payment/success`,
        cancel_url: `${process.env.BASE_URL}/api/payment/cancel`,
      },
    });

    // Call PayPal to create order
    const order = await client().execute(request);

    // Store order details temporarily
    const pendingOrder = await Order.create({
      User: user._id,
      Books: body.Books.map((Item) => ({
        BookId: Item.BookId,
        Quantity: Number(Item.Quantity),
      })),
      TotalPrice: Number(totalPrice.toFixed(2)),
      Status: "pending",
      PaymentProvider: "PayPal",
      PayPalOrderId: order.result.id,
      StoreId: storeInfo.storeId,
      ReferenceId: `${storeInfo.storeId}_${Date.now()}`,
    });

    return res.status(201).json({
      message: "PayPal order created",
      orderId: order.result.id,
      approvalUrl: order.result.links.find((link) => link.rel === "approve")
        .href,
      pendingOrderId: pendingOrder._id,
      storeId: storeInfo.storeId,
    });
  } catch (error) {
    console.error("CreatePayPalOrder:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

// Capture PayPal Payment
async function capturePayPalOrder(req, res) {
  try {
    // Get user from JWT token
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const schema = Joi.object({
      orderId: Joi.string().required(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.details.map((d) => d.message.replace(/"/g, "")),
      });
    }

    const { orderId } = value;

    // Find the pending order
    const pendingOrder = await Order.findOne({
      PayPalOrderId: orderId,
      User: user._id,
      Status: "pending",
      StoreId: storeInfo.storeId,
    });

    if (!pendingOrder) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    // Capture the payment
    const request = new checkoutNodeJssdk.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});

    const capture = await client().execute(request);

    if (capture.result.status === "COMPLETED") {
      // Use transaction to update stock and order status
      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          // Update book stock
          for (let i = 0; i < pendingOrder.Books.length; i++) {
            const item = pendingOrder.Books[i];
            const book = await Book.findById(item.BookId).session(session);

            if (!book || book.Stock < item.Quantity) {
              throw new Error(`Insufficient stock for book at index ${i}`);
            }

            await Book.updateOne(
              { _id: item.BookId, Stock: { $gte: item.Quantity } },
              { $inc: { Stock: -item.Quantity } },
              { session }
            );
          }

          // Update order status
          pendingOrder.Status = "completed";
          pendingOrder.PaymentStatus = "paid";
          pendingOrder.PayPalCaptureId = capture.result.id;
          pendingOrder.CompletedAt = new Date();
          await pendingOrder.save({ session });
        });

        return res.status(200).json({
          message: "Payment successful",
          order: pendingOrder,
          captureId: capture.result.id,
          storeId: storeInfo.storeId,
        });
      } catch (trxError) {
        console.error("Transaction error:", trxError);
        return res.status(500).json({
          message: "Failed to complete order",
        });
      } finally {
        session.endSession();
      }
    } else {
      return res.status(400).json({
        message: "Payment not completed",
        status: capture.result.status,
      });
    }
  } catch (error) {
    console.error("CapturePayPalOrder:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

// Get order status
async function getOrderStatus(req, res) {
  try {
    // Get user from JWT token
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const schema = Joi.object({
      orderId: Joi.string().hex().length(24).required(),
    });

    const { error, value } = schema.validate(req.params);
    if (error) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const order = await Order.findOne({
      _id: value.orderId,
      User: user._id,
    }).populate("Books.BookId", "Title Author Price");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    return res.status(200).json({
      order,
      storeInfo: {
        storeId: order.StoreId,
        storeName: storeInfo.storeName,
      },
    });
  } catch (error) {
    console.error("GetOrderStatus:", error);
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  createPayPalOrder,
  capturePayPalOrder,
  getOrderStatus,
};
