const express = require("express");
const router = express.Router();
const upload = require("../Helpers/upload");
const cloudinary = require("../Helpers/cloudinary");

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file.path;

    const result = await cloudinary.uploader.upload(file, {
      resource_type: "auto", 
    });

    res.json({ url: result.secure_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
