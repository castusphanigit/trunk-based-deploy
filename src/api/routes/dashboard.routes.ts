import { Router } from "express";
import { DashboardController } from "../../api/controllers/dashboard.controller";

const router = Router();
const dashboardController = new DashboardController();

// GET /api/dashboard/metrics - Main dashboard cards
router.get("/metrics", dashboardController.getDashboardMetrics);
router.get("/vmrslist", dashboardController.getVMRSList);

// POST /api/dashboard/vmrs-metrics - VMRS repair metrics and monthly maintenance costs
router.post("/vmrs-metrics", dashboardController.getVmrsMetrics);
router.get("/tenQuickLinksList", dashboardController.getTenQuickLinksList);
export default router;
