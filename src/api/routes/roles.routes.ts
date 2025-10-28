import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createUserRole,
  // removeRolePermissions,
  editUserRole,
  getUserRoleById,
  getUserRolesByCustomerId,
} from "../controllers/roles.controller";
import { requirePermission } from "../middleware/auth0.middleware";
const router = Router();

router.post(
  "/createRole",
  requirePermission("write:role"),
  asyncHandler(createUserRole)
);
router.get(
  "/customerRoles/:customer_id",

  requirePermission("read:user-management"),
  asyncHandler(getUserRolesByCustomerId)
);
router.put(
  "/editUserRole",
  requirePermission("patch:role"),
  asyncHandler(editUserRole)
);
router.get("/getUserRoleById/:role_id", asyncHandler(getUserRoleById));
// router.delete("/:id/removeRolePermissions", asyncHandler(removeRolePermissions))
export default router;
