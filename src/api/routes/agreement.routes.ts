import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  getLeaseAgreementDetails,
  getLeaseAgreements,
  getRentalAgreements,
  downloadRentalAgreements,
  downloadLeaseAgreements,
} from "../controllers/agreements.controller";
import { requirePermission } from "../middleware/auth0.middleware";
const router = Router();

router.get(
  "/getLeaseAgreements",
  requirePermission("read:lease"),
  asyncHandler(getLeaseAgreements)
);
router.get(
  "/getRentalAgreements",
  requirePermission("read:rental"),
  asyncHandler(getRentalAgreements)
);
router.get(
  "/:schedule_agreement_id/:equipment_id",
  // requirePermission(["read:lease-details", "read:rental-details"]),
  asyncHandler(getLeaseAgreementDetails)
);
router.post(
  "/downloadRentalAgreements",
  requirePermission("download:rental"),

  asyncHandler(downloadRentalAgreements)
);
router.post(
  "/downloadLeaseAgreements",
  requirePermission("download:lease"),
  asyncHandler(downloadLeaseAgreements)
);
export default router;
