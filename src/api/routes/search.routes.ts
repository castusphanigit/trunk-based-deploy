import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";

import { globalSearch } from "../controllers/search.controller";

const router = Router();

router.get("/search", asyncHandler(globalSearch));
export default router;
