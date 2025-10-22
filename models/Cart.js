const mongoose = require("mongoose");
const schema = mongoose.Schema;

const cartSchema = new schema({
  User: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  Items: [
    {
      Book: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Book",
        required: true,
      },
      Quantity: {
        type: Number,
        default: 1,
        min: 1,
      },
    },
  ],
});

module.exports = mongoose.model("Cart", cartSchema);
