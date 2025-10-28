import { Router } from "express";
import {
  getActivityFeedByUser,
  downloadActivityFeedByUser,
  createActivityFeed,
} from "../controllers/activityFeed.controller";

import { asyncHandler } from "../../utils/asyncHandler";
import { createActivityFeedValidator } from "../validators/activityFeed.validator";
import { withValidation } from "../middleware/validation.middleware";
import { requirePermission } from "../middleware/auth0.middleware";
const router = Router();

router.get(
  "/customer/:custId/user/:userId?",
   requirePermission("read:telematics-activity-feed"),

  asyncHandler(getActivityFeedByUser)
);
router.get("/customer/:custId/", asyncHandler(getActivityFeedByUser));

router.post(
  "/download/customer/:custId/user/:userId?",
  asyncHandler(downloadActivityFeedByUser)
);
router.post(
  "/download/customer/:custId/",
  requirePermission("download:telematics-activity-feed"),
  asyncHandler(downloadActivityFeedByUser)
);

router.post(
  "/",
  ...withValidation(createActivityFeedValidator),
  asyncHandler(createActivityFeed)
);

export default router;
