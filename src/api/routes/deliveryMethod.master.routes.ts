import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";

import {
  createDeliveryMethod,
  fetchDeliveryMethods,
  getDeliveryMethodById,
  updateDeliveryMethod,
} from "../controllers/delivery-method.controller";
import { requirePermission } from "../middleware/auth0.middleware";
const router = Router();

router.post("/", 
 requirePermission("write:telematics-alerts"), 
  asyncHandler(createDeliveryMethod));

router.get("/",
  requirePermission("read:telematics-activity-feed"),
  asyncHandler(fetchDeliveryMethods));
router.get("/:id",
  requirePermission("read:telematics-activity-feed-details"),
  asyncHandler(getDeliveryMethodById));
router.put("/:id", 
  requirePermission("patch:telematics-alerts"),
  asyncHandler(updateDeliveryMethod));
export default router;
