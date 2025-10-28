import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import {
    getERS,
    getERSDetailsController,
    downloadErs
} from "../controllers/ers.controller";
import { requirePermission } from "../middleware/auth0.middleware";

const router = Router();

router.get("/geters",
    requirePermission("read:ers"),
    asyncHandler(getERS));
router.get("/getersDetails",
    requirePermission("read:ers-details"),
    asyncHandler(getERSDetailsController));
router.post("/downloadErs", 
    requirePermission("download:ers"),
    asyncHandler(downloadErs));
export default router;
