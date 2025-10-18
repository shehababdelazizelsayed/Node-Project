const multer = require("multer");
const {cloudinaryStorage} = require("./cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// store in cloudinary
const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder:"bookstore_uploads",
        allowed_formats: ["jpg","png","jpeg","webp"]
    }
})

const upload = multer({storage});

module.exports = upload;