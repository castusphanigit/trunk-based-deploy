import { Router } from "express";
import { fileUpload } from "../controllers/fileupload.controller";
import { FileUploadToS3 } from "../../utils/s3.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
const router = Router();

// Allow up to 10 files
router.post("/upload", FileUploadToS3.array("files", 10), asyncHandler(fileUpload));

export default router;


// router.post("/upload", (req, res) => {
//   FileUploadToS3.array("files", 10)(req, res, (err: any) => {
//     if (err) {
//       console.error("Multer error:", err);
//       return res.status(400).send({
//         success: false,
//         message: "Upload failed",
//         error: err,
//       });
//     }

//     console.log("Files received:", req.files);
//     return res.status(200).send({
//       success: true,
//       message: "Files uploaded to S3",
//       data: req.files,
//     });
//   });
// });