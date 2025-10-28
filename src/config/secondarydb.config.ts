import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

// Proper type checking for environment variable
const secondaryDbUrl = process.env.SECOND_DATABASE_URL;
if (typeof secondaryDbUrl !== "string") {
  throw new Error("SECOND_DATABASE_URL environment variable is required");
}

export const secondaryPool = new Pool({
  connectionString: secondaryDbUrl,
});

// Test connection
export async function SecondaryConnection(): Promise<void> {
  const client = await secondaryPool.connect();
  try {
    const result = await client.query("SELECT NOW()");
    console.log(" Connected to secondary DB at:", result);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(" DB connection failed:", error.message);
    } else {
      console.error(" DB connection failed:", String(error));
    }
  } finally {
    client.release();
  }
}
