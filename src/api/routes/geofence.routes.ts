import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createGeofenceCtrl,
  // downloadGeofenceByCustIdCtrl,
  downloadGeofenceByUserIdCtrl,
  getAllGeofencePolygons,
  // getGeofenceByCustIdCtrl,
  getGeofenceByIdCtrl,
  getGeofenceByUserIdCtrl,
  getGeofenceCountsCtrl,
  toggleGeofenceStatus,
  updateGeofenceCtrl,
} from "../controllers/geofence.controller"; // adjust path as needed
import { requirePermission } from "../middleware/auth0.middleware";

const router = Router();

router.post("/", 
  requirePermission("write:geofence"),
  asyncHandler(createGeofenceCtrl));

// Add this in your routes file
router.patch("/:id", 
  requirePermission("patch:geofence"),
  asyncHandler(updateGeofenceCtrl));

router.get("/:id", 
  requirePermission("read:geofence-list-view-details"),
  asyncHandler(getGeofenceByIdCtrl));

// Customer-first routes: custId required, userId optional
router.get(
  "/customer/:custId/user/:userId?",
  asyncHandler(getGeofenceByUserIdCtrl)
);
router.get("/customer/:custId",
  requirePermission("read:geofence-list-view-details"),
  asyncHandler(getGeofenceByUserIdCtrl));
router.get(
  "/allPolygons/customer/:custId/user/:userId?",
  requirePermission("read:geofence-list-view"),
  asyncHandler(getAllGeofencePolygons)
);
router.get(
  "/allPolygons/customer/:custId",
  requirePermission("read:geofence-list-view"),
  asyncHandler(getAllGeofencePolygons)
);
router.get(
  "/count/customer/:custId/user/:userId?",
  asyncHandler(getGeofenceCountsCtrl)
);
router.get("/count/customer/:custId",
  requirePermission("read:geofence-list-view"),
  asyncHandler(getGeofenceCountsCtrl));

router.post(
  "/download/customer/:custId/user/:userId?",
  asyncHandler(downloadGeofenceByUserIdCtrl)
);
router.post(
  "/download/customer/:custId",
  requirePermission("download:geofence"),
  asyncHandler(downloadGeofenceByUserIdCtrl)
);

router.patch("/toggle-status/:geofence_id", 
  requirePermission("patch:geofence"),
  asyncHandler(toggleGeofenceStatus));

router.post("/update-location-event-creation");

export default router;
