const Review = require("../models/Review")

const Book = require("../models/Book");
const { CheckForUser } = require("../Helpers/Login.Helper");


async function CreateReview(req,res) {
    try {

     const CheckUser = await CheckForUser(req, res);
    if (!CheckUser) return;

   const { BookId, Rating, Review: ReviewTextFromBody } = req.body;
     if (BookId === undefined || BookId === null) {
      return res.status(400).json({ message: "BookId is required" });
    }
  

    if (Rating === undefined || Rating === null) {
      return res.status(400).json({ message: "Rating is required" });
    }
    const RatingNum = Number(Rating);
    if (!Number.isInteger(RatingNum) || RatingNum < 1 || RatingNum > 10) {
      return res.status(400).json({ message: "Rating must be an integer between 1 and 10" });
    }

    let ReviewText = "";

if (ReviewTextFromBody !== undefined && ReviewTextFromBody!== null) {
  ReviewText = String(ReviewTextFromBody).trim();

  if (ReviewText.length > 1000) {
    return res.status(400).json({ message: "Review must be at most 1000 characters" });
  }
}

  
    const foundBook = await Book.findById(BookId).select({ _id: 1 });
    if (!foundBook) {
      return res.status(404).json({ message: "Book not found" });
    }

   
    const exists = await Review.findOne({ User: CheckUser._id, Book: BookId });
    if (exists) {
      return res.status(409).json({ message: "You have already reviewed this book" });
    }

  
    const created = await Review.create({
      User: CheckUser._id,
      Book: BookId,
      Rating: RatingNum,
      Review: ReviewText
      
    });

   
    return res.status(201).json({
      message: "Review added successfully",
      reviewId: created._id,
      bookId: String(BookId),
      rating: created.Rating
    });

        
    } catch (error) {
        console.error("CreateReview:", error);
    res.status(500).json({ message: error.message });
    }
    
}

async function GetBookReviews(req, res) {
  try {
    const CheckUser = await CheckForUser(req, res);
    if (!CheckUser) return;

    const BookId = req.params.id;
      if (!BookId) {
      return res.status(400).json({ message: "Book id is required" });
    }

    const reviews = await Review.find({ Book: BookId });
      return res.status(200).json(reviews);
  }catch (error) {
        console.error("GetBookReviews:", error);
    res.status(500).json({ message: error.message });
    }
  
  
  }
 async function EditReview(req, res) {
  try {
    const CheckUser = await CheckForUser(req, res);
    if (!CheckUser) return;

    const ReviewData = req.params.id;
    if (!ReviewData ) {
      return res.status(400).json({ message: "Review id is required" });
    }

    const UpdateRating = req.body.Rating;
    const UpdateReview = req.body.Review;

    const HasRating = UpdateRating !== undefined && UpdateRating !== null;
    const HasText = UpdateReview !== undefined && UpdateReview !== null;

    if (!HasRating && !HasText) {
      return res.status(400).json({ message: "Nothing to update (provide Rating and/or Review)" });
    }

    const CheckId = await Review.findById(ReviewData);
    if (!CheckId) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (String(CheckId.User) !== String(CheckUser._id)) {
      return res.status(403).json({ message: "Not allowed to update this review" });
    }

    if (HasRating) {
      const RatingNum = Number(UpdateRating);
      if (!Number.isInteger(RatingNum) || RatingNum < 1 || RatingNum > 10) {
        return res.status(400).json({ message: "Rating must be an integer between 1 and 10" });
      }
      CheckId.Rating = RatingNum;
    }

    if (HasText) {
      let ReviewText = String(UpdateReview).trim();
      if (ReviewText.length > 1000) {
        return res.status(400).json({ message: "Review must be at most 1000 characters" });
      }
      CheckId.Review = ReviewText;
    }

    await CheckId.save();

    return res.status(200).json({
      message: "Review updated successfully",
      reviewId: CheckId._id,
      rating: CheckId.Rating,
      review: CheckId.Review
    });
  } catch (error) {
    console.error("EditReview:", error);
    return res.status(500).json({ message: error.message });
  }
}

async function DeleteReview(req,res) {
  try{
     const CheckUser = await CheckForUser(req, res);
    if (!CheckUser) return;

      const ReviewData = req.params.id;
    if (!ReviewData ) {
      return res.status(400).json({ message: "Review id is required" });
    }
     const CheckId = await Review.findById(ReviewData);
    if (!CheckId) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (String(CheckId.User) !== String(CheckUser._id)) {
      return res.status(403).json({ message: "Not allowed to delete this review" });
    }
    const Deleted = await Review.findByIdAndDelete(ReviewData)
        if (!Deleted) {
          return res.status(404).json({ message: "Review not found" });
        }
        return res.status(200).json({ message: "Review deleted successfully" });
  }catch(error){
    console.error("DeleteReview",error)
    return res.status(500).json({ message: error.message });
    
  }
}


module.exports={CreateReview, GetBookReviews,EditReview ,DeleteReview}