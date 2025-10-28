import sgMail, { MailDataRequired } from "@sendgrid/mail";
import ejs from "ejs";
import path from "path";
import fs from "fs";
import logger from "../utils/logger";

// Environment variables
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;
const LOGO_URL = process.env.LOGO_URL;
const FRONTEND_URL = process.env.FRONTEND_URL;

// Set API key
if (!SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY is not defined in environment variables");
}
sgMail.setApiKey(SENDGRID_API_KEY);

interface WelcomeEmailData {
  name: string;
  to: string
}

export const sendWelcomeEmail = async (
  to: string,
  data: WelcomeEmailData
) => {
  if (!SENDGRID_FROM_EMAIL) {
    throw new Error(
      "SENDGRID_FROM_EMAIL is not defined in environment variables"
    );
  }

  try {
    // 1. Load your EJS template file
    const templatePath = path.join(
      __dirname,
      "../views/emails/auth0welcome.ejs"
    );
    const template = fs.readFileSync(templatePath, "utf-8");

    // 2. Render the template with dynamic data
    const htmlContent = ejs.render(template, {
      data,
      process: {
        env: {
          LOGO_URL,
          FRONTEND_URL,
        },
      },
    });

    // 3. Send the email
    const msg: MailDataRequired = {
      to,
      from: SENDGRID_FROM_EMAIL,
      subject: "Welcome to Next Gen 🎉",
      html: htmlContent,
    };

    await sgMail.send(msg);
    logger.info("Welcome email sent to", to);
  } catch (error: unknown) {
    logger.error("SendGrid error:", error);

    if (error && typeof error === 'object' && 'response' in error) {
      const sendGridError = error as { response: { body: unknown } };
      logger.error("SendGrid response error:", sendGridError.response.body);
    }
  }
};
