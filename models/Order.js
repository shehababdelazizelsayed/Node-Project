const mongoose = require("mongoose");
const schema = mongoose.Schema;

const orderSchema = new schema(
  {
    User: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    Books: [
      {
        BookId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Book",
          required: true,
        },
        Quantity: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],
    TotalPrice: {
      type: Number,
      required: true,
    },
    Status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
    PaymentIntentId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: "CreatedAt", updatedAt: false },
  }
);

module.exports = mongoose.model("Order", orderSchema);
