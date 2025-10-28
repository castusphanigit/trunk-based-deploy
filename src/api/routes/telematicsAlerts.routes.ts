// routes/telematicsAlerts.routes.ts
import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createTelematicsAlert,
  getTelematicsAlert,
  getTelematicsAlertsByUser,
  downloadTelematicsAlertsByUser,
  fetchUsersByAccounts,
  fetchEquipmentByAccounts,
  updateTelematicsAlert,
  fetchEquipmentByAccountsOrCustIdAndEvents,
  toggleTelematicAlertStatusCtrl,
} from "../controllers/telematicsAlerts.controller";
import { requirePermission } from "../middleware/auth0.middleware";
const router = Router();

// Create
router.post("/", 
  requirePermission("write:telematics-alerts"),
  asyncHandler(createTelematicsAlert));

router.patch("/:id", 
  requirePermission("patch:telematics-alerts"),
  asyncHandler(updateTelematicsAlert));

router.patch(
  "/toggle-status/:id",
  requirePermission("patch:telematics-alerts"),
  asyncHandler(toggleTelematicAlertStatusCtrl)
);

router.post("/getUsersByAccountIds", 
  requirePermission("read:user-management"),
  asyncHandler(fetchUsersByAccounts));
router.post(
  "/getEquipmentsByAccountIds",
  requirePermission("read:fleet-list-view"),
  asyncHandler(fetchEquipmentByAccounts)
);
router.post(
  "/fetchEquipmentByAccountsOrCustIdAndEvents",
  requirePermission("read:fleet-list-view"),
  asyncHandler(fetchEquipmentByAccountsOrCustIdAndEvents)
);

// Get alerts by customer_id

router.get(
  "/customer/:custId/user/:userId?",
  asyncHandler(getTelematicsAlertsByUser)
);
router.get(
  "/customer/:custId/",
  requirePermission("read:telematics-activity-feed"),
  asyncHandler(getTelematicsAlertsByUser)
);
router.post(
  "/download/customer/:custId/user/:userId?",
  asyncHandler(downloadTelematicsAlertsByUser)
);
router.post(
  "/download/customer/:custId/",
  requirePermission("download:telematics-activity-feed"),
  asyncHandler(downloadTelematicsAlertsByUser)
);

// Read (one)
router.get("/:id", 
  requirePermission("read:telematics-activity-feed-details"),
  asyncHandler(getTelematicsAlert));

export default router;
