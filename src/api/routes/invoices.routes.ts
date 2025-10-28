import { Router } from "express";
// controllers
import { InvoiceCtrl } from "../controllers/invoices.controller";
// validators
import {
  createInvoiceValidator,
  updateInvoiceValidator,
  invoiceIdValidator,
  paginationValidator,
  creditInvoicesValidator,
} from "../validators/invoice.validator";
// utils
import { asyncHandler } from "../../utils/asyncHandler";

const invoiceRouter = Router();

const invoiceCtrl = new InvoiceCtrl();

//using - Frontend: Get invoice statistics (total due, past due, etc.)
invoiceRouter.get(
  "/stats",
  // ...requirePermission("read:invoices"),
  asyncHandler(invoiceCtrl.getInvoiceStats.bind(invoiceCtrl))
);

//using - Frontend: Export invoices to Excel with custom columns
invoiceRouter.post(
  "/export",
  // ...requirePermission("export:invoices"),
  asyncHandler(invoiceCtrl.exportInvoices.bind(invoiceCtrl))
);

//using - Frontend: Download single invoice as PDF
invoiceRouter.get(
  "/:id/pdf",
  // ...requirePermission("read:invoices"),
  invoiceIdValidator,
  asyncHandler(invoiceCtrl.exportInvoicePDF.bind(invoiceCtrl))
);

//using - Frontend: Process payment for specific invoice
invoiceRouter.post(
  "/:id/pay-now",
  // ...requirePermission("create:payments"),
  invoiceIdValidator,
  asyncHandler(invoiceCtrl.payNow.bind(invoiceCtrl))
);

//using - Frontend: Get all invoices with pagination, filtering, and sorting
invoiceRouter.get(
  "/",
  // ...requirePermission("read:invoices"),
  paginationValidator,
  asyncHandler(invoiceCtrl.getAllInvoices.bind(invoiceCtrl))
);

//using - Frontend: Get credit invoices with pagination, filtering, and sorting
invoiceRouter.get(
  "/credits",
  // ...requirePermission("read:invoices"),
  ...creditInvoicesValidator,
  asyncHandler(invoiceCtrl.getCreditInvoices.bind(invoiceCtrl))
);

//using - Frontend: Get invoices for specific account
invoiceRouter.get(
  "/account/:accountId",
  // ...requirePermission("read:invoices"),
  asyncHandler(invoiceCtrl.getInvoicesByAccountId.bind(invoiceCtrl))
);

//using - Frontend: Get single invoice details by ID
invoiceRouter.get(
  "/:id",
  // ...requirePermission("read:invoices"),
  invoiceIdValidator,
  asyncHandler(invoiceCtrl.getInvoiceById.bind(invoiceCtrl))
);

invoiceRouter.post(
  "/",
  // ...requirePermission("create:invoices"),
  createInvoiceValidator,
  asyncHandler(invoiceCtrl.createInvoice.bind(invoiceCtrl))
);

invoiceRouter.put(
  "/:id",
  // ...requirePermission("update:invoices"),
  invoiceIdValidator,
  updateInvoiceValidator,
  asyncHandler(invoiceCtrl.updateInvoice.bind(invoiceCtrl))
);

invoiceRouter.delete(
  "/:id",
  // ...requirePermission("delete:invoices"),
  invoiceIdValidator,
  asyncHandler(invoiceCtrl.deleteInvoice.bind(invoiceCtrl))
);

export default invoiceRouter;
