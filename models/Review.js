const mongoose = require("mongoose");
const schema = mongoose.Schema;

const reviewSchema = new schema({
  User: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  Book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Book",
  },
  Rating: {
    type: Number,
    min: 1,
    max: 10,
  },
  Review: {
    type: String,
    maxlength: 1000,
  },
  CreatedAT: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Review", reviewSchema);
