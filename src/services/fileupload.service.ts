import prisma from "../config/database.config";
import { uploadFileToS3 } from "../utils/s3.middleware";
import { AttachmentInput } from "../types/dtos/agreement.dto";

interface FileUploadBody {
  mime_type: string;
  document_category_type: string;
  name: string;
  description: string
}

export const processAndSaveFileUploads = async (
  files: Express.Multer.File[],
  body: FileUploadBody
) => {
  const uploadedFiles: AttachmentInput[] = [];

  for (const file of files) {
    const uploaded = await uploadFileToS3(file);

    uploadedFiles.push({
      url: uploaded.url,
      mime_type: body.mime_type,
      document_category_type: body.document_category_type,
      name: body.name,
      description: body.description,
    });
  }

  // save all in one query
  await prisma.attachment.createMany({
    data: uploadedFiles.map(file => ({
      ...file,
      date_uploaded: new Date(),
    })),
  });

  return uploadedFiles;
};

