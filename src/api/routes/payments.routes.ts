import { Router } from "express";
// controller
import { PaymentCtrl } from "../controllers/payments.controller";
// validators
import {
  createPaymentValidator,
  updatePaymentValidator,
  paymentIdValidator,
  paymentPaginationValidator,
} from "../validators/payment.validator";
import { asyncHandler } from "../../utils/asyncHandler";

const paymentRouter = Router();

const paymentCtrl = new PaymentCtrl();

paymentRouter.post(
  "/export",
  // ...requirePermission("export:payments"),
  asyncHandler(paymentCtrl.exportPayments.bind(paymentCtrl))
);

paymentRouter.get(
  "/:id/receipt-pdf",
  // ...requirePermission("read:payments"),
  paymentIdValidator,
  asyncHandler(paymentCtrl.exportPaymentReceiptPDF.bind(paymentCtrl))
);

paymentRouter.get(
  "/",
  // ...requirePermission("read:payments"),
  paymentPaginationValidator,
  asyncHandler(paymentCtrl.getPayments.bind(paymentCtrl))
);

paymentRouter.get(
  "/account/:accountId",
  // ...requirePermission("read:payments"),
  asyncHandler(paymentCtrl.getPaymentsByAccountId.bind(paymentCtrl))
);

paymentRouter.get(
  "/:id",
  // ...requirePermission("read:payments"),
  paymentIdValidator,
  asyncHandler(paymentCtrl.getPaymentById.bind(paymentCtrl))
);

paymentRouter.post(
  "/",
  // ...requirePermission("create:payments"),
  createPaymentValidator,
  asyncHandler(paymentCtrl.createPayment.bind(paymentCtrl))
);

paymentRouter.put(
  "/:id",
  // ...requirePermission("update:payments"),
  paymentIdValidator,
  updatePaymentValidator,
  asyncHandler(paymentCtrl.updatePayment.bind(paymentCtrl))
);

paymentRouter.delete(
  "/:id",
  // ...requirePermission("delete:payments"),
  paymentIdValidator,
  asyncHandler(paymentCtrl.deletePayment.bind(paymentCtrl))
);

// Legacy routes for backward compatibility
paymentRouter.post(
  "/create-payment",
  // ...requirePermission("create:payments"),
  createPaymentValidator,
  asyncHandler(paymentCtrl.createPayment.bind(paymentCtrl))
);

paymentRouter.get(
  "/get-payment/:id",
  // ...requirePermission("read:payments"),
  paymentIdValidator,
  asyncHandler(paymentCtrl.getPaymentById.bind(paymentCtrl))
);

paymentRouter.get(
  "/get-payments",
  // ...requirePermission("read:payments"),
  paymentPaginationValidator,
  asyncHandler(paymentCtrl.getPayments.bind(paymentCtrl))
);

paymentRouter.put(
  "/update-payment/:id",
  // ...requirePermission("update:payments"),
  paymentIdValidator,
  updatePaymentValidator,
  asyncHandler(paymentCtrl.updatePayment.bind(paymentCtrl))
);

paymentRouter.delete(
  "/delete-payment/:id",
  // ...requirePermission("delete:payments"),
  paymentIdValidator,
  asyncHandler(paymentCtrl.deletePayment.bind(paymentCtrl))
);

export default paymentRouter;
