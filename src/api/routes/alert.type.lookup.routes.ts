import { Router } from "express";
import {
  createAlertType,
  getAllAlertTypes,
  getAlertTypesByCategoryId,
} from "../controllers/alert.type.lookup.controller";
import { asyncHandler } from "../../utils/asyncHandler";
import { requirePermission } from "../middleware/auth0.middleware";
const router = Router();

// POST - Create Alert Type
router.post("/", asyncHandler(createAlertType));

// GET - All Alert Types
router.get("/", 
 requirePermission("read:telematics-activity-feed"),
  asyncHandler(getAllAlertTypes));

// GET - Alert Types by CategoryId
router.get("/category/:categoryId", 
  requirePermission("read:telematics-activity-feed"),
  asyncHandler(getAlertTypesByCategoryId));

export default router;
