import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

export default prisma;

// (Optional) Export a function to log model structure
export const logModelStructure = (modelName: string) => {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === modelName);

  if (!model) {
    return;
  }
};
