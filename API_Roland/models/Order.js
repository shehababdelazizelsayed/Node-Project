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
    enum: ["pending", "completed", "refunded", "cancelled"],
    default: "pending",
  },
  PaymentIntentId: {
    type: String,
    default: null,
  },
  CreatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Order", orderSchema);
