export const uploadMiddleware = (upload) => {
  return (req, res, next) => {
    upload(req, res, function (err) {
      if (err) {
        console.error("MULTER ERROR:", err);
        return res.status(500).json({
          message: "Image upload failed",
        });
      }
      next();
    });
  };
};
