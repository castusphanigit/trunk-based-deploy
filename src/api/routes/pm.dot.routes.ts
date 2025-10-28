import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  getDOTInspectionsByAccounts,
  getPMsByAccounts,
  getPMScheduleDetail,
  getCombinedRecords,
  getDOTInspectionById,
  downloadCombinedRecords,
  getPMsByEquipment,
} from "../controllers/pm.dot.controller";
import { requirePermission } from "../middleware/auth0.middleware";
const router = Router();

router.get(
  "/preventiveMaintenance",
  requirePermission("read:preventive-maintanence"),
  asyncHandler(getPMsByAccounts)
);

router.get(
  "/:pmScheduleId/detail",
  requirePermission("read:preventive-maintanence"),
  asyncHandler(getPMScheduleDetail)
);

router.get(
  "/dotInspections",
  requirePermission("read:dot-inspection"),
  asyncHandler(getDOTInspectionsByAccounts)
);

router.post(
  "/pmdot/export",
  requirePermission([
    "download:dot-inspection",
    "download:preventive-maintanence",
  ]),
  asyncHandler(downloadCombinedRecords)
);

router.get(
  "/pm/dot",
  requirePermission(["read:dot-inspection", "read:preventive-maintanence"]),
  asyncHandler(getCombinedRecords)
);

router.get(
  "/dotDetails/:dotInspectionId",
  requirePermission("read:dot-inspection"),
  asyncHandler(getDOTInspectionById)
);

router.get(
  "/PM/PMByEquipmentId/:equipmentId",

  asyncHandler(getPMsByEquipment)
);

export default router;
