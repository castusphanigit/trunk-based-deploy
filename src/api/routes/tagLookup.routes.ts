import { Router } from "express";
import {

  fetchTagLookups,

} from "../controllers/tagLookup.controller"; // adjust path
import { asyncHandler } from "../../utils/asyncHandler";
import { requirePermission } from "../middleware/auth0.middleware";
const router = Router();


router.get("/", 
  requirePermission("read:geofence-list-view"),
  asyncHandler(fetchTagLookups));

export default router;
