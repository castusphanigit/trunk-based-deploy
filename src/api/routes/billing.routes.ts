import { Router } from "express";
// controller
import { BillingCtrl } from "../controllers/billing.controller";
// validators
import {
  accountIdValidator,
  paymentIdValidator,
  applyPaymentValidator,
} from "../validators/billing.validator";
import { asyncHandler } from "../../utils/asyncHandler";

const billingRouter = Router();

const billingCtrl = new BillingCtrl();

// Get billing summary for an account
billingRouter.get(
  "/summary/:accountId",
  accountIdValidator,
  asyncHandler(billingCtrl.getBillingSummary.bind(billingCtrl))
);

// Apply payment to invoices
billingRouter.post(
  "/apply-payment/:paymentId",
  paymentIdValidator,
  applyPaymentValidator,
  asyncHandler(billingCtrl.applyPaymentToInvoices.bind(billingCtrl))
);

// Get aging report for an account
billingRouter.get(
  "/aging-report/:accountId",
  accountIdValidator,
  asyncHandler(billingCtrl.getAgingReport.bind(billingCtrl))
);

export default billingRouter;
