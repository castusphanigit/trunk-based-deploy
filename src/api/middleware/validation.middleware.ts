import { validationResult, ValidationChain } from "express-validator";
import { Request, Response, NextFunction } from "express";

export const withValidation = (validators: ValidationChain[]) => [
  ...validators,
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    next();
  },
];
