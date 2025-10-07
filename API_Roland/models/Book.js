const mongoose = require("mongoose");
const schema = mongoose.Schema;

const bookSchema = new schema({
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
  Reviews: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review",
    },
  ],
});

module.exports = mongoose.model("Book", bookSchema);
