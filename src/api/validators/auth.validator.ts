import { body } from "express-validator";

export const loginValidator = [
  body("auth_0_reference_id").isString().notEmpty(),
];
export const exchangeTokenValidator = [body("code").isString().notEmpty()];
