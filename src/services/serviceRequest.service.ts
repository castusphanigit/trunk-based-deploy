import prisma from "../config/database.config";
import { CreateServiceRequestInput } from "../types/dtos/serviceRequest.dto";
import { uploadServiceRequestFileToS3 } from "../utils/s3.middleware";
import { createErrorWithMessage } from "../utils/responseUtils";
import logger from "../utils/logger";

import PDFDocument from "pdfkit";
import * as ExcelJS from "exceljs";
import { Decimal } from "@prisma/client/runtime/library";
import https from "node:https";
import http from "node:http";

type ServiceRequestListFilters = Record<string, string>;
type PrismaDecimal = Decimal | number | string | null;
type ExcelCellValue = string | number | null;

// PDF Layout Constants
const PDF_LAYOUT = {
  MARGIN: 50,
  LEFT_COLUMN: 50,
  RIGHT_COLUMN: 300,
  PAGE_BREAK_THRESHOLD: 600,
  MAX_IMAGE_WIDTH: 200,
  MAX_IMAGE_HEIGHT: 150,
  IMAGE_SPACING: 20,
  FIELD_SPACING: 15,
} as const;

interface ServiceRequestForPDF {
  service_request_id: number;
  created_at: Date | null;
  service_type_repairedby_date?: Date | null;
  service_type_repairedfrom_date?: Date | null;
  equipment_ref?: { unit_number: string } | null;
  non_ten_unit_number?: string | null;
  non_ten_unit_company?: string | null;
  non_ten_carrier?: string | null;
  non_ten_vin_number?: string | null;
  workorder?:
    | { workorder_id?: number | null; workorder_status?: string | null }[]
    | null;
  account_id?: number;
  account?: {
    account_name?: string | null;
    account_number?: string | null;
    customer?: {
      customer_name?: string | null;
      reference_number?: string | null;
    } | null;
  } | null;
  facility_lookup?: {
    facility_name?: string | null;
    facility_code?: string | null;
  } | null;
  service_urgency_ref?: {
    urgency_code?: string | null;
    description?: string | null;
  } | null;
  service_urgency_type_lookup_ref?: {
    selection_name?: string | null;
    selection_code?: string | null;
  } | null;
  tire_size_lookup?: {
    size_display?: string | null;
    size_code?: string | null;
  } | null;
  service_saved_location?: {
    location_nick_name?: string | null;
  } | null;
  unit_street?: string | null;
  unit_city?: string | null;
  unit_state?: string | null;
  unit_zipcode?: string | null;
  location_nick_name?: string | null;
  other_type_size?: string | null;
  is_loaded?: boolean | null;
  is_hazardous?: boolean | null;
  is_driver_available?: boolean | null;
  driver_name?: string | null;
  driver_phone_nuber?: string | null;
  primary_contact_name?: string | null;
  primary_contact_method?: unknown;
  primary__contact_phonenumber?: string | null;
  primary_contact_email?: string | null;
  secondary_contact_name?: string | null;
  secondary_contact_method?: unknown;
  secondary__contact_phonenumber?: string | null;
  secondary_contact_email?: string | null;
  to_save_location?: boolean | null;
  user?: { email?: string | null } | null;
  issue_description?: string | null;
  emergency_contact_date?: Date | null;
  is_gps_location?: boolean | null;
  latitude?: PrismaDecimal | null;
  longititude?: PrismaDecimal | null;
  address?: string | null;
  location_notes?: string | null;
  is_request_pickup?: boolean | null;
  po_reference_number?: string | null;
}

interface ServiceIssueForPDF {
  type_name: string;
}

interface AttachmentForPDF {
  attachment_id: bigint;
  name?: string | null;
  mime_type?: string | null;
  url?: string | null;
}

interface ServiceRequestListResult {
  data: {
    service_request_id: number;
    trailer: string;
    submitted_on: Date;
    submitted_by: string;
    issue: string;
    repaired_by: Date | null;
    location: string;
  }[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
export class ServiceRequestService {
  private async handleFileUploads(
    files: Express.Multer.File[],
    customerName: string
  ) {
    const attachmentIds: number[] = [];

    for (const file of files) {
      const uploaded = await uploadServiceRequestFileToS3(file, customerName);

      const attachment = await prisma.attachment.create({
        data: {
          mime_type: file.mimetype,
          document_category_type: uploaded.document_category_type,
          name: file.originalname,
          date_uploaded: new Date(),
          url: uploaded.url,
          created_at: new Date(),
        },
      });

      attachmentIds.push(Number(attachment.attachment_id));
    }

    return attachmentIds;
  }

  private transformServiceRequestInput(input: CreateServiceRequestInput) {
    const transformed: Record<string, unknown> = { ...input };

    this.convertNumericFields(transformed);
    this.convertBooleanFields(transformed);
    this.parseJsonFields(transformed);

    return transformed;
  }

  private convertNumericFields(transformed: Record<string, unknown>) {
    const numericFields = [
      "account_id",
      "equipment_id",
      "service_urgency_lookup_id",
      "service_urgency_type_lookup_id",
      "tire_size_lookup_id",
      "saved_location_id",
      "facility_lookup_id",
      "created_by",
    ];

    for (const field of numericFields) {
      if (transformed[field] !== undefined && transformed[field] !== null) {
        const num = Number(transformed[field]);
        if (Number.isNaN(num)) {
          throw createErrorWithMessage(
            `Invalid number provided for field '${field}'`,
            transformed[field],
            400
          );
        }
        transformed[field] = num;
      }
    }
  }

  private convertBooleanFields(transformed: Record<string, unknown>) {
    const booleanFields = [
      "is_loaded",
      "is_hazardous",
      "is_driver_available",
      "to_save_location",
      "is_gps_location",
      "is_request_pickup",
    ];

    for (const field of booleanFields) {
      if (transformed[field] !== undefined && transformed[field] !== null) {
        transformed[field] =
          transformed[field] === "true" || transformed[field] === true;
      }
    }
  }

  private parseJsonFields(transformed: Record<string, unknown>) {
    const jsonFields = [
      "service_issues_lookup_ids",
      "primary_contact_method",
      "secondary_contact_method",
    ];

    for (const field of jsonFields) {
      if (typeof transformed[field] === "string") {
        try {
          transformed[field] = JSON.parse(transformed[field]);
        } catch (error) {
          throw createErrorWithMessage(
            `Failed to parse '${field}' as JSON`,
            error,
            400
          );
        }
      }
    }
  }

  public async createServiceRequest(
    input: CreateServiceRequestInput,
    files: Express.Multer.File[]
  ) {
    const transformedInput = this.transformServiceRequestInput(input);

    this.validateServiceRequestInput(transformedInput);
    await this.validateAccountAndUser(transformedInput);

    const savedLocationId = await this.handleLocationSaving(transformedInput);
    const customerName = await this.getCustomerName(
      transformedInput.account_id as number
    );
    const attachmentIds = await this.handleFileUploads(files, customerName);

    return this.createServiceRequestRecord(
      transformedInput,
      attachmentIds,
      savedLocationId
    );
  }

  private validateServiceRequestInput(input: Record<string, unknown>) {
    const {
      account_id,
      service_urgency_lookup_id,
      created_by,
      primary_contact_name,
      primary_contact_email,
      to_save_location,
      location_nick_name,
      unit_street,
      unit_city,
      unit_state,
      unit_zipcode,
    } = input;

    if (!account_id || Number.isNaN(account_id as number)) {
      throw createErrorWithMessage("Invalid or missing account_id", "");
    }
    if (
      !service_urgency_lookup_id ||
      Number.isNaN(service_urgency_lookup_id as number)
    ) {
      throw createErrorWithMessage(
        "Invalid or missing service_urgency_lookup_id",
        ""
      );
    }
    if (!created_by || Number.isNaN(created_by as number)) {
      throw createErrorWithMessage("Invalid or missing created_by", "");
    }
    if (!primary_contact_name || !primary_contact_email) {
      throw createErrorWithMessage(
        "Primary contact name and email are required",
        ""
      );
    }

    if (to_save_location) {
      if (!location_nick_name) {
        throw new Error("Location nickname is required when saving location");
      }
      if (!unit_street || !unit_city || !unit_state || !unit_zipcode) {
        throw new Error("All address fields are required when saving location");
      }
    }
  }

  private async validateAccountAndUser(input: Record<string, unknown>) {
    const { account_id, created_by, to_save_location } = input;

    try {
      const account = await prisma.account.findUnique({
        where: { account_id: account_id as number },
      });
      if (!account) {
        throw new Error(`Account with ID not found`);
      }
    } catch (error) {
      throw createErrorWithMessage("Account verification failed", error);
    }

    if (to_save_location) {
      try {
        const user = await prisma.user.findUnique({
          where: { user_id: created_by as number },
        });
        if (!user) {
          throw new Error(`User not found`);
        }
      } catch (error) {
        throw createErrorWithMessage("User verification failed", error);
      }
    }
  }

  private async handleLocationSaving(
    input: Record<string, unknown>
  ): Promise<number | null> {
    const {
      to_save_location,
      created_by,
      location_nick_name,
      unit_street,
      unit_city,
      unit_state,
      unit_zipcode,
    } = input;

    if (!to_save_location) return null;

    try {
      const savedLocation = await prisma.service_request_location.create({
        data: {
          user_id: created_by as number,
          location_nick_name: (location_nick_name ?? "") as string | null,
          unit_street: (unit_street ?? "") as string | null,
          unit_city: (unit_city ?? "") as string | null,
          unit_state: (unit_state ?? "") as string | null,
          unit_zipcode: (unit_zipcode ?? "") as string | null,
          is_active: true,
          created_at: new Date(),
        },
      });
      return savedLocation.service_request_location_id;
    } catch (error) {
      throw createErrorWithMessage("Failed to save location:", error);
    }
  }

  private async getCustomerName(accountId: number): Promise<string> {
    try {
      const account = await prisma.account.findUnique({
        where: { account_id: accountId },
        include: { customer: true },
      });

      if (!account) {
        throw new Error(`Account with ID ${accountId} not found`);
      }

      return account.customer.customer_name || "Unknown Customer";
    } catch (error) {
      throw createErrorWithMessage("Account verification failed", error);
    }
  }

  private async createServiceRequestRecord(
    transformedInput: Record<string, unknown>,
    attachmentIds: number[],
    savedLocationId: number | null
  ) {
    try {
      const serviceRequestData = {
        ...transformedInput,
        attachment_ids: attachmentIds,
        saved_location_id: savedLocationId ?? null,
      };

      const newServiceRequest = await prisma.service_request.create({
        data: serviceRequestData as Parameters<
          typeof prisma.service_request.create
        >[0]["data"],
        include: {
          equipment_ref: true,
          tire_size_lookup: true,
        },
      });

      return newServiceRequest;
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };

      if (error.code === "P2002") {
        throw createErrorWithMessage("Duplicate service request", err);
      }

      if (error.code === "P2003") {
        throw createErrorWithMessage(
          "Foreign key constraint violation - check if related records exist",
          err,
          400
        );
      }

      if (error?.message?.includes("Invalid `prisma.")) {
        throw createErrorWithMessage(
          `Prisma validation error: ${error.message}`,
          err,
          400
        );
      }

      throw createErrorWithMessage(
        error.message ?? "Failed to create service request in database",
        err,
        500
      );
    }
  }

  public async getTireSizes() {
    try {
      const tireSizes = await prisma.tire_size_lookup.findMany({
        where: {
          is_active: true,
        },
        select: {
          tire_size_lookup_id: true,
          size_code: true,
          size_display: true,
          display_order: true,
          created_at: true,
        },
        orderBy: {
          display_order: "asc",
        },
      });

      if (!tireSizes?.length) {
        throw createErrorWithMessage("No active tire sizes found", "");
      }

      return tireSizes;
    } catch (error: unknown) {
      throw createErrorWithMessage("Failed to retrieve tire sizes", error);
    }
  }
  public async getTENFacilitiesList() {
    try {
      const facilities = await prisma.facility_lookup.findMany({
        where: {
          is_deleted: false,
        },
        select: {
          facility_lookup_id: true,
          facility_code: true,
          facility_name: true,
          facility_description: true,
          created_at: true,
        },
        orderBy: {
          facility_lookup_id: "asc",
        },
      });

      if (!facilities?.length) {
        throw createErrorWithMessage("No active facilities found", "");
      }

      return facilities;
    } catch (error: unknown) {
      throw createErrorWithMessage("Failed to retrieve facilities", error);
    }
  }
  public async getSavedLocationsList(userId: number) {
    // --- Validation ---
    if (!userId || Number.isNaN(userId)) {
      throw createErrorWithMessage("Invalid or missing user_id", "");
    }

    // --- Check if user exists ---
    try {
      const user = await prisma.user.findUnique({
        where: { user_id: userId },
      });

      if (!user) {
        throw createErrorWithMessage("User not found", "");
      }
    } catch (error) {
      throw createErrorWithMessage("User verification failed", error);
    }

    // --- Get saved locations ---
    try {
      const savedLocations = await prisma.service_request_location.findMany({
        where: {
          user_id: userId,
          is_active: true,
        },
        select: {
          service_request_location_id: true,
          location_nick_name: true,
          unit_street: true,
          unit_city: true,
          unit_state: true,
          unit_zipcode: true,
          created_at: true,
          updated_at: true,
        },
        orderBy: {
          created_at: "desc",
        },
      });

      return savedLocations;
    } catch (error: unknown) {
      throw createErrorWithMessage("Failed to retrieve saved locations", error);
    }
  }
  public async getSavedLocationById(locationId: number) {
    // --- Validation ---
    if (!locationId || Number.isNaN(locationId)) {
      throw createErrorWithMessage("Invalid or missing location ID", "");
    }

    // --- Get saved location by ID ---
    try {
      const savedLocation = await prisma.service_request_location.findUnique({
        where: {
          service_request_location_id: locationId,
        },
        select: {
          service_request_location_id: true,
          user_id: true,
          location_nick_name: true,
          unit_street: true,
          unit_city: true,
          unit_state: true,
          unit_zipcode: true,
          is_active: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!savedLocation) {
        throw createErrorWithMessage("Saved location not found", "");
      }

      if (!savedLocation.is_active) {
        throw createErrorWithMessage("Saved location is not active", "");
      }

      return savedLocation;
    } catch (error: unknown) {
      throw createErrorWithMessage("Failed to retrieve saved location", error);
    }
  }
  public async updateSavedLocation(
    locationId: number,
    input: {
      location_nick_name?: string;
      unit_street?: string;
      unit_city?: string;
      unit_state?: string;
      unit_zipcode?: string;
    }
  ) {
    const {
      location_nick_name,
      unit_street,
      unit_city,
      unit_state,
      unit_zipcode,
    } = input;

    // --- Validation - Throw errors instead of returning ---
    if (!locationId || Number.isNaN(locationId)) {
      throw createErrorWithMessage("Invalid or missing location ID", "");
    }

    // --- Check if saved location exists ---
    try {
      const existingLocation = await prisma.service_request_location.findUnique(
        {
          where: { service_request_location_id: locationId },
        }
      );

      if (!existingLocation) {
        throw new Error(`Saved location with ID ${locationId} not found`);
      }

      if (!existingLocation.is_active) {
        throw new Error("Cannot update inactive saved location");
      }
    } catch (error) {
      throw createErrorWithMessage("Location verification failed", error);
    }

    // --- Update saved location ---
    try {
      const updatedLocation = await prisma.service_request_location.update({
        where: {
          service_request_location_id: locationId,
        },
        data: {
          location_nick_name,
          unit_street,
          unit_city,
          unit_state,
          unit_zipcode,
          updated_at: new Date(),
        },
      });

      return updatedLocation;
    } catch (err: unknown) {
      throw createErrorWithMessage("Failed to update saved location", err);
    }
  }
  public async deleteSavedLocation(locationId: number) {
    // --- Validation - Throw errors instead of returning ---
    if (!locationId || Number.isNaN(locationId)) {
      throw createErrorWithMessage("Invalid or missing location ID", "");
    }

    // --- Check if saved location exists ---
    try {
      const existingLocation = await prisma.service_request_location.findUnique(
        {
          where: { service_request_location_id: locationId },
        }
      );

      if (!existingLocation) {
        throw new Error(`Saved location with ID ${locationId} not found`);
      }

      if (!existingLocation.is_active) {
        throw new Error("Saved location is already deleted");
      }
    } catch (error) {
      throw createErrorWithMessage("Location verification failed", error);
    }

    // --- Soft delete saved location ---
    try {
      const deletedLocation = await prisma.service_request_location.update({
        where: {
          service_request_location_id: locationId,
        },
        data: {
          is_active: false,
          updated_at: new Date(),
        },
      });

      return deletedLocation;
    } catch (err: unknown) {
      throw createErrorWithMessage("Failed to delete saved location", err);
    }
  }
  public async generateServiceRequestDetailsPDF(serviceRequestId: number) {
    this.validateServiceRequestId(serviceRequestId);

    const serviceRequest = await this.getServiceRequestForPDF(serviceRequestId);
    const serviceIssues = await this.getServiceIssuesForPDF(
      serviceRequest.service_issues_lookup_ids
    );
    const attachments = await this.getAttachmentsForPDF(
      serviceRequest.attachment_ids
    );

    return this.generatePDFDocument(
      serviceRequest,
      serviceIssues,
      attachments,
      serviceRequestId
    );
  }

  private validateServiceRequestId(serviceRequestId: number) {
    if (!serviceRequestId || Number.isNaN(serviceRequestId)) {
      throw createErrorWithMessage("Invalid or missing service request ID", "");
    }
  }

  private async getServiceRequestForPDF(serviceRequestId: number) {
    try {
      const serviceRequest = await prisma.service_request.findUnique({
        where: { service_request_id: serviceRequestId },
        include: {
          equipment_ref: true,
          account: {
            include: { customer: true },
          },
          user: true,
          service_urgency_ref: true,
          service_urgency_type_lookup_ref: true,
          tire_size_lookup: true,
          service_saved_location: true,
          workorder: true,
          facility_lookup: true,
        },
      });

      if (!serviceRequest) {
        throw new Error(
          `Service request with ID ${serviceRequestId} not found`
        );
      }

      return serviceRequest;
    } catch (error) {
      throw createErrorWithMessage("Failed to retrieve service request", error);
    }
  }

  private async getServiceIssuesForPDF(serviceIssuesLookupIds: number[]) {
    try {
      return await prisma.service_issues_lookup.findMany({
        where: {
          service_issues_lookup_id: {
            in: serviceIssuesLookupIds,
          },
        },
      });
    } catch (error) {
      throw createErrorWithMessage("Failed to retrieve service issues", error);
    }
  }

  private async getAttachmentsForPDF(attachmentIds: number[]) {
    try {
      return await prisma.attachment.findMany({
        where: {
          attachment_id: {
            in: attachmentIds,
          },
        },
        select: {
          attachment_id: true,
          name: true,
          mime_type: true,
          url: true,
        },
      });
    } catch (error) {
      throw createErrorWithMessage("Failed to retrieve attachments", error);
    }
  }

  private async generatePDFDocument(
    serviceRequest: ServiceRequestForPDF,
    serviceIssues: ServiceIssueForPDF[],
    attachments: AttachmentForPDF[],
    serviceRequestId: number
  ) {
    try {
      const doc = new PDFDocument({ margin: PDF_LAYOUT.MARGIN, size: "A4" });

      this.addPDFHeader(doc);
      this.addWorkOrderSection(doc, serviceRequest);
      this.addRequestInformationSection(doc, serviceRequest, serviceIssues);
      await this.addAttachmentsSection(doc, attachments);

      return await this.finalizePDF(doc, serviceRequestId);
    } catch (err: unknown) {
      throw createErrorWithMessage("Failed to generate PDF", err);
    }
  }

  private addPDFHeader(doc: InstanceType<typeof PDFDocument>) {
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .text("Service Request Details", { align: "left" })
      .moveDown(0.2);
  }

  private addWorkOrderSection(
    doc: InstanceType<typeof PDFDocument>,
    serviceRequest: ServiceRequestForPDF
  ) {
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Associate Work Orders", { align: "left" })
      .moveDown(0.2);

    const workOrderFields = this.buildWorkOrderFields(serviceRequest);
    this.addFieldsToPDF(doc, workOrderFields);
    doc.moveDown(0.3);
  }

  private formatDateForPDF(date: Date | null): string {
    if (!date) return "N/A";

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours || 12; // 0 should be 12
    const minutesStr = minutes < 10 ? `0${minutes}` : minutes.toString();

    return `${month} ${day}, ${year}, ${hours}:${minutesStr} ${ampm}`;
  }

  private formatServiceLocation(serviceRequest: ServiceRequestForPDF): string {
    const parts = [
      serviceRequest.unit_street,
      serviceRequest.unit_city,
      serviceRequest.unit_state,
      serviceRequest.unit_zipcode,
    ].filter((part) => part && part.trim() !== "");

    return parts.length > 0 ? parts.join(", ") : "N/A";
  }

  private isEmpty(value: string | null | undefined): boolean {
    return !value || value.trim() === "";
  }

  private buildWorkOrderFields(serviceRequest: ServiceRequestForPDF) {
    const fields = [
      {
        label: "Work Order ID",
        value: serviceRequest.workorder?.[0]?.workorder_id?.toString() ?? "N/A",
      },
      {
        label: "TEN Care Event",
        value: `TNX${String(serviceRequest.service_request_id).padStart(
          8,
          "0"
        )}`,
      },
      {
        label: "Status",
        value: serviceRequest.workorder?.[0]?.workorder_status ?? "Active",
      },
      {
        label: "Opened On",
        value: this.formatDateForPDF(serviceRequest.created_at),
      },
    ];

    // Filter out N/A values
    return fields.filter((field) => field.value !== "N/A");
  }

  private addRequestInformationSection(
    doc: InstanceType<typeof PDFDocument>,
    serviceRequest: ServiceRequestForPDF,
    serviceIssues: ServiceIssueForPDF[]
  ) {
    // Reset to left margin before starting Request Information section
    doc.x = PDF_LAYOUT.LEFT_COLUMN;
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Request Information", { align: "left" })
      .moveDown(0.2);

    const issuesText =
      serviceIssues.map((issue) => issue.type_name).join(", ") || "N/A";
    const requestFields = this.buildRequestFields(serviceRequest, issuesText);
    this.addFieldsToPDF(doc, requestFields);
  }

  private buildRequestFields(
    serviceRequest: ServiceRequestForPDF,
    issuesText: string
  ) {
    const basicFields = this.buildBasicFields(serviceRequest);
    const serviceFields = this.buildServiceFields(serviceRequest);
    const contactFields = this.buildContactFields(serviceRequest);
    const locationFields = this.buildLocationFields(serviceRequest, issuesText);

    const allFields = [
      ...basicFields,
      ...serviceFields,
      ...contactFields,
      ...locationFields,
    ];
    return allFields.filter((field) => field.value !== "N/A");
  }

  private buildBasicFields(serviceRequest: ServiceRequestForPDF) {
    return [
      {
        label: "Trailer Number",
        value: this.getTrailerNumber(serviceRequest),
      },
      {
        label: "Leased / Rented From",
        value: serviceRequest.non_ten_unit_company ?? "N/A",
      },
      {
        label: "Carrier Name",
        value: serviceRequest.non_ten_carrier ?? "N/A",
      },
      {
        label: "VIN",
        value: serviceRequest.non_ten_vin_number ?? "N/A",
      },
      {
        label: "Customer",
        value: this.getCustomerDisplayText(serviceRequest),
      },
    ];
  }

  private buildServiceFields(serviceRequest: ServiceRequestForPDF) {
    return [
      {
        label: "Service Requested",
        value: serviceRequest.service_urgency_ref?.urgency_code ?? "N/A",
      },
      {
        label: "Type of Service",
        value:
          serviceRequest.service_urgency_type_lookup_ref?.selection_name ??
          "N/A",
      },
      {
        label: "Service Available Starting",
        value: this.formatDateForPDF(
          serviceRequest.service_type_repairedfrom_date ?? null
        ),
      },
      {
        label: "Service Repaired By",
        value: this.formatDateForPDF(
          serviceRequest.service_type_repairedby_date ?? null
        ),
      },
      {
        label: "TEN Facility",
        value: serviceRequest.facility_lookup?.facility_name ?? "N/A",
      },
      {
        label: "Pick-up Requested",
        value: this.formatBooleanValue(serviceRequest.is_request_pickup),
      },
      {
        label: "Tire Size",
        value: serviceRequest.tire_size_lookup?.size_display ?? "N/A",
      },
      {
        label: "Loaded?",
        value: this.formatBooleanValue(serviceRequest.is_loaded),
      },
      {
        label: "Hazardous Material?",
        value: this.formatBooleanValue(serviceRequest.is_hazardous),
      },
    ];
  }

  private buildContactFields(serviceRequest: ServiceRequestForPDF) {
    return [
      {
        label: "Driver Name",
        value: this.getDriverDisplayText(serviceRequest),
      },
      {
        label: "Primary Contact",
        value: this.getPrimaryContactDisplayText(serviceRequest),
      },
      {
        label: "Secondary Contact",
        value: this.getSecondaryContactDisplayText(serviceRequest),
      },
      {
        label: "PO/Reference Number",
        value: serviceRequest.po_reference_number ?? "N/A",
      },
    ];
  }

  private buildLocationFields(
    serviceRequest: ServiceRequestForPDF,
    issuesText: string
  ) {
    return [
      {
        label: "Service Location",
        value: this.formatServiceLocation(serviceRequest),
      },
      {
        label: "Location Notes",
        value: serviceRequest.location_notes ?? "N/A",
      },
      {
        label: "Issues",
        value: issuesText || "N/A",
      },
      {
        label: "Description",
        value: serviceRequest.issue_description ?? "N/A",
      },
      {
        label: "Latitude",
        value: this.formatCoordinateValue(serviceRequest.latitude),
      },
      {
        label: "Longitude",
        value: this.formatCoordinateValue(serviceRequest.longititude),
      },
    ];
  }

  private getTrailerNumber(serviceRequest: ServiceRequestForPDF): string {
    return (
      serviceRequest.equipment_ref?.unit_number ??
      serviceRequest.non_ten_unit_number ??
      "N/A"
    );
  }

  private getCustomerDisplayText(serviceRequest: ServiceRequestForPDF): string {
    const account = serviceRequest.account;
    if (account?.account_number && account?.account_name) {
      return `(${account.account_number}) ${account.account_name}`;
    }
    return "N/A";
  }

  private formatBooleanValue(value: boolean | null | undefined): string {
    return value === true ? "Yes" : "No";
  }

  private getDriverDisplayText(serviceRequest: ServiceRequestForPDF): string {
    if (serviceRequest.driver_name && serviceRequest.driver_phone_nuber) {
      return `${serviceRequest.driver_name} / ${serviceRequest.driver_phone_nuber}`;
    }
    return "N/A";
  }

  private getPrimaryContactDisplayText(
    serviceRequest: ServiceRequestForPDF
  ): string {
    const name = serviceRequest.primary_contact_name;
    const phone = serviceRequest.primary__contact_phonenumber;
    const email = serviceRequest.primary_contact_email;

    if (name && phone && email) {
      return `${name} / ${phone} / ${email}`;
    }
    return "N/A";
  }

  private getSecondaryContactDisplayText(
    serviceRequest: ServiceRequestForPDF
  ): string {
    const name = serviceRequest.secondary_contact_name;
    const phone = serviceRequest.secondary__contact_phonenumber;
    const email = serviceRequest.secondary_contact_email;

    if (name && phone && email) {
      return `${name} / ${phone} / ${email}`;
    }
    return "N/A";
  }

  private formatCoordinateValue(
    value: PrismaDecimal | null | undefined
  ): string {
    return value ? value.toString() : "N/A";
  }

  private addFieldsToPDF(
    doc: InstanceType<typeof PDFDocument>,
    fields: { label: string; value: string }[]
  ) {
    const leftColumn = PDF_LAYOUT.LEFT_COLUMN;
    const rightColumn = PDF_LAYOUT.RIGHT_COLUMN;
    const fieldSpacing = PDF_LAYOUT.FIELD_SPACING;
    let currentY = doc.y;

    for (const field of fields) {
      // Check if we need a new page
      if (currentY > 700) {
        doc.addPage();
        currentY = PDF_LAYOUT.LEFT_COLUMN;
      }

      // Add label
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#666666")
        .text(field.label, leftColumn, currentY);

      // Calculate text height for proper wrapping
      const textHeight = doc.heightOfString(field.value, {
        width: 250,
        align: "left",
      });

      // Add value with proper text wrapping
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#000000")
        .text(field.value, rightColumn, currentY, {
          width: 250,
          align: "left",
          lineGap: 2,
        });

      // Move to next field position with proper spacing
      currentY += Math.max(textHeight + 5, fieldSpacing);
    }

    // Update doc.y to current position
    doc.y = currentY;
  }

  private async addAttachmentsSection(
    doc: InstanceType<typeof PDFDocument>,
    attachments: AttachmentForPDF[]
  ) {
    if (attachments.length === 0) return;

    this.setupAttachmentsPage(doc);
    this.addAttachmentsHeader(doc);

    const leftColumn = PDF_LAYOUT.LEFT_COLUMN;
    const maxImageWidth = PDF_LAYOUT.MAX_IMAGE_WIDTH;
    const maxImageHeight = PDF_LAYOUT.MAX_IMAGE_HEIGHT;
    const imageSpacing = PDF_LAYOUT.IMAGE_SPACING;

    for (let i = 0; i < attachments.length; i++) {
      const attachment = attachments[i];
      await this.addSingleAttachment(
        doc,
        attachment,
        i + 1,
        leftColumn,
        maxImageWidth,
        maxImageHeight,
        imageSpacing
      );
    }
  }

  private setupAttachmentsPage(doc: InstanceType<typeof PDFDocument>) {
    if (doc.y > PDF_LAYOUT.PAGE_BREAK_THRESHOLD) {
      doc.addPage();
      doc.y = PDF_LAYOUT.LEFT_COLUMN;
    } else {
      doc.moveDown(0.3);
    }
  }

  private addAttachmentsHeader(doc: InstanceType<typeof PDFDocument>) {
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text("Attachments", { align: "left" })
      .moveDown(0.2);
  }

  private async addSingleAttachment(
    doc: InstanceType<typeof PDFDocument>,
    attachment: AttachmentForPDF,
    index: number,
    leftColumn: number,
    maxImageWidth: number,
    maxImageHeight: number,
    imageSpacing: number
  ) {
    // Check if we need a new page
    if (doc.y > PDF_LAYOUT.PAGE_BREAK_THRESHOLD) {
      doc.addPage();
      doc.y = PDF_LAYOUT.LEFT_COLUMN;
    }

    // Add attachment name
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#000000")
      .text(
        `${index}. ${attachment.name ?? "Attachment"} (${
          attachment.mime_type ?? "Unknown type"
        })`,
        leftColumn,
        doc.y
      );

    doc.moveDown(0.1);

    // Try to add image if it's an image type and has URL
    if (attachment.url && this.isImageType(attachment.mime_type)) {
      await this.addImageToPDF(
        doc,
        attachment,
        leftColumn,
        maxImageWidth,
        maxImageHeight,
        imageSpacing
      );
    } else {
      this.addNonImageAttachment(doc, leftColumn);
    }
  }

  private async addImageToPDF(
    doc: InstanceType<typeof PDFDocument>,
    attachment: AttachmentForPDF,
    leftColumn: number,
    maxImageWidth: number,
    maxImageHeight: number,
    imageSpacing: number
  ) {
    try {
      const imageBuffer = await this.downloadImage(attachment.url!);
      if (imageBuffer) {
        const imageDimensions = this.calculateImageDimensions(
          imageBuffer,
          maxImageWidth,
          maxImageHeight
        );

        doc.image(imageBuffer, leftColumn, doc.y, {
          width: imageDimensions.width,
          height: imageDimensions.height,
          fit: [imageDimensions.width, imageDimensions.height],
        });

        doc.y += imageDimensions.height + imageSpacing;
      } else {
        this.addImageErrorText(doc, leftColumn);
      }
    } catch (error) {
      logger.warn(
        `Failed to process image for attachment ${attachment.attachment_id}:`,
        error
      );
      this.addImageErrorText(doc, leftColumn);
    }
  }

  private addImageErrorText(
    doc: InstanceType<typeof PDFDocument>,
    leftColumn: number
  ) {
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#666666")
      .text("(Image could not be loaded)", leftColumn, doc.y);
    doc.moveDown(0.2);
  }

  private addNonImageAttachment(
    doc: InstanceType<typeof PDFDocument>,
    leftColumn: number
  ) {
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#666666")
      .text("(Non-image attachment)", leftColumn, doc.y);
    doc.moveDown(0.2);
  }

  private isImageType(mimeType: string | null | undefined): boolean {
    if (!mimeType) return false;
    return mimeType.startsWith("image/");
  }

  private async downloadImage(url: string): Promise<Buffer | null> {
    return new Promise((resolve) => {
      const protocol = url.startsWith("https:") ? https : http;

      protocol
        .get(url, (response) => {
          if (response.statusCode !== 200) {
            resolve(null);
            return;
          }

          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => {
            resolve(Buffer.concat(chunks));
          });
          response.on("error", () => {
            resolve(null);
          });
        })
        .on("error", () => {
          resolve(null);
        });
    });
  }

  private calculateImageDimensions(
    imageBuffer: Buffer,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    try {
      // For PDFKit, we'll use a simple approach - assume square-ish images and scale down
      // In a real implementation, you might want to use a library like 'image-size' to get actual dimensions
      const aspectRatio = 1.33; // Default aspect ratio (4:3)
      let width = maxWidth;
      let height = maxWidth / aspectRatio;

      if (height > maxHeight) {
        height = maxHeight;
        width = maxHeight * aspectRatio;
      }

      return { width, height };
    } catch (error) {
      // Fallback to default size
      // Log error for debugging but don't expose to user
      logger.warn(
        "Failed to calculate image dimensions, using default size:",
        error
      );
      return { width: maxWidth, height: maxHeight };
    }
  }

  private async finalizePDF(
    doc: InstanceType<typeof PDFDocument>,
    serviceRequestId: number
  ) {
    doc.end();
    const chunks: Buffer[] = [];

    return await new Promise<{ buffer: Buffer; filename: string }>(
      (resolve, reject) => {
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const isoString = new Date().toISOString();
          const cleanedString = isoString.replaceAll(/[:.]/g, "-");
          const timestamp = cleanedString.slice(0, -5);
          const filename = `service_request_details_${serviceRequestId}_${timestamp}.pdf`;
          resolve({ buffer, filename });
        });
        doc.on("error", reject);
      }
    );
  }
  public async downloadServiceRequestsHistory(input: {
    columns: { label: string; field: string; maxWidth?: number }[];
    query?: {
      account_ids?: number[];
      downloadAll?: boolean;
      location?: string;
      sort?: Record<string, string>;
      trailer?: string;
      submitted_on?: string;
      submitted_by?: string;
      issue?: string;
      repaired_by?: string;
    };
  }) {
    this.validateDownloadInput(input);

    const whereConditions = this.buildDownloadWhereConditions(input.query);
    const orderBy = this.buildDownloadOrderBy(input.query?.sort);

    const serviceRequests = await this.fetchServiceRequestsForDownload(
      whereConditions,
      orderBy
    );
    const issueMap = await this.buildIssueMapForDownload(serviceRequests);
    const transformedData = this.transformDataForDownload(
      serviceRequests,
      issueMap,
      input.columns
    );

    return await this.generateExcelFile(transformedData);
  }

  private validateDownloadInput(input: {
    columns: { label: string; field: string; maxWidth?: number }[];
  }) {
    const { columns } = input;
    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      throw createErrorWithMessage(
        "Columns are required for Excel generation",
        ""
      );
    }
  }

  private buildDownloadWhereConditions(query?: {
    account_ids?: number[];
    downloadAll?: boolean;
    location?: string;
    trailer?: string;
    submitted_on?: string;
    submitted_by?: string;
    repaired_by?: string;
  }): Record<string, unknown> {
    const whereConditions: Record<string, unknown> = {};
    const andConditions: unknown[] = [];

    this.addAccountFilter(andConditions, query);
    this.addLocationFilter(andConditions, query);
    this.addTrailerFilter(andConditions, query);
    this.addSubmittedOnFilter(andConditions, query);
    this.addSubmittedByFilter(andConditions, query);
    this.addRepairedByFilter(andConditions, query);

    if (andConditions.length > 0) {
      whereConditions.AND = andConditions;
    }

    return whereConditions;
  }

  private addAccountFilter(
    andConditions: unknown[],
    query?: {
      account_ids?: number[];
      downloadAll?: boolean;
    }
  ) {
    if (
      query?.account_ids &&
      Array.isArray(query.account_ids) &&
      query.downloadAll
    ) {
      andConditions.push({
        account_id: { in: query.account_ids.map((id: number) => id) },
      });
    }
  }

  private addLocationFilter(
    andConditions: unknown[],
    query?: { location?: string }
  ) {
    if (query?.location) {
      andConditions.push({
        OR: [
          { unit_street: { contains: query.location, mode: "insensitive" } },
          { unit_city: { contains: query.location, mode: "insensitive" } },
          { unit_state: { contains: query.location, mode: "insensitive" } },
        ],
      });
    }
  }

  private addTrailerFilter(
    andConditions: unknown[],
    query?: { trailer?: string }
  ) {
    if (query?.trailer) {
      andConditions.push({
        OR: [
          {
            equipment_ref: {
              unit_number: { contains: query.trailer, mode: "insensitive" },
            },
          },
          {
            non_ten_unit_number: {
              contains: query.trailer,
              mode: "insensitive",
            },
          },
        ],
      });
    }
  }

  private addSubmittedOnFilter(
    andConditions: unknown[],
    query?: { submitted_on?: string }
  ) {
    if (query?.submitted_on) {
      const submittedDate = new Date(query.submitted_on);
      const nextDay = new Date(submittedDate);
      nextDay.setDate(nextDay.getDate() + 1);
      andConditions.push({
        created_at: { gte: submittedDate, lt: nextDay },
      });
    }
  }

  private addSubmittedByFilter(
    andConditions: unknown[],
    query?: { submitted_by?: string }
  ) {
    if (query?.submitted_by) {
      andConditions.push({
        user: {
          OR: [
            {
              first_name: {
                contains: query.submitted_by,
                mode: "insensitive",
              },
            },
            {
              last_name: {
                contains: query.submitted_by,
                mode: "insensitive",
              },
            },
            { email: { contains: query.submitted_by, mode: "insensitive" } },
          ],
        },
      });
    }
  }

  private addRepairedByFilter(
    andConditions: unknown[],
    query?: { repaired_by?: string }
  ) {
    if (query?.repaired_by) {
      const repairedDate = new Date(query.repaired_by);
      if (!Number.isNaN(repairedDate.getTime())) {
        const nextDay = new Date(repairedDate);
        nextDay.setDate(nextDay.getDate() + 1);
        andConditions.push({
          service_type_repairedby_date: { gte: repairedDate, lt: nextDay },
        });
      }
    }
  }

  private buildDownloadOrderBy(
    sort?: Record<string, string>
  ): Record<string, string> {
    return sort ?? { created_at: "desc" };
  }

  private async fetchServiceRequestsForDownload(
    whereConditions: Record<string, unknown>,
    orderBy: Record<string, string>
  ) {
    return await prisma.service_request.findMany({
      where: whereConditions,
      include: {
        equipment_ref: true,
        account: { include: { customer: true } },
        user: true,
        service_urgency_ref: true,
        workorder: true,
      },
      orderBy,
    });
  }

  private async buildIssueMapForDownload(
    serviceRequests: { service_issues_lookup_ids: number[] }[]
  ): Promise<Map<number, string>> {
    const allIssueIds = [
      ...new Set(serviceRequests.flatMap((sr) => sr.service_issues_lookup_ids)),
    ];

    const serviceIssues = await prisma.service_issues_lookup.findMany({
      where: { service_issues_lookup_id: { in: allIssueIds } },
      select: { service_issues_lookup_id: true, type_name: true },
    });

    const issueMap = new Map<number, string>();
    for (const issue of serviceIssues) {
      issueMap.set(issue.service_issues_lookup_id, issue.type_name);
    }

    return issueMap;
  }

  private transformDataForDownload(
    serviceRequests: {
      service_issues_lookup_ids: number[];
      equipment_ref?: { unit_number: string } | null;
      non_ten_unit_number?: string | null;
      created_at?: Date | null;
      user?: { first_name?: string | null; last_name?: string | null } | null;
      service_type_repairedby_date?: Date | null;
      unit_street?: string | null;
      unit_city?: string | null;
      unit_state?: string | null;
    }[],
    issueMap: Map<number, string>,
    columns: { field: string }[]
  ) {
    return serviceRequests.map((sr) => {
      const row: Record<string, ExcelCellValue> = {};

      const issueNames = sr.service_issues_lookup_ids
        .map((id: number) => issueMap.get(id) ?? "")
        .filter((name: string) => name !== "")
        .join(", ");

      for (const { field } of columns) {
        row[field] = this.getFieldValue(sr, field, issueNames);
      }

      return row;
    });
  }

  private getFieldValue(
    sr: {
      equipment_ref?: { unit_number: string } | null;
      non_ten_unit_number?: string | null;
      created_at?: Date | null;
      user?: { first_name?: string | null; last_name?: string | null } | null;
      service_type_repairedby_date?: Date | null;
      unit_street?: string | null;
      unit_city?: string | null;
      unit_state?: string | null;
    },
    field: string,
    issueNames: string
  ): ExcelCellValue {
    switch (field) {
      case "trailer":
        return sr.equipment_ref?.unit_number ?? sr.non_ten_unit_number ?? "N/A";
      case "submitted_on":
        return sr.created_at?.toLocaleDateString() ?? "";
      case "submitted_by":
        return (
          `${sr.user?.first_name ?? ""} ${sr.user?.last_name ?? ""}`.trim() ||
          "System"
        );
      case "issue":
        return issueNames || "N/A";
      case "repaired_by":
        if (sr.service_type_repairedby_date) {
          const date = new Date(sr.service_type_repairedby_date);
          return date.toLocaleDateString();
        }
        return "N/A";
      case "location":
        return `${sr.unit_street ?? ""}, ${sr.unit_city ?? ""}, ${
          sr.unit_state ?? ""
        }`.trim();
      default:
        return "N/A";
    }
  }

  private async generateExcelFile(
    transformedData: Record<string, ExcelCellValue>[]
  ): Promise<{ buffer: Buffer; filename: string }> {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Service Requests");

      // Add headers if data exists
      if (transformedData.length > 0) {
        const headers = Object.keys(transformedData[0]);
        worksheet.addRow(headers);

        // Style the header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };
      }

      // Add data rows
      for (const rowData of transformedData) {
        const row = Object.values(rowData);
        worksheet.addRow(row);
      }

      // Auto-fit columns
      for (const column of worksheet.columns) {
        column.width = 15;
      }

      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const isoString = new Date().toISOString();
      const cleanedString = isoString.replaceAll(/[:.]/g, "-");
      const timestamp = cleanedString.slice(0, -5);
      const filename = `service_requests_history_${timestamp}.xlsx`;

      return { buffer, filename };
    } catch (error: unknown) {
      throw createErrorWithMessage("Failed to generate Excel file", error);
    }
  }

  public async getServiceCategories() {
    try {
      const serviceCategories = await prisma.service_issues_lookup.findMany({
        where: {
          status: "ACTIVE",
        },
        select: {
          service_issues_lookup_id: true,
          type_name: true,
          status: true,
          created_at: true,
        },
        orderBy: {
          service_issues_lookup_id: "asc",
        },
      });

      if (!serviceCategories?.length) {
        throw createErrorWithMessage("No active service categories found", "");
      }

      return serviceCategories;
    } catch (error: unknown) {
      throw createErrorWithMessage(
        "Failed to retrieve service categories",
        error
      );
    }
  }
  public async getServiceRequestById(serviceRequestId: number) {
    // --- Validation - Throw errors instead of returning ---
    if (!serviceRequestId || Number.isNaN(serviceRequestId)) {
      throw createErrorWithMessage("Invalid or missing service request ID", "");
    }

    // --- Get service request with all relations ---
    try {
      const serviceRequest = await prisma.service_request.findUnique({
        where: { service_request_id: serviceRequestId },
        include: {
          equipment_ref: true,
          account: {
            include: { customer: true },
          },
          user: {
            select: {
              user_id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          service_urgency_ref: true,
          service_urgency_type_lookup_ref: true,
          tire_size_lookup: true,
          service_saved_location: true,
          facility_lookup: true,
          workorder: true,
        },
      });

      if (!serviceRequest) {
        throw new Error(
          `Service request with ID ${serviceRequestId} not found`
        );
      }

      // Get service issues separately
      const serviceIssues = await prisma.service_issues_lookup.findMany({
        where: {
          service_issues_lookup_id: {
            in: serviceRequest.service_issues_lookup_ids,
          },
        },
      });

      // Get attachments separately
      const attachments = await prisma.attachment.findMany({
        where: {
          attachment_id: {
            in: serviceRequest.attachment_ids,
          },
        },
        select: {
          attachment_id: true,
          name: true,
          url: true,
          description: true,
          mime_type: true,
          date_uploaded: true,
        },
      });

      // --- Return service request details ---
      const serviceRequestDetails = {
        service_request_id: serviceRequest.service_request_id,
        ten_care_event: `TNX${String(
          serviceRequest.service_request_id
        ).padStart(8, "0")}`,
        work_order_id: serviceRequest.workorder?.[0]?.workorder_id || null,
        status: serviceRequest.workorder?.[0]?.workorder_status ?? "Active",
        created_at: serviceRequest.created_at,
        trailer_number:
          serviceRequest.equipment_ref?.unit_number ??
          serviceRequest.non_ten_unit_number,
        non_ten_unit_company: serviceRequest.non_ten_unit_company,
        non_ten_carrier: serviceRequest.non_ten_carrier,
        non_ten_vin_number: serviceRequest.non_ten_vin_number,
        customer_name: serviceRequest.account?.customer?.customer_name,
        customer_code: serviceRequest.account?.customer?.reference_number,
        account_id: serviceRequest.account_id,
        account_name: serviceRequest.account?.account_name,
        account_number: serviceRequest.account?.account_number,
        facility_name: serviceRequest.facility_lookup?.facility_name,
        facility_code: serviceRequest.facility_lookup?.facility_code,
        service_urgency_type:
          serviceRequest.service_urgency_type_lookup_ref?.selection_name,
        service_urgency_type_code:
          serviceRequest.service_urgency_type_lookup_ref?.selection_code,
        service_urgency: serviceRequest.service_urgency_ref?.urgency_code,
        service_urgency_description:
          serviceRequest.service_urgency_ref?.description,
        emergency_contact_date: serviceRequest.emergency_contact_date,
        service_type_repairedfrom_date:
          serviceRequest.service_type_repairedfrom_date,
        service_location: {
          street: serviceRequest.unit_street,
          city: serviceRequest.unit_city,
          state: serviceRequest.unit_state,
          zipcode: serviceRequest.unit_zipcode,
          address: serviceRequest.address,
          location_nick_name: serviceRequest.location_nick_name,
          location_notes: serviceRequest.location_notes,
        },
        tire_size: serviceRequest.tire_size_lookup?.size_display,
        tire_size_code: serviceRequest.tire_size_lookup?.size_code,
        other_type_size: serviceRequest.other_type_size,
        saved_location:
          serviceRequest.service_saved_location?.location_nick_name,
        is_gps_location: serviceRequest.is_gps_location,
        gps_location: {
          address: serviceRequest.address,
          latitude: serviceRequest.latitude,
          longitude: serviceRequest.longititude,
        },
        technician_name: serviceRequest.workorder?.[0]?.technician_name,
        is_loaded: serviceRequest.is_loaded,
        is_hazardous: serviceRequest.is_hazardous,
        is_driver_available: serviceRequest.is_driver_available,
        driver_name: serviceRequest.driver_name,
        driver_phone: serviceRequest.driver_phone_nuber,
        primary_contact_name: serviceRequest.primary_contact_name,
        primary_contact_method: serviceRequest.primary_contact_method,
        primary_contact_phone: serviceRequest.primary__contact_phonenumber,
        primary_contact_email: serviceRequest.primary_contact_email,
        secondary_contact_name: serviceRequest.secondary_contact_name,
        secondary_contact_method: serviceRequest.secondary_contact_method,
        secondary_contact_phone: serviceRequest.secondary__contact_phonenumber,
        secondary_contact_email: serviceRequest.secondary_contact_email,
        to_save_location: serviceRequest.to_save_location,
        requested_by: serviceRequest.user?.email ?? "",
        repaired_by: serviceRequest.service_type_repairedby_date ?? null,
        is_request_pickup: serviceRequest.is_request_pickup,
        po_reference_number: serviceRequest.po_reference_number,
        equipment_id: serviceRequest.equipment_id,
        service_urgency_lookup_id: serviceRequest.service_urgency_lookup_id,
        service_urgency_type_lookup_id:
          serviceRequest.service_urgency_type_lookup_id,
        service_issues_lookup_ids: serviceRequest.service_issues_lookup_ids,
        tire_size_lookup_id: serviceRequest.tire_size_lookup_id,
        saved_location_id: serviceRequest.saved_location_id,
        facility_lookup_id: serviceRequest.facility_lookup_id,
        attachment_ids: serviceRequest.attachment_ids,
        created_by: serviceRequest.created_by,
        user_id: serviceRequest.created_by,
        user_name:
          serviceRequest.user?.first_name && serviceRequest.user?.last_name
            ? `${serviceRequest.user.first_name} ${serviceRequest.user.last_name}`
            : serviceRequest.user?.email ?? null,
        service_issues: serviceIssues.map(
          (issue: { type_name: string }) => issue.type_name
        ),
        issue_description: serviceRequest.issue_description,
        attachments: attachments.map(
          (attachment: {
            attachment_id: bigint;
            name: string | null;
            url: string | null;
            description: string | null;
            mime_type: string | null;
            date_uploaded: Date | null;
          }) => ({
            attachment_id: Number(attachment.attachment_id),
            name: attachment.name,
            url: attachment.url,
            description: attachment.description,
            mime_type: attachment.mime_type,
            date_uploaded: attachment.date_uploaded,
          })
        ),
      };

      return serviceRequestDetails;
    } catch (error: unknown) {
      throw createErrorWithMessage("Failed to retrieve service request", error);
    }
  }

  public async getServiceRequestsList(
    page = 1,
    perPage = 10,
    sort?: string,
    filters?: ServiceRequestListFilters,
    accountIds?: number[]
  ): Promise<ServiceRequestListResult> {
    try {
      const skip = (page - 1) * perPage;
      const where = this.buildWhereClause(filters, accountIds);
      const orderBy = this.buildOrderByClause(sort);

      const [total, serviceRequests] = await Promise.all([
        prisma.service_request.count({ where }),
        prisma.service_request.findMany({
          skip,
          take: perPage,
          where,
          orderBy,
          select: {
            service_request_id: true,
            equipment_id: true,
            non_ten_unit_number: true,
            created_at: true,
            service_issues_lookup_ids: true,
            address: true,
            unit_street: true,
            unit_city: true,
            unit_state: true,
            service_type_repairedby_date: true,
            equipment_ref: { select: { unit_number: true } },
            user: { select: { first_name: true, last_name: true } },
          },
        }),
      ]);

      const issueMap = await this.buildIssueMap(serviceRequests);
      const transformedData = this.transformServiceRequests(
        serviceRequests,
        issueMap
      );
      this.applySorting(transformedData, sort);

      const totalPages = Math.ceil(total / perPage);
      return { data: transformedData, total, page, perPage, totalPages };
    } catch (err: unknown) {
      throw new Error(
        "Failed to fetch service requests: " + (err as Error).message
      );
    }
  }

  private buildWhereClause(
    filters?: ServiceRequestListFilters,
    accountIds?: number[]
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (accountIds && accountIds.length > 0) {
      where.account_id = { in: accountIds };
    }

    if (!filters) return where;

    if (filters.trailer) {
      where.OR = [
        {
          non_ten_unit_number: {
            contains: filters.trailer,
            mode: "insensitive",
          },
        },
        {
          equipment_ref: {
            unit_number: { contains: filters.trailer, mode: "insensitive" },
          },
        },
      ];
    }

    if (filters.submitted_on) {
      const dateRange = this.createDateRange(filters.submitted_on);
      if (dateRange) where.created_at = dateRange;
    }

    if (filters.repaired_by) {
      const dateRange = this.createDateRange(filters.repaired_by);
      if (dateRange) where.service_type_repairedby_date = dateRange;
    }

    if (filters.submitted_by) {
      where.user = {
        OR: [
          {
            first_name: { contains: filters.submitted_by, mode: "insensitive" },
          },
          {
            last_name: { contains: filters.submitted_by, mode: "insensitive" },
          },
        ],
      };
    }

    if (filters.location) {
      where.AND = [
        {
          OR: [
            { address: { contains: filters.location, mode: "insensitive" } },
            {
              unit_street: { contains: filters.location, mode: "insensitive" },
            },
            { unit_city: { contains: filters.location, mode: "insensitive" } },
            { unit_state: { contains: filters.location, mode: "insensitive" } },
          ],
        },
      ];
    }

    return where;
  }

  private createDateRange(dateString: string): { gte: Date; lte: Date } | null {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return null;

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return { gte: startOfDay, lte: endOfDay };
  }

  private buildOrderByClause(sort?: string): Record<string, string> {
    const dbSortableFields = [
      "submitted_on",
      "service_type_repairedby_date",
      "service_request_id",
    ] as const;
    type SortField = (typeof dbSortableFields)[number];

    let orderBy: Record<string, string> = { service_request_id: "asc" };

    if (sort) {
      const [field, direction] = sort.split(":");
      const sortDir: "asc" | "desc" = direction === "desc" ? "desc" : "asc";

      if (dbSortableFields.includes(field as SortField)) {
        orderBy =
          field === "submitted_on"
            ? { created_at: sortDir }
            : ({ [field]: sortDir } as Record<string, string>);
      }
    }

    return orderBy;
  }

  private async buildIssueMap(
    serviceRequests: { service_issues_lookup_ids: number[] }[]
  ): Promise<Map<number, string>> {
    const allIssueIds = [
      ...new Set(serviceRequests.flatMap((sr) => sr.service_issues_lookup_ids)),
    ];
    const issueMap = new Map<number, string>();

    if (allIssueIds.length > 0) {
      const issues = await prisma.service_issues_lookup.findMany({
        where: { service_issues_lookup_id: { in: allIssueIds } },
        select: { service_issues_lookup_id: true, type_name: true },
      });
      for (const i of issues) {
        issueMap.set(i.service_issues_lookup_id, i.type_name);
      }
    }

    return issueMap;
  }

  private transformServiceRequests(
    serviceRequests: {
      service_request_id: number;
      non_ten_unit_number: string | null;
      created_at: Date;
      service_issues_lookup_ids: number[];
      address: string | null;
      unit_street: string | null;
      unit_city: string | null;
      unit_state: string | null;
      service_type_repairedby_date: Date | null;
      equipment_ref: { unit_number: string } | null;
      user: { first_name: string | null; last_name: string | null } | null;
    }[],
    issueMap: Map<number, string>
  ) {
    return serviceRequests.map((sr) => {
      const trailer =
        sr.equipment_ref?.unit_number ?? sr.non_ten_unit_number ?? "";
      const submittedBy = sr.user
        ? `${sr.user.first_name ?? ""} ${sr.user.last_name ?? ""}`.trim()
        : "";
      const issueList = sr.service_issues_lookup_ids
        .map((id: number) => issueMap.get(id) ?? "")
        .filter(Boolean);
      const issue = issueList.join(", ");
      const repairedBy = sr.service_type_repairedby_date ?? null;
      const loc = [sr.address, sr.unit_street, sr.unit_city, sr.unit_state]
        .filter(Boolean)
        .join(", ");

      return {
        service_request_id: sr.service_request_id,
        trailer,
        submitted_on: sr.created_at,
        submitted_by: submittedBy,
        issue,
        repaired_by: repairedBy,
        location: loc,
      };
    });
  }

  private applySorting(
    transformedData: {
      service_request_id: number;
      trailer: string;
      submitted_on: Date;
      submitted_by: string;
      issue: string;
      repaired_by: Date | null;
      location: string;
    }[],
    sort?: string
  ) {
    if (!sort) return;

    const [field, direction] = sort.split(":");
    const dir = direction === "desc" ? -1 : 1;
    const computedFields = ["issue", "submitted_by", "trailer", "location"];

    if (computedFields.includes(field)) {
      transformedData.sort(
        (a, b) =>
          (a[field as keyof typeof a]?.toString() ?? "").localeCompare(
            b[field as keyof typeof b]?.toString() ?? ""
          ) * dir
      );
    }
  }

  public async getAccountByEquipmentId(equipmentId: number) {
    this.validateEquipmentId(equipmentId);

    const equipment = await this.getEquipmentWithAccount(equipmentId);
    const account = this.extractAccountFromEquipment(equipment);

    const [pmEvent, telematics] = await Promise.all([
      this.getLatestPreventiveMaintenance(equipment.equipment_id),
      this.getLatestTelematics(equipment.unit_number),
    ]);

    return this.buildAccountResponse(account, pmEvent, telematics);
  }

  private validateEquipmentId(equipmentId: number) {
    if (!equipmentId || Number.isNaN(equipmentId)) {
      throw createErrorWithMessage("Invalid or missing equipment ID", "");
    }
  }

  private async getEquipmentWithAccount(equipmentId: number) {
    const equipment = await prisma.equipment.findUnique({
      where: { equipment_id: equipmentId },
      select: {
        equipment_id: true,
        unit_number: true,
        equipment_assignment: {
          take: 1,
          orderBy: { created_at: "desc" },
          select: {
            equipment_type_allocation_ref: {
              select: {
                account: {
                  select: {
                    account_id: true,
                    account_name: true,
                    account_number: true,
                    customer: {
                      select: {
                        customer_name: true,
                        reference_number: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!equipment) {
      throw createErrorWithMessage("Equipment not found", "");
    }

    return equipment;
  }

  private extractAccountFromEquipment(equipment: {
    equipment_assignment: {
      equipment_type_allocation_ref?: {
        account?: {
          account_id: number;
          account_name: string | null;
          account_number: string | null;
          customer?: {
            customer_name: string;
            reference_number: string;
          } | null;
        } | null;
      } | null;
    }[];
  }) {
    const assignment = equipment.equipment_assignment[0];
    if (!assignment?.equipment_type_allocation_ref?.account) {
      throw createErrorWithMessage("No account found for this equipment", "");
    }

    return assignment.equipment_type_allocation_ref.account;
  }

  private async getLatestPreventiveMaintenance(equipmentId: number) {
    return await prisma.preventive_maintenance_event.findFirst({
      where: { equipment_id: equipmentId },
      orderBy: { performed_date: "desc" },
      select: {
        performed_date: true,
        next_due_date: true,
      },
    });
  }

  private async getLatestTelematics(unitNumber: string) {
    return await prisma.telematics.findFirst({
      where: { unit_number: unitNumber },
      orderBy: { created_at: "desc" },
      select: {
        latitude: true,
        longitude: true,
        address: true,
        motion_status: true,
        recived_timestamp: true,
        vendor_timestamp: true,
        vendore_status: true,
        speed: true,
        heading: true,
        mileage: true,
        odometer: true,
        temperature: true,
        vendor_id: true,
        vendor_name: true,
        created_at: true,
      },
    });
  }

  private buildAccountResponse(
    account: {
      account_id: number;
      account_name: string | null;
      account_number: string | null;
      customer?: {
        customer_name: string;
        reference_number: string;
      } | null;
    },
    pmEvent: {
      performed_date?: Date | null;
      next_due_date?: Date | null;
    } | null,
    telematics: {
      latitude?: PrismaDecimal;
      longitude?: PrismaDecimal;
      address?: string | null;
      motion_status?: string | null;
      recived_timestamp?: Date | null;
      vendor_timestamp?: Date | null;
    } | null
  ) {
    return {
      account_id: account.account_id,
      account_name: account.account_name ?? "",
      account_number: account.account_number ?? "",
      customer_name: account.customer?.customer_name ?? "",
      reference_number: account.customer?.reference_number ?? "",
      display_text: `(${account.customer?.reference_number ?? ""}) ${
        account.customer?.customer_name ?? ""
      }`,
      maintenance_info: {
        last_pm_date: pmEvent?.performed_date ?? null,
        next_pm_due: pmEvent?.next_due_date ?? null,
      },
      gps_info: {
        latitude: telematics?.latitude ? String(telematics.latitude) : null,
        longitude: telematics?.longitude ? String(telematics.longitude) : null,
        address: telematics?.address ?? null,
        status: telematics?.motion_status ?? null,
        last_update:
          telematics?.recived_timestamp ?? telematics?.vendor_timestamp ?? null,
      },
    };
  }
  public async getServiceUrgencyTypesList() {
    try {
      const urgencyTypes = await prisma.service_urgency_type_lookup.findMany({
        where: {
          is_active: true,
        },
        select: {
          service_urgency_type_lookup_id: true,
          selection_code: true,
          selection_name: true,
          description: true,
          is_active: true,
        },
        orderBy: {
          service_urgency_type_lookup_id: "asc",
        },
      });

      if (!urgencyTypes?.length) {
        throw createErrorWithMessage(
          "No active service urgency types found",
          ""
        );
      }

      return urgencyTypes;
    } catch (error: unknown) {
      throw createErrorWithMessage(
        "Failed to retrieve service urgency types",
        error
      );
    }
  }
  public async getServiceUrgencyList() {
    try {
      const urgencyList = await prisma.service_urgency_lookup.findMany({
        where: {
          status: "ACTIVE",
        },
        select: {
          service_urgency_lookup_id: true,
          urgency_code: true,
          description: true,
          status: true,
          created_at: true,
          created_by: true,
        },
        orderBy: {
          service_urgency_lookup_id: "asc",
        },
      });
      if (!urgencyList?.length) {
        throw createErrorWithMessage(
          "No active service urgency records found",
          ""
        );
      }

      return urgencyList;
    } catch (error: unknown) {
      throw createErrorWithMessage(
        "Failed to retrieve service urgency list",
        error
      );
    }
  }
}
