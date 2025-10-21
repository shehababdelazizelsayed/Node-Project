const mongoose = require("mongoose");
const schema = mongoose.Schema;

const orderSchema = new schema({
  User: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  Books: [
    {
      BookId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Book",
      },
      Quantity: {
        type: Number,
        default: 1,
      },
    },
  ],
  TotalPrice: {
    type: Number,
    required: true,
  },
  Status: {
    type: String,
    enum: ["pending", "completed", "cancelled", "refunded"],
    default: "pending",
  },
  PaymentProvider: {
    type: String,
    enum: ["PayPal", "Cash"],
    default: "Cash",
  },
  PaymentStatus: {
    type: String,
    enum: ["unpaid", "paid", "refunded"],
    default: "unpaid",
  },
  PayPalOrderId: {
    type: String,
  },
  PayPalCaptureId: {
    type: String,
  },
  StoreId: {
    type: String,
    default: "BOOKSTORE_001",
  },
  ReferenceId: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  CompletedAt: {
    type: Date,
  },
});

module.exports = mongoose.model("Order", orderSchema);
