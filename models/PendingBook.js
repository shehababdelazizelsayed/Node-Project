const mongoose = require("mongoose");
const schema = mongoose.Schema;

const pendingBookSchema = new schema({
  Title: {
    type: String,
    required: true,
  },
  Author: {
    type: String,
    required: true,
  },
  Price: {
    type: Number,
    required: true,
  },
  Description: {
    type: String,
    required: true,
  },
  Stock: {
    type: Number,
    min: 0,
    default: 0,
  },
  Image: {
    type: String,
  },
  Pdf: {
    type: String,
  },
  Category: {
    type: String,
    required: true,
  },
  Owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  Status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  AdminComment: {
    type: String,
    default: "",
  },
  SubmittedAt: {
    type: Date,
    default: Date.now,
  },
  ReviewedAt: {
    type: Date,
  },
  ReviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }
});

module.exports = mongoose.model("PendingBook", pendingBookSchema);
