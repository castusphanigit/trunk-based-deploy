import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  getCurrentUser,
  fetchCustomers,
  createUser,
  getAllTenUsers,
  getCustomerDetailsAndAccountsByUserId,
  getCustomerUsersByAccountAssignment,
  downloadAllTenUsers,
  downloadCustomerUsersByAccountAssignment,
  getAllUsersByCustomerId,
  downloadCustomers,
  updateUser,
  createUserColumnPreference,
  toggleUserStatus,
  downloadUsersByCustomerId,
  getMasterColumnPreferenceTable,
  getUserColumnPreferences,
  getSuperAdminByCustomer,
  updateUserVerify,
  updateCustomer,
  getActiveLocalizations,
  loadWebSecrets,
} from "../controllers/users.controller";
import { createUserValidator } from "../validators/user.validator";
import { requirePermission } from "../middleware/auth0.middleware";
const router = Router();

// PATCH routes
router.patch(
  "/update/:user_id",
  // requirePermission("patch:user-management"),
  asyncHandler(updateUser)
);

router.patch(
  "/updatecustomer/:customer_id",
  requirePermission("patch:user-management"),
  asyncHandler(updateCustomer)
);

router.patch(
  "/userVerify/:user_id",
  requirePermission("patch:user-management"),
  asyncHandler(updateUserVerify)
);

router.patch(
  "/updateUserStatus/:user_id",
  requirePermission("update:user-management"),
  asyncHandler(toggleUserStatus)
);

// POST routes
router.post(
  "/createUser",
  // requirePermission("write:role"),
  createUserValidator,
  asyncHandler(createUser)
);

router.post(
  "/downloadAllTenUsers",
  requirePermission("download:ten-admin-all-accounts"),
  asyncHandler(downloadAllTenUsers)
);

router.post(
  "/downloadCustomerUsersByAccountAssignment/:userId",
  requirePermission("download:user-management"),
  asyncHandler(downloadCustomerUsersByAccountAssignment)
);
router.post(
  "/downloadCustomerUsers",
  requirePermission("download:user-management"),
  asyncHandler(downloadUsersByCustomerId)
);

router.post(
  "/downloadCustomers",
  requirePermission("download:ten-admin-all-accounts"),
  asyncHandler(downloadCustomers)
);
router.post(
  "/userColumnPreferences",
  requirePermission("read:user-management"),
  asyncHandler(createUserColumnPreference)
);

// GET routes
router.get(
  "/customers",
  requirePermission("read:ten-customers"),
  asyncHandler(fetchCustomers)
);
router.get(
  "/tenUsers",
  requirePermission("read:user-management-ten-user-list"),
  asyncHandler(getAllTenUsers)
);
router.get(
  "/userDetails/:userId",
  // requirePermission("read:user-management"),
  asyncHandler(getCurrentUser)
);
router.get("/customerDetails/:customerId", asyncHandler(getCurrentUser));

router.get(
  "/customerUsers",
  requirePermission("read:ten-admin-all-users"),
  asyncHandler(getAllUsersByCustomerId)
);
router.get(
  "/userCustomerDetailsAndAccounts/:userId",
  requirePermission("read:user-management"),
  asyncHandler(getCustomerDetailsAndAccountsByUserId)
);
router.get(
  "/customerUsersByAssignedAccounts/:userId",
  requirePermission("read:user-management"),

  asyncHandler(getCustomerUsersByAccountAssignment)
);
router.get(
  "/mastercolumnPreferenceTable",
  requirePermission("read:user-management"),
  asyncHandler(getMasterColumnPreferenceTable)
);
router.get(
  "/getUserColumnPreference/:user_id/:tableNameId",
  // requirePermission("read:user-management"),
  asyncHandler(getUserColumnPreferences)
);

router.get(
  "/localizations",
  asyncHandler(getActiveLocalizations)
);

router.get(
  "/webSecrets",
  asyncHandler(loadWebSecrets)
);

// PARAMETERIZED routes last
router.get(
  "/:customerId/superAdmin",
  requirePermission("read:ten-admin-all-users"),
  asyncHandler(getSuperAdminByCustomer)
);

export default router;
