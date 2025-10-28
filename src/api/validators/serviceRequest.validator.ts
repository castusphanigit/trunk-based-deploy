// validators/serviceRequest.validator.ts  — REVISED

import { body, query, param } from "express-validator";

/**
 * CREATE SERVICE REQUEST
 * - Coerces numerics via .toInt()
 * - Trims/sanitizes strings via .trim()
 * - Implements XOR: equipment_id XOR external_unit_number
 * - Conditional account_id: required only for external units
 * - Coerces dates via .toDate() (native Date in req.body)
 */
export const validateCreateServiceRequest = [
  // STEP 1: Unit Selection — IDs & strings
  body("equipment_id")
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage("Invalid equipment ID"),
  body("external_unit_number")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("External unit number required"),
  body("external_unit_vin")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("VIN required for external units"),
  body("external_unit_leasing_company")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 255 })
    .withMessage("Leasing company name too long"),
  body("external_unit_carrier_name")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 255 })
    .withMessage("Carrier name too long"),

  // XOR: equipment_id XOR external_unit_number
  body().custom(({ equipment_id, external_unit_number }) => {
    const hasEquipment = !!equipment_id;
    const hasExternal = !!String(external_unit_number ?? "").trim();
    if (hasEquipment === hasExternal) {
      throw new Error(
        "Provide either equipment_id OR external_unit_number, not both"
      );
    }
    return true;
  }),

  // External unit requires VIN and account_id
  body("external_unit_vin")
    .if(body("external_unit_number").exists({ checkFalsy: true }))
    .isString()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("VIN required for non-TEN units"),
  body("account_id")
    .if(body("external_unit_number").exists({ checkFalsy: true }))
    .isInt({ min: 1 })
    .toInt()
    .withMessage("account_id required for external units"),

  // If equipment_id is present, DO NOT require account_id (it will be derived)
  body("account_id")
    .if(body("equipment_id").exists({ checkFalsy: true }))
    .optional({ nullable: true })
    .customSanitizer(() => undefined),

  // STEP 2: Timing & Type
  body("urgency_code")
    .isIn(["EMERGENCY", "BUSINESS_HOURS", "SCHEDULED"])
    .withMessage("Invalid urgency code"),
  body("service_type_selection")
    .optional()
    .isIn(["OFF_YARD_MOBILE", "ON_YARD_MOBILE", "IN_SHOP_REPAIR"])
    .withMessage("Invalid service type selection"),
  body("agreed_terms")
    .optional()
    .isBoolean()
    .withMessage("Terms agreement must be boolean"),
  body("available_for_repair_date")
    .optional()
    .isISO8601()
    .toDate()
    .withMessage("Invalid start date"),
  body("needs_repair_by_date")
    .optional()
    .isISO8601()
    .toDate()
    .withMessage("Invalid completion date"),
  body("emergency_contact_datetime")
    .optional()
    .isISO8601()
    .toDate()
    .withMessage("Invalid emergency contact date"),

  // EMERGENCY
  body().custom(({ urgency_code, agreed_terms, needs_repair_by_date }) => {
    if (urgency_code === "EMERGENCY") {
      if (!agreed_terms)
        throw new Error("Must agree to terms for emergency roadside service");
      if (!needs_repair_by_date)
        throw new Error("Emergency service requires completion date");
    }
    return true;
  }),

  // BUSINESS_HOURS
  body().custom(
    ({ urgency_code, service_type_selection, needs_repair_by_date }) => {
      if (urgency_code === "BUSINESS_HOURS") {
        if (!service_type_selection)
          throw new Error(
            "Must select service type for next available technician"
          );
        if (
          !["OFF_YARD_MOBILE", "ON_YARD_MOBILE", "IN_SHOP_REPAIR"].includes(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            service_type_selection
          )
        ) {
          throw new Error("Invalid service type selection for business hours");
        }
        if (!needs_repair_by_date)
          throw new Error("Next available service requires completion date");
      }
      return true;
    }
  ),

  // SCHEDULED
  body().custom(
    ({
      urgency_code,
      service_type_selection,
      available_for_repair_date,
      needs_repair_by_date,
    }) => {
      if (urgency_code === "SCHEDULED") {
        if (!service_type_selection)
          throw new Error("Must select service type for scheduled service");
        if (
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          !["ON_YARD_MOBILE", "IN_SHOP_REPAIR"].includes(service_type_selection)
        ) {
          throw new Error(
            "Scheduled service only supports On Yard Mobile or In Shop Repair"
          );
        }
        if (!available_for_repair_date)
          throw new Error("Scheduled service requires start date");
        if (!needs_repair_by_date)
          throw new Error("Scheduled service requires completion date");
        if (
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          new Date(available_for_repair_date) >= new Date(needs_repair_by_date)
        ) {
          throw new Error("Start date must be before completion date");
        }
      }
      return true;
    }
  ),

  // STEP 3: Location & Facility
  body("location_line1")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 255 })
    .withMessage("Address line 1 too long"),
  body("location_line2")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 255 })
    .withMessage("Address line 2 too long"),
  body("location_city")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("City name too long"),
  body("location_state")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage("State name too long"),
  body("location_zipcode")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Zipcode too long"),
  body("saved_location_id")
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage("Invalid saved location ID"),
  body("selected_ten_facility_id")
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage("Invalid facility ID"),
  body("save_location")
    .optional()
    .isBoolean()
    .withMessage("Save location must be boolean"),
  body("request_pickup")
    .optional()
    .isBoolean()
    .withMessage("Request pickup must be boolean"),
  body("location_nickname")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Location nickname too long"),

  // Location needed for EMERGENCY and mobile services
  body().custom(
    ({
      urgency_code,
      service_type_selection,
      location_line1,
      saved_location_id,
    }) => {
      const needsLocation =
        urgency_code === "EMERGENCY" ||
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        ["OFF_YARD_MOBILE", "ON_YARD_MOBILE"].includes(service_type_selection);
      if (needsLocation && !location_line1 && !saved_location_id) {
        throw new Error("Location required for emergency and mobile services");
      }
      return true;
    }
  ),

  // Facility required for our three flows (adjust if you introduce external drop-off)
  body().custom(
    ({ service_type_selection, urgency_code, selected_ten_facility_id }) => {
      const needsFacility =
        urgency_code === "EMERGENCY" ||
        ["OFF_YARD_MOBILE", "ON_YARD_MOBILE", "IN_SHOP_REPAIR"].includes(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          service_type_selection
        );
      if (needsFacility && !selected_ten_facility_id) {
        throw new Error("TEN facility selection required");
      }
      return true;
    }
  ),

  // Save location requires address
  body().custom(({ save_location, location_line1 }) => {
    if (save_location && !String(location_line1 ?? "").trim()) {
      throw new Error("Address line 1 required when saving location");
    }
    return true;
  }),

  // STEP 4: Service Categories
  body("service_type_ids")
    .isArray({ min: 1 })
    .withMessage("Select at least one service category"),
  body("service_type_ids.*")
    .isInt({ min: 1 })
    .toInt()
    .withMessage("Invalid service category ID"),

  // STEP 5: Additional Information & Tire Size
  body("issue_description")
    .isString()
    .trim()
    .isLength({ min: 3, max: 5000 })
    .withMessage("Issue description required (3-5000 characters)"),
  body("tire_size_lookup_id")
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage("Invalid tire size ID"),
  body("custom_tire_size")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Custom tire size too long"),

  // STEP 6: Unit Status & Driver
  body("is_unit_loaded").isBoolean().withMessage("Unit loaded status required"),
  body("has_hazardous_materials")
    .isBoolean()
    .withMessage("Hazardous materials status required"),
  body("driver_with_unit")
    .isBoolean()
    .withMessage("Driver presence status required"),
  body("driver_name")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Driver name too long"),
  body("driver_phone")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Driver phone too long"),
  body().custom(({ driver_with_unit, driver_name, driver_phone }) => {
    if (driver_with_unit) {
      if (!String(driver_name ?? "").trim())
        throw new Error("Driver name required when driver is present");
      if (!String(driver_phone ?? "").trim())
        throw new Error("Driver phone required when driver is present");
    }
    return true;
  }),

  // STEP 7: Contacts & Preferences
  body("primary_contact_name")
    .notEmpty()
    .withMessage("Primary contact name required")
    .trim(),
  body("primary_contact_phone")
    .notEmpty()
    .withMessage("Primary contact phone required")
    .trim(),
  body("primary_contact_email")
    .optional()
    .isEmail()
    .withMessage("Valid email required")
    .trim(),
  body("secondary_contact_name")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Secondary contact name too long"),
  body("secondary_contact_phone")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Secondary contact phone too long"),
  body("secondary_contact_email")
    .optional()
    .isEmail()
    .withMessage("Valid secondary email required")
    .trim(),
  body("pref_email").optional().isBoolean(),
  body("pref_phone").optional().isBoolean(),
  body("pref_sms").optional().isBoolean(),
  body("secondary_pref_email").optional().isBoolean(),
  body("secondary_pref_phone").optional().isBoolean(),
  body("secondary_pref_sms").optional().isBoolean(),
  body("po_reference")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("PO reference too long"),

  // At least one communication preference
  body().custom(({ pref_email, pref_phone, pref_sms }) => {
    if (!pref_email && !pref_phone && !pref_sms) {
      throw new Error("Select at least one communication preference");
    }
    return true;
  }),
];

// OTHER VALIDATORS — add .toInt() where missing and trim where useful
export const validateServiceRequestHistoryQuery = [
  query("accountIds").notEmpty().withMessage("accountIds required"),
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("perPage").optional().isInt({ min: 1, max: 500 }).toInt(),
  query("trailer").optional().isString().trim(),
  query("submittedOnFrom").optional().isISO8601().toDate(),
  query("submittedOnTo").optional().isISO8601().toDate(),
  query("submittedBy").optional().isString().trim(),
  query("issue").optional().isString().trim(),
  query("location").optional().isString().trim(),
  query("sortBy")
    .optional()
    .isIn(["trailer", "submitted_on", "submitted_by", "issue", "location"]),
  query("sortOrder").optional().isIn(["ASC", "DESC"]),
];

export const validateServiceRequestQuery = [
  query("accountId").optional().isInt({ min: 1 }).toInt(),
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("perPage").optional().isInt({ min: 1, max: 200 }).toInt(),
  query("equipmentId").optional().isInt({ min: 1 }).toInt(),
  query("dateRangeFrom").optional().isISO8601().toDate(),
  query("dateRangeTo").optional().isISO8601().toDate(),
];

export const validateServiceRequestId = [
  param("id").isInt({ min: 1 }).toInt().withMessage("Invalid ID"),
];

export const validateEquipmentIdParam = [
  param("equipmentId")
    .isInt({ gt: 0 })
    .toInt()
    .withMessage("equipmentId must be a positive integer"),
];

export const validateSavedLocationId = [
  param("id").isInt({ gt: 0 }).toInt().withMessage("Invalid location ID"),
];

export const validateSavedLocationQuery = [
  query("userId").notEmpty().withMessage("userId query parameter required"),
];

export const validateUpdateSavedLocation = [
  param("id").isInt({ gt: 0 }).toInt().withMessage("Invalid location ID"),
  body("userId").notEmpty().withMessage("userId required in request body"),
  body("nickname")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Nickname too long"),
  body("label")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Label too long"),
  body("line1").notEmpty().withMessage("Address line 1 required").trim(),
  body("line2")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 255 })
    .withMessage("Address line 2 too long"),
  body("city")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("City name too long"),
  body("state")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage("State name too long"),
  body("zipcode")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Zipcode too long"),
];
