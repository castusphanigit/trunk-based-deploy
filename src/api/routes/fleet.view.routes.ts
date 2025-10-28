import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  getListView,
  getEquipmentDetails,
  downloadListView,
  getTelematics,
  getEquipmentGateInspections,
} from "../controllers/fleet.view.controller";
import { requirePermission } from "../middleware/auth0.middleware";
const router = Router();

router.get(
  "/getListView",
  requirePermission("read:fleet-list-view"),
  asyncHandler(getListView)
);

router.get(
  "/getEquipmentDetails",
  requirePermission("read:fleet-list-view-details"),
  asyncHandler(getEquipmentDetails)
);

router.post(
  "/downloadListView",
  requirePermission("download:fleet-list-view"),
  asyncHandler(downloadListView)
);

router.get(
  "/getEquipmentGateInspections",
  // requirePermission("read:fleet-list-view-details"),
  asyncHandler(getEquipmentGateInspections)
);

router.get("/:unitNumber", asyncHandler(getTelematics));
export default router;
