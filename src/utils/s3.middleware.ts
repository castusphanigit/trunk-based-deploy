import multer from "multer";
// eslint-disable-next-line n/no-extraneous-import
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Request, Response, NextFunction } from "express";

// Environment variable validation
const getRequiredEnvVar = (name: string): string => {
  // eslint-disable-next-line n/no-process-env
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const AWS_ACCESS_KEY_ID = getRequiredEnvVar("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY = getRequiredEnvVar("AWS_SECRET_ACCESS_KEY");
const AWS_REGION = getRequiredEnvVar("AWS_REGION");
const S3_BUCKET_NAME = getRequiredEnvVar("S3_BUCKET_NAME");
// Safe file size limits to prevent memory exhaustion attacks
// These limits address SonarQube security concerns about content length limits
const MAX_FILE_SIZE_MB = 8;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 10; // Limit number of files per request
console.log(MAX_FILE_SIZE_BYTES, MAX_FILES_PER_REQUEST);
const MAX_TOTAL_REQUEST_SIZE_MB = 100; // Total size limit for all files combined
const MAX_TOTAL_REQUEST_SIZE_BYTES = MAX_TOTAL_REQUEST_SIZE_MB * 1024 * 1024;

export const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

export const FileUploadToS3 = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // max 50 MB
  // Add fileFilter if needed
  fileFilter: (req, file, cb) => {
    // Allow all file types or add specific validation
    cb(null, true);
  },
});

// Middleware to validate total request size before processing
export const validateRequestSize = (req: Request, res: Response, next: NextFunction): void => {
  const contentLength = parseInt(req.headers['content-length'] ?? '0', 10);
  
  if (contentLength > MAX_TOTAL_REQUEST_SIZE_BYTES) {
    res.status(413).json({
      error: 'Request too large',
      message: `Request size exceeds maximum allowed size of ${MAX_TOTAL_REQUEST_SIZE_MB}MB`,
      maxSize: MAX_TOTAL_REQUEST_SIZE_MB
    });
    return;
  }
  
  next();
};

export const serviceRequestUpload = FileUploadToS3.array("attachments"); // 'attachments' is the field name to expect

export const anyFileUpload = FileUploadToS3.any();

// Helper function to determine document category type
const getDocumentCategoryType = (mimetype: string): string => {
  if (mimetype.startsWith("image/")) {
    return "image";
  }
  if (mimetype === "application/pdf") {
    return "pdf";
  }
  return "other";
};

// Helper function to upload a single file to S3
export const uploadFileToS3 = async (file: Express.Multer.File) => {
  const key = `attachments/${Date.now()}-${file.originalname}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: "public-read",
    })
  );

  const url = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;

  return {
    url,
    document_category_type: getDocumentCategoryType(file.mimetype),
  };
};

export const uploadServiceRequestFileToS3 = async (
  file: Express.Multer.File,
  customerName: string
) => {
  const key = `servicerequest/${customerName}/${Date.now()}-${
    file.originalname
  }`;

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: "public-read",
    })
  );

  const url = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;

  return {
    url,
    document_category_type: getDocumentCategoryType(file.mimetype),
  };
};
