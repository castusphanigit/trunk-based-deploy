import { Router } from "express";
import {
  createAlertCategory,
  getAllAlertCategories,
  getAlertCategoryById,
} from "../controllers/alert.category.lookup.controller";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

router.post("/", asyncHandler(createAlertCategory));
router.get("/", asyncHandler(getAllAlertCategories));
router.get("/:id", asyncHandler(getAlertCategoryById));

export default router;
