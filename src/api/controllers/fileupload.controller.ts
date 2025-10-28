import { Request, Response } from "express";
import { processAndSaveFileUploads } from "../../services/fileupload.service";
import logger from "../../utils/logger";

interface FileUploadBody {
  mime_type: string;
  document_category_type: string;
  name: string;
  description: string
}

export const fileUpload = async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    const body = req.body as FileUploadBody;

    if (!files || files.length === 0) {
      return res.status(400).send({
        success: false,
        message: "No files uploaded",
      });
    }

    const uploadedFiles = await processAndSaveFileUploads(files, body);

    return res.status(200).send({
      success: true,
      message: "Files uploaded & saved successfully",
      data: uploadedFiles,
    });
  } catch (error) {
    logger.error("Upload error:", error);
    return res.status(500).send({
      success: false,
      message: "File upload failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
