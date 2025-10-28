import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  downloadWorkorders,
  getWorkorderDetails,
  getWorkorders,
  getWorkordersHistory
} from "../controllers/workorders.controller";
import { requirePermission } from "../middleware/auth0.middleware";

const router = Router();

router.get(
  "/getWorkorders",
  requirePermission("read:work-orders"),
  asyncHandler( getWorkorders)
);
router.get("/getWorkorderDetails", 
  requirePermission("read:work-order-details"),
  asyncHandler(getWorkorderDetails));
  
router.post("/downloadWorkorders", 
  requirePermission("download:work-orders"),
  asyncHandler(downloadWorkorders));

  router.get("/getWorkordersHistory", asyncHandler(getWorkordersHistory));

export default router;