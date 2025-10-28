import { Router } from "express";
import { anyFileUpload } from "../../utils/s3.middleware";
import {
  createServiceRequest,
  getTireSizes,
  getTENFacilitiesList,
  getSavedLocationsList,
  getSavedLocationById,
  updateSavedLocation,
  deleteSavedLocation,
  getServiceRequestById,
  downloadServiceRequestDetailsPDF,
  downloadServiceRequestsHistory,
  getServiceCategories,
  getServiceRequestsList,
  getAccountByEquipmentId,
  getServiceUrgencyTypesList,
  getServiceUrgencyList,
} from "../controllers/serviceRequest.controller";
import { asyncHandler } from "../../utils/asyncHandler";
import { requirePermission } from "../middleware/auth0.middleware";
const router = Router();

router.post("/", anyFileUpload, 
  requirePermission("write:service-request"),
  asyncHandler(createServiceRequest));
router.get("/serviceUrgencyTypes", asyncHandler(getServiceUrgencyTypesList));
router.get("/serviceUrgency", asyncHandler(getServiceUrgencyList));
// Dropdown APIs
router.get("/serviceCategories", asyncHandler(getServiceCategories)); // get api form service_issues_lookup table @kalyan
router.get("/tireSizes", asyncHandler(getTireSizes)); // get api from tire_size_lookup tables @ abhi
router.get("/tenFacilities", asyncHandler(getTENFacilitiesList)); // // get api from facility_lookup tables  @ abhi
router.get("/savedLocations", asyncHandler(getSavedLocationsList)); /// get api from  service_request_location based on Login userId  @ abhi
router.get("/savedLocations/:id", asyncHandler(getSavedLocationById)); // get api from service_request_location detail from service_request_location table @ abhi
router.put("/savedLocations/:id", asyncHandler(updateSavedLocation)); // update api from  service_request_location based on  service_request_location_ID @ abhi
router.delete("/savedLocations/:id", asyncHandler(deleteSavedLocation)); /// delete api from  service_request_location based on  service_request_location_ID @ abhi
router.get(
  "/equipment/:equipmentId/account",
  asyncHandler(getAccountByEquipmentId)
); // kalyan
router.get("/serviceRequestsList", 
  requirePermission("write:service-request"),
  asyncHandler(getServiceRequestsList)); //  @ rajeshwari
router.get("/:id", 
 // requirePermission("write:service-request"),
  asyncHandler(getServiceRequestById)); // get api for  service_request details based on service_request_id @   @   rajeshwari

// // History & reporting

router.get("/:id/download-pdf", 
  //requirePermission("download:service-request"),
  asyncHandler(downloadServiceRequestDetailsPDF)); // @ abhi
router.post("/download-excel", asyncHandler(downloadServiceRequestsHistory)); // @ abhi

export default router;
