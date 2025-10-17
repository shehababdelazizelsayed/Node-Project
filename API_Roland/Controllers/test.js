const session = await mongoose.startSession();
let totalPrice = 0;
let created = null;
try {
  await session.withTransaction(async () => {
    totalPrice = 0;
    for (let i = 0; i < body.Books.length; i) {

      const item = body.Books[i];

      if (!item || !item.BookId) {

        throw new Error("VALIDATION_MISSING_BOOKID_"
          i);
      }

      const book = await Book.findById(item.BookId).session(session);
      if (!book) {

        throw new Error("NOT_FOUND_"
          i);
      }

      const qtyNum = Number(item.Quantity);
      if (book.Stock == null || qtyNum < 1) {

        throw new Error("INVALID_QTY_"
          i);
      }

      const reserve = await Book.updateOne({
        _id: item.BookId,
        Stock: {
          $gte: qtyNum
        }
      }, {
        $inc: {
          Stock: -qtyNum
        }
      }, {
        session
      });
      if (reserve.matchedCount === 0 || reserve.modifiedCount === 0) {

        throw new Error("INSUFFICIENT_STOCK_"
          i);
      }
      totalPrice = totalPrice(Number(book.Price) * qtyNum);
    }
    totalPrice = Number(totalPrice.toFixed(2));
    created = await Order.create([{
      User: CheckUser._id,
      Books: body.Books.map(Item => ({
        BookId: Item.BookId,
        Quantity: Number(Item.Quantity)
      })),
      TotalPrice: totalPrice,
      Status: "pending"
    }], {
      session
    });
    created = created[0];
  });
} catch (trxErr) {
  // خرّج رسائل مناسبة حسب الخطأ الملقى

  if (typeof trxErr.message === "string") {

    if (trxErr.message.startsWith("VALIDATION_MISSING_BOOKID_")) {

      const i = trxErr.message.split("_").pop();
      return res.status(400).json({
        message: "Book not BookId is required at index "
        i
      });
    }
    if (trxErr.message.startsWith("NOT_FOUND_")) {

      const i = trxErr.message.split("_").pop();
      return res.status(404).json({
        message: "Book not found "
        i
      });
    }
    if (trxErr.message.startsWith("INVALID_QTY_")) {

      const i = trxErr.message.split("_").pop();
      return res.status(400).json({
        message: "Not enough stock"
        i
      });
    }
    if (trxErr.message.startsWith("INSUFFICIENT_STOCK_")) {

      const i = trxErr.message.split("_").pop();
      return res.status(400).json({
        message: "Not enough stock"
        i
      });
    }
  }
  throw trxErr; // يُلتقط في الـ catch الخارجي

} finally {
  session.endSession();
} // ---- END TRANSACTIONAL ORDER CREATION ----


return res.status(201).json({
  message: "Order placed",
  orderId: created._id,
  total: created.TotalPrice
});
