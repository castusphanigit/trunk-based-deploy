import { asyncHandler } from "./../../utils/asyncHandler";
import { Router } from "express";
import {
  loginHandler,
  exchangeTokenHandler,
} from "../controllers/auth.controller";

const router = Router();

router.post("/login", asyncHandler(loginHandler));
router.post("/exchangeToken", asyncHandler(exchangeTokenHandler));

export default router;
