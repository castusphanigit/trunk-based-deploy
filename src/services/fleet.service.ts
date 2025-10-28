/**
 * Fleet Service
 *
 * Handles business logic for fleet-related operations including:
 * - Fleet list view with complex filtering and pagination
 * - Equipment details retrieval
 * - Excel export functionality for fleet data
 * - Telematics data fetching from secondary database
 *
 * Security considerations:
 * - Input validation and sanitization
 * - SQL injection prevention through parameterized queries
 * - Authorization checks for data access
 * - Rate limiting on export operations
 *
 * @author Rajeswari
 * @version 1.0.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, max-len */

import prisma from "../config/database.config";
import {
  GetListViewParams,
  GetEquipmentDetailsParams,
  TelematicsRecord,
  GateInspectionRecord,
  PaginatedGateInspections,
} from "../types/dtos/fleet.dto";
import { FLEET_LIST_VIEW_SORT_FIELDS } from "../types/sorts/sortTypes";
import { buildOrderByFromSort } from "../utils/sort";
import { ExcelExporter, formatDate } from "../utils/excelUtils";
import { Prisma } from "@prisma/client";
import { secondaryPool } from "../config/secondarydb.config";
/**
 * Interface for paginated telematics data
 */
interface PaginatedTelematics {
  data: TelematicsRecord[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number
}

/**
 * Interface for statistics calculation result
 */
interface StatisticsResult {
  uniqueGpsEquipped: Set<number>;
  gpsEquippedCount: number;
  accessWithoutGpsCount: number;
  idleEquipIds: Set<number>;
  idleUnitsCount: number;
  expiredInspectionIds: Set<number>;
  overdueDotInspectionCount: number;
  overdueValidThroughIds: Set<number>;
  overDueCount: number;
  ersInProgressIds: Set<number>;
  ersInProgressCount: number
}

/**
 * Helper function to build equipment filters
 */
function buildEquipmentFilters(
  rest: Record<string, unknown>
): Prisma.equipmentWhereInput {
  type FilterBuilder = (value: unknown) => Prisma.equipmentWhereInput;

  const filterMap: Record<string, FilterBuilder> = {
    doorType: (val) => ({
      door_type: { contains: String(val), mode: "insensitive" },
    }),
    wallType: (val) => ({
      wall_type: { contains: String(val), mode: "insensitive" },
    }),
    vendorName: (val) => ({
      equipment_iot_device_ref: {
        is: {
          iot_device_ref: {
            iot_device_vendor_ref: {
              vendor_name: {
                contains: String(val).trim(),
                mode: "insensitive",
              },
            },
          },
        },
      },
    }),
    alarmCodeStatus: (val) => ({
      telematics: {
        alarm_code_status: { contains: String(val), mode: "insensitive" },
      },
    }),
    motionStatus: (val) => ({
      telematics: {
        motion_status: { contains: String(val), mode: "insensitive" },
      },
    }),
    vin: (val) => ({ vin: { contains: String(val), mode: "insensitive" } }),
    unitNumber: (val) => ({
      unit_number: { contains: String(val), mode: "insensitive" },
    }),
    telematicDeviceId: (val) => ({
      telematic_device_id: { contains: String(val), mode: "insensitive" },
    }),
    customerUnitNumber: (val) => ({
      customer_unit_number: { contains: String(val), mode: "insensitive" },
    }),
    breakType: (val) => ({
      brake_type: { contains: String(val), mode: "insensitive" },
    }),
    color: (val) => ({ color: { contains: String(val), mode: "insensitive" } }),
    liftGate: (val) => ({
      liftgate: { contains: String(val), mode: "insensitive" },
    }),
    tenBranch: (val) => ({
      ten_branch: { contains: String(val), mode: "insensitive" },
    }),
    dotCviStatus: (val) => ({
      dot_cvi_status: { contains: String(val), mode: "insensitive" },
    }),
    dotCviExpire: (val) => ({
      dot_cvi_expire: { equals: new Date(String(val)) },
    }),
    trailerHeight: (val) => ({
      trailer_height: { contains: String(val), mode: "insensitive" },
    }),
    trailerWidth: (val) => ({
      trailer_width: { contains: String(val), mode: "insensitive" },
    }),
    trailerLength: (val) => ({
      trailer_length: { contains: String(val), mode: "insensitive" },
    }),
    tireSize: (val) => ({
      tire_size: { contains: String(val), mode: "insensitive" },
    }),
    status: (val) => ({
      status: { contains: String(val), mode: "insensitive" },
    }),
    make: (val) => ({
      oem_make_model_ref: {
        make: { contains: String(val), mode: "insensitive" },
      },
    }),
    model: (val) => ({
      oem_make_model_ref: {
        model: { contains: String(val), mode: "insensitive" },
      },
    }),
    year: (val) => ({ oem_make_model_ref: { year: String(val) } }),
    equipmentType: (val) => ({
      equipment_type_lookup_ref: {
        equipment_type: { contains: String(val), mode: "insensitive" },
      },
    }),
    roofType: (val) => ({
      roof_type: { contains: String(val), mode: "insensitive" },
    }),
    floorType: (val) => ({
      floor_type: { contains: String(val), mode: "insensitive" },
    }),
    rimType: (val) => ({
      rim_type: { contains: String(val), mode: "insensitive" },
    }),
    licensePlateNumber: (val) => ({
      equipment_permit: {
        license_plate_number: { contains: String(val), mode: "insensitive" },
      },
    }),
    dateInService: (val) => ({
      date_in_service: { equals: new Date(String(val)) },
    }),
    lastPmDate: (val) => ({ last_pm_date: { equals: new Date(String(val)) } }),
    nextPmDue: (val) => ({ next_pm_due: { equals: new Date(String(val)) } }),
    lastMrDate: (val) => ({
      last_m_and_r_date: { equals: new Date(String(val)) },
    }),
    lastReeferPmDate: (val) => ({
      last_reefer_pm_date: { equals: new Date(String(val)) },
    }),
    nextReeferPmDue: (val) => ({
      next_reefer_pm_due: { equals: new Date(String(val)) },
    }),
    reeferMakeType: (val) => ({
      reefer_make_type: { contains: String(val), mode: "insensitive" },
    }),
    reeferSerial: (val) => ({
      reefer_serial: { contains: String(val), mode: "insensitive" },
    }),
    liftGateSerial: (val) => ({
      lifgate_serial: { contains: String(val), mode: "insensitive" },
    }),
    // Equipment assignment filters - these need to be handled at the assignment level
    // Note: activation_date and deactivation_date are on equipment_assignment table
    // These will be handled in the main query where clause
    driver_name: (val) => ({
      unit_number: {
        contains: String(val).replace("Driver ", ""),
        mode: "insensitive",
      },
    }),
    // Equipment load detail filters
    equipmentLoadStatus: (val) => {
      const searchValue = String(val).toUpperCase();
      return {
        equipment_load_detail: {
          some: {
            OR: [
              {
                load_status_lookup: {
                  field_code: { equals: searchValue },
                },
              },
              {
                equipment_load_status: { equals: searchValue },
              },
            ],
          },
        },
      };
    },
    // Telematics filters
    latitude: (val) => {
      const lat = parseFloat(String(val));
      // Support range-based filtering with ±0.1 degree tolerance
      return {
        telematics: {
          latitude: {
            gte: lat - 0.1,
            lte: lat + 0.1,
          },
        },
      };
    },
    longitude: (val) => {
      const lng = parseFloat(String(val));
      // Support range-based filtering with ±0.1 degree tolerance
      return {
        telematics: {
          longitude: {
            gte: lng - 0.1,
            lte: lng + 0.1,
          },
        },
      };
    },
    last_gps_coordinates: (val) => {
      const coords = String(val).split(",");
      if (coords.length === 2) {
        const lat = parseFloat(coords[0].trim());
        const lng = parseFloat(coords[1].trim());
        return {
          telematics: {
            AND: [
              {
                latitude: {
                  gte: lat - 0.1,
                  lte: lat + 0.1,
                },
              },
              {
                longitude: {
                  gte: lng - 0.1,
                  lte: lng + 0.1,
                },
              },
            ],
          },
        };
      }
      return {};
    },
    location: (val) => ({
      telematics: {
        address: { contains: String(val), mode: "insensitive" },
      },
    }),
    lastGpsUpdate: (val) => ({
      telematics: {
        recived_timestamp: { equals: new Date(String(val)) },
      },
    }),
    arrivalTime: (val) => ({
      telematics: {
        recived_timestamp: { equals: new Date(String(val)) },
      },
    }),
    lastGpsCoordinates: (val) => {
      const coords = String(val).split(",");
      if (coords.length === 2) {
        const lat = parseFloat(coords[0].trim());
        const lng = parseFloat(coords[1].trim());
        return {
          telematics: {
            AND: [
              {
                latitude: {
                  gte: lat - 0.1,
                  lte: lat + 0.1,
                },
              },
              {
                longitude: {
                  gte: lng - 0.1,
                  lte: lng + 0.1,
                },
              },
            ],
          },
        };
      }
      return {};
    },
  };

  return Object.entries(rest).reduce<Prisma.equipmentWhereInput>(
    (acc, [key, value]) => {
      if (value && filterMap[key]) return { ...acc, ...filterMap[key](value) };
      return acc;
    },
    {}
  );
}

/**
 * Helper function to build account filters
 */
function buildAccountFilters(
  rest: Record<string, unknown>
): Prisma.accountWhereInput {
  const accountFilters: Prisma.accountWhereInput = {};

  if (rest.accountNumber) {
    accountFilters.account_number = {
      contains: (rest.accountNumber as string).trim(),
      mode: "insensitive",
    };
  }

  if (rest.accountName) {
    accountFilters.account_name = {
      contains: (rest.accountName as string).trim(),
      mode: "insensitive",
    };
  }

  if (rest.account) {
    accountFilters.OR = [
      {
        account_number: {
          contains: (rest.account as string).trim(),
          mode: "insensitive",
        },
      },
      {
        account_name: {
          contains: (rest.account as string).trim(),
          mode: "insensitive",
        },
      },
    ];
  }

  return accountFilters;
}

/**
 * Helper function to build contract filters
 */
function buildContractFilters(
  rest: Record<string, unknown>
): Prisma.schedule_agreementWhereInput {
  const contractFilters: Prisma.schedule_agreementWhereInput = {};

  if (rest.contractTermType) {
    contractFilters.contract_term_type = {
      contains: (rest.contractTermType as string).trim(),
      mode: "insensitive",
    };
  }

  if (rest.contractStartDate) {
    contractFilters.master_agreement_ref = {
      contract_start_Date: {
        gte: new Date(rest.contractStartDate as string),
      },
    };
  }

  if (rest.contractEndDate) {
    contractFilters.termination_date = {
      lte: new Date(rest.contractEndDate as string),
    };
  }

  if (rest.agreementType) {
    contractFilters.schedule_type = {
      contains: (rest.agreementType as string).trim(),
      mode: "insensitive",
    };
  }

  return contractFilters;
}

/**
 * Helper function to calculate statistics
 */
async function calculateStatistics(
  equipmentIds: number[],
  allData: any[]
): Promise<StatisticsResult> {
  const mappingRows = await prisma.equipment_has_iot_device.findMany({
    where: { equipment_id: { in: equipmentIds }, status: "ACTIVE" },
    select: { equipment_id: true },
  });
  const uniqueGpsEquipped = new Set(mappingRows.map((r) => r.equipment_id));
  const gpsEquippedCount = uniqueGpsEquipped.size;
  const accessWithoutGpsCount = allData.length - gpsEquippedCount;

  const idleEquipIds = new Set<number>();
  allData.forEach((item) => {
    if (item.equipment_ref.telematics?.motion_status === "STOPPED") {
      idleEquipIds.add(item.equipment_ref.equipment_id);
    }
  });
  const idleUnitsCount = idleEquipIds.size;

  const expiredInspectionRows = await prisma.dot_inspection.findMany({
    where: {
      equipment_id: { in: equipmentIds },
      next_inspection_due: { lt: new Date() },
    },
    select: { equipment_id: true },
  });
  const expiredInspectionIds = new Set(
    expiredInspectionRows.map((r) => r.equipment_id)
  );
  const overdueDotInspectionCount = expiredInspectionIds.size;

  const overdueValidThroughRows = await prisma.dot_inspection.findMany({
    where: {
      equipment_id: { in: equipmentIds },
      valid_through: {
        lt: new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
      },
      status: "ACTIVE",
    },
    select: { equipment_id: true },
  });
  const overdueValidThroughIds = new Set(
    overdueValidThroughRows.map((r) => r.equipment_id)
  );
  const overDueCount = overdueValidThroughIds.size;

  const ersInProgressRows = await prisma.ers.findMany({
    where: {
      service_request: {
        equipment_id: { in: equipmentIds },
      },
      ers_status: "inprogress",
    },
    include: {
      service_request: {
        select: { equipment_id: true },
      },
    },
  });
  const ersInProgressIds = new Set(
    ersInProgressRows
      .map((r) => r.service_request?.equipment_id)
      .filter((id): id is number => id !== null && id !== undefined)
  );
  const ersInProgressCount = ersInProgressIds.size;

  return {
    uniqueGpsEquipped,
    gpsEquippedCount,
    accessWithoutGpsCount,
    idleEquipIds,
    idleUnitsCount,
    expiredInspectionIds,
    overdueDotInspectionCount,
    overdueValidThroughIds,
    overDueCount,
    ersInProgressIds,
    ersInProgressCount,
  };
}

/**
 * Helper function to get string sort values
 */
function getStringSortValue(item: any, field: string): string {
  const value = item[field];
  return typeof value === "string" ? value.toLowerCase() : "";
}

/**
 * Helper function to get date sort values
 */
function getDateSortValue(item: any, field: string): number {
  const value = item[field];
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value).getTime();
  }
  return 0;
}

/**
 * Helper function to get number sort values
 */
function getNumberSortValue(item: any, field: string): number {
  const value = item[field];
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return Number(value);
  }
  return 0;
}

/**
 * Helper function to get sort values for in-memory sorting
 */
function getSortValue(item: any, key: string): string | number {
  const stringFields = [
    "_inMemoryDriverNameSort",
    "_inMemoryVendorNameSort",
    "_inMemoryUrlSort",
    "_inMemoryMimeTypeSort",
    "_inMemoryEquipmentLoadStatusSort",
    "_inMemoryArrivalTimeSort",
    "_inMemoryMotionStatusSort",
    "_inMemoryAlarmCodeStatusSort",
    "_inMemoryAgreementTypeSort",
    "_inMemoryContractTermTypeSort",
  ];

  const dateFields = [
    "_inMemoryContractStartDateSort",
    "_inMemoryContractEndDateSort",
    "_inMemoryDotCviExpireSort",
    "_inMemoryEquipmentLoadDateSort",
    "_inMemoryEquipmentUnloadDateSort",
    "_inMemoryLastGpsUpdateSort",
  ];

  const numberFields = ["_inMemoryLatitudeSort", "_inMemoryLongitudeSort"];

  if (stringFields.includes(key)) {
    const fieldMap: Record<string, string> = {
      _inMemoryDriverNameSort: "driver_name",
      _inMemoryVendorNameSort: "vendorName",
      _inMemoryUrlSort: "url",
      _inMemoryMimeTypeSort: "mimeType",
      _inMemoryEquipmentLoadStatusSort: "equipmentLoadStatus",
      _inMemoryArrivalTimeSort: "arrival_time",
      _inMemoryMotionStatusSort: "motionStatus",
      _inMemoryAlarmCodeStatusSort: "alarmCodeStatus",
      _inMemoryAgreementTypeSort: "agreementType",
      _inMemoryContractTermTypeSort: "contractTermType",
    };
    return getStringSortValue(item, fieldMap[key]);
  }

  if (dateFields.includes(key)) {
    const fieldMap: Record<string, string> = {
      _inMemoryContractStartDateSort: "contractStartDate",
      _inMemoryContractEndDateSort: "contractEndDate",
      _inMemoryDotCviExpireSort: "dotCviExpire",
      _inMemoryEquipmentLoadDateSort: "equipmentLoadDate",
      _inMemoryEquipmentUnloadDateSort: "equipmentUnloadDate",
      _inMemoryLastGpsUpdateSort: "lastGpsUpdate",
    };
    return getDateSortValue(item, fieldMap[key]);
  }

  if (numberFields.includes(key)) {
    const fieldMap: Record<string, string> = {
      _inMemoryLatitudeSort: "latitude",
      _inMemoryLongitudeSort: "longitude",
    };
    return getNumberSortValue(item, fieldMap[key]);
  }

  return "";
}

/**
 * Helper function to perform in-memory sorting
 */
function performInMemorySort(
  data: any[],
  inMemorySort: { key: string, direction: "asc" | "desc" }
): void {
  const { key, direction } = inMemorySort;

  data.sort((a, b) => {
    const aVal = getSortValue(a, key);
    const bVal = getSortValue(b, key);

    if (aVal < bVal) return direction === "asc" ? -1 : 1;
    if (aVal > bVal) return direction === "asc" ? 1 : -1;
    return 0;
  });
}

/**
 * Helper function to build download equipment filters
 */
function buildDownloadEquipmentFilters(
  query: Record<string, unknown>
): Prisma.equipmentWhereInput {
  type FilterBuilder = (value: unknown) => Prisma.equipmentWhereInput;

  const filterMap: Record<string, FilterBuilder> = {
    doorType: (val) => ({
      door_type: { contains: String(val), mode: "insensitive" },
    }),
    wallType: (val) => ({
      wall_type: { contains: String(val), mode: "insensitive" },
    }),
    vendorName: (val) => ({
      equipment_iot_device_ref: {
        is: {
          iot_device_ref: {
            iot_device_vendor_ref: {
              vendor_name: {
                contains: String(val).trim(),
                mode: "insensitive",
              },
            },
          },
        },
      },
    }),
    alarmCodeStatus: (val) => ({
      telematics: {
        alarm_code_status: { contains: String(val), mode: "insensitive" },
      },
    }),
    motionStatus: (val) => ({
      telematics: {
        motion_status: { contains: String(val), mode: "insensitive" },
      },
    }),
    vin: (val) => ({ vin: { contains: String(val), mode: "insensitive" } }),
    unitNumber: (val) => ({
      unit_number: { contains: String(val), mode: "insensitive" },
    }),
    telematicDeviceId: (val) => ({
      telematic_device_id: { contains: String(val), mode: "insensitive" },
    }),
    customerUnitNumber: (val) => ({
      customer_unit_number: { contains: String(val), mode: "insensitive" },
    }),
    breakType: (val) => ({
      brake_type: { contains: String(val), mode: "insensitive" },
    }),
    color: (val) => ({ color: { contains: String(val), mode: "insensitive" } }),
    liftGate: (val) => ({
      liftgate: { contains: String(val), mode: "insensitive" },
    }),
    tenBranch: (val) => ({
      ten_branch: { contains: String(val), mode: "insensitive" },
    }),
    dotCviStatus: (val) => ({
      dot_cvi_status: { contains: String(val), mode: "insensitive" },
    }),
    dotCviExpire: (val) => ({
      dot_cvi_expire: { equals: new Date(String(val)) },
    }),
    trailerHeight: (val) => ({
      trailer_height: { contains: String(val), mode: "insensitive" },
    }),
    trailerWidth: (val) => ({
      trailer_width: { contains: String(val), mode: "insensitive" },
    }),
    trailerLength: (val) => ({
      trailer_length: { contains: String(val), mode: "insensitive" },
    }),
    tireSize: (val) => ({
      tire_size: { contains: String(val), mode: "insensitive" },
    }),
    status: (val) => ({
      status: { contains: String(val), mode: "insensitive" },
    }),
    make: (val) => ({
      oem_make_model_ref: {
        make: { contains: String(val), mode: "insensitive" },
      },
    }),
    model: (val) => ({
      oem_make_model_ref: {
        model: { contains: String(val), mode: "insensitive" },
      },
    }),
    year: (val) => ({ oem_make_model_ref: { year: String(val) } }),
    equipmentType: (val) => ({
      equipment_type_lookup_ref: {
        equipment_type: { contains: String(val), mode: "insensitive" },
      },
    }),
    roofType: (val) => ({
      roof_type: { contains: String(val), mode: "insensitive" },
    }),
    floorType: (val) => ({
      floor_type: { contains: String(val), mode: "insensitive" },
    }),
    rimType: (val) => ({
      rim_type: { contains: String(val), mode: "insensitive" },
    }),
    licensePlateNumber: (val) => ({
      equipment_permit: {
        license_plate_number: { contains: String(val), mode: "insensitive" },
      },
    }),
    dateInService: (val) => ({
      date_in_service: { equals: new Date(String(val)) },
    }),
    lastPmDate: (val) => ({ last_pm_date: { equals: new Date(String(val)) } }),
    nextPmDue: (val) => ({ next_pm_due: { equals: new Date(String(val)) } }),
    lastMrDate: (val) => ({
      last_m_and_r_date: { equals: new Date(String(val)) },
    }),
    lastReeferPmDate: (val) => ({
      last_reefer_pm_date: { equals: new Date(String(val)) },
    }),
    nextReeferPmDue: (val) => ({
      next_reefer_pm_due: { equals: new Date(String(val)) },
    }),
    reeferMakeType: (val) => ({
      reefer_make_type: { contains: String(val), mode: "insensitive" },
    }),
    reeferSerial: (val) => ({
      reefer_serial: { contains: String(val), mode: "insensitive" },
    }),
    liftGateSerial: (val) => ({
      lifgate_serial: { contains: String(val), mode: "insensitive" },
    }),
    // Equipment assignment filters - these need to be handled at the assignment level
    // Note: activation_date and deactivation_date are on equipment_assignment table
    // These will be handled in the main query where clause
    driver_name: (val) => ({
      unit_number: {
        contains: String(val).replace("Driver ", ""),
        mode: "insensitive",
      },
    }),
    // Equipment load detail filters
    equipmentLoadStatus: (val) => {
      const searchValue = String(val).toUpperCase();
      return {
        equipment_load_detail: {
          some: {
            OR: [
              {
                load_status_lookup: {
                  field_code: { equals: searchValue },
                },
              },
              {
                equipment_load_status: { equals: searchValue },
              },
            ],
          },
        },
      };
    },
    // Telematics filters
    latitude: (val) => {
      const lat = parseFloat(String(val));
      // Support range-based filtering with ±0.1 degree tolerance
      return {
        telematics: {
          latitude: {
            gte: lat - 0.1,
            lte: lat + 0.1,
          },
        },
      };
    },
    longitude: (val) => {
      const lng = parseFloat(String(val));
      // Support range-based filtering with ±0.1 degree tolerance
      return {
        telematics: {
          longitude: {
            gte: lng - 0.1,
            lte: lng + 0.1,
          },
        },
      };
    },
    last_gps_coordinates: (val) => {
      const coords = String(val).split(",");
      if (coords.length === 2) {
        const lat = parseFloat(coords[0].trim());
        const lng = parseFloat(coords[1].trim());
        return {
          telematics: {
            AND: [
              {
                latitude: {
                  gte: lat - 0.1,
                  lte: lat + 0.1,
                },
              },
              {
                longitude: {
                  gte: lng - 0.1,
                  lte: lng + 0.1,
                },
              },
            ],
          },
        };
      }
      return {};
    },
    location: (val) => ({
      telematics: {
        address: { contains: String(val), mode: "insensitive" },
      },
    }),
    lastGpsUpdate: (val) => ({
      telematics: {
        recived_timestamp: { equals: new Date(String(val)) },
      },
    }),
    arrivalTime: (val) => ({
      telematics: {
        recived_timestamp: { equals: new Date(String(val)) },
      },
    }),
    lastGpsCoordinates: (val) => {
      const coords = String(val).split(",");
      if (coords.length === 2) {
        const lat = parseFloat(coords[0].trim());
        const lng = parseFloat(coords[1].trim());
        return {
          telematics: {
            AND: [
              {
                latitude: {
                  gte: lat - 0.1,
                  lte: lat + 0.1,
                },
              },
              {
                longitude: {
                  gte: lng - 0.1,
                  lte: lng + 0.1,
                },
              },
            ],
          },
        };
      }
      return {};
    },
  };

  return Object.entries(query).reduce<Prisma.equipmentWhereInput>(
    (acc, [key, value]) => {
      if (value && filterMap[key]) return { ...acc, ...filterMap[key](value) };
      return acc;
    },
    {}
  );
}

/**
 * Helper function to build download account filters
 */
function buildDownloadAccountFilters(
  query: Record<string, unknown>
): Prisma.accountWhereInput {
  const accountFilters: Prisma.accountWhereInput = {};

  if (query.accountNumber) {
    accountFilters.account_number = {
      contains: (query.accountNumber as string).trim(),
      mode: "insensitive",
    };
  }

  if (query.accountName) {
    accountFilters.account_name = {
      contains: (query.accountName as string).trim(),
      mode: "insensitive",
    };
  }

  if (query.account) {
    accountFilters.OR = [
      {
        account_number: {
          contains: (query.account as string).trim(),
          mode: "insensitive",
        },
      },
      {
        account_name: {
          contains: (query.account as string).trim(),
          mode: "insensitive",
        },
      },
    ];
  }

  return accountFilters;
}

/**
 * Helper function to build download contract filters
 */
function buildDownloadContractFilters(
  query: Record<string, unknown>
): Prisma.schedule_agreementWhereInput {
  const contractFilters: Prisma.schedule_agreementWhereInput = {};

  if (query.contractTermType) {
    contractFilters.contract_term_type = {
      contains: (query.contractTermType as string).trim(),
      mode: "insensitive",
    };
  }

  if (query.contractStartDate) {
    contractFilters.master_agreement_ref = {
      contract_start_Date: {
        gte: new Date(query.contractStartDate as string),
      },
    };
  }

  if (query.contractEndDate) {
    contractFilters.termination_date = {
      lte: new Date(query.contractEndDate as string),
    };
  }

  if (query.agreementType) {
    contractFilters.schedule_type = {
      contains: (query.agreementType as string).trim(),
      mode: "insensitive",
    };
  }

  return contractFilters;
}

/**
 * Helper function to handle account IDs for download
 */
async function handleDownloadAccountIds(
  query: GetListViewParams
): Promise<number[]> {
  if (query.account_ids === "all") {
    if (query.downloadAll) {
      const allAccounts = await prisma.equipment_type_allocation.findMany({
        select: { account_id: true },
        distinct: ["account_id"],
      });

      return allAccounts
        .map((a) => a.account_id)
        .filter((id): id is number => id !== null);
    } else {
      throw new Error(
        "Please provide specific account_ids when 'all' is selected"
      );
    }
  } else if (Array.isArray(query.account_ids)) {
    return query.account_ids.map((id) => id).filter(Boolean);
  } else {
    throw new Error("account_ids must be provided for download");
  }
}

/**
 * Helper function to handle equipment filter for download
 */
function handleDownloadEquipmentFilter(
  query: GetListViewParams
): Prisma.equipmentWhereInput {
  if (query.downloadAll) {
    return {};
  } else if (query.equipment_id && query.equipment_id.length > 0) {
    return {
      equipment_id: {
        notIn: query.equipment_id,
      },
    };
  } else {
    return {};
  }
}

/**
 * Helper function to handle download filtering
 */
function handleDownloadFiltering(
  allData: any[],
  query: GetListViewParams,
  stats: StatisticsResult
): any[] {
  let filteredData = allData;

  if (query.equipmentId?.toString().trim()) {
    filteredData = allData.filter((item) => {
      return item.equipment_ref.equipment_id
        .toString()
        .includes(String(query.equipmentId).trim());
    });
  }

  if (query.filterBy === "gpsEquippedCount")
    filteredData = allData.filter((item) =>
      stats.uniqueGpsEquipped.has(item.equipment_ref.equipment_id)
    );
  if (query.filterBy === "accessWithoutGpsCount")
    filteredData = allData.filter(
      (item) => !stats.uniqueGpsEquipped.has(item.equipment_ref.equipment_id)
    );
  if (query.filterBy === "idleUnitsCount")
    filteredData = allData.filter((item) =>
      stats.idleEquipIds.has(item.equipment_ref.equipment_id)
    );
  if (query.filterBy === "overdueDotInspectionCount")
    filteredData = allData.filter((item) =>
      stats.expiredInspectionIds.has(item.equipment_ref.equipment_id)
    );

  if (query.filterBy === "ersInProgressCount")
    filteredData = allData.filter((item) =>
      stats.ersInProgressIds.has(item.equipment_ref.equipment_id)
    );
  if (query.filterBy === "overDueCount")
    filteredData = allData.filter((item) =>
      stats.overdueValidThroughIds.has(item.equipment_ref.equipment_id)
    );

  return filteredData;
}

/**
 * Build assignment filters for date ranges
 */
const buildAssignmentFilters = (
  rest: Record<string, unknown>
): Prisma.equipment_assignmentWhereInput => {
  const assignmentFilters: Prisma.equipment_assignmentWhereInput = {};

  const createDateRange = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return { gte: start, lte: end };
  };

  [rest.activationDate, rest.deactivationDate].forEach((date, index) => {
    if (date && typeof date === "string") {
      const dateRange = createDateRange(date);
      if (dateRange) {
        assignmentFilters[
          index === 0 ? "activation_date" : "deactivation_date"
        ] = dateRange;
      }
    }
  });

  return assignmentFilters;
};

/**
 * Build sorting configuration
 */
const buildSortingConfig = (sort: string | undefined) => {
  let rawOrderBy: Prisma.equipment_assignmentOrderByWithRelationInput[] = [];
  let inMemorySort: { key: string, direction: "asc" | "desc" } | null = null;

  if (sort) {
    const raw = buildOrderByFromSort(
      sort,
      FLEET_LIST_VIEW_SORT_FIELDS,
      "equipment_id"
    );

    raw.forEach((o: Record<string, unknown>) => {
      const [key, dir] = Object.entries(o)[0];
      if (key.startsWith("_inMemory")) {
        inMemorySort = { key, direction: dir as "asc" | "desc" };
      } else {
        rawOrderBy.push(
          o as unknown as Prisma.equipment_assignmentOrderByWithRelationInput
        );
      }
    });
  }

  if (rawOrderBy.length === 0) {
    rawOrderBy = [{ equipment_id: "asc" }];
  }

  return { rawOrderBy, inMemorySort };
};

/**
 * Apply filtering to data based on filter criteria
 */
const applyFiltering = (
  allData: any[],
  rest: Record<string, unknown>,
  stats: StatisticsResult
) => {
  let filteredData = allData;

  if (rest.equipmentId?.toString().trim()) {
    filteredData = allData.filter((item) =>
      item.equipment_ref.equipment_id
        .toString()
        .includes(String(rest.equipmentId).trim())
    );
  }

  if (rest.filterBy === "gpsEquippedCount")
    filteredData = allData.filter((item) =>
      stats.uniqueGpsEquipped.has(item.equipment_ref.equipment_id)
    );
  if (rest.filterBy === "accessWithoutGpsCount")
    filteredData = allData.filter(
      (item) => !stats.uniqueGpsEquipped.has(item.equipment_ref.equipment_id)
    );
  if (rest.filterBy === "idleUnitsCount")
    filteredData = allData.filter((item) =>
      stats.idleEquipIds.has(item.equipment_ref.equipment_id)
    );
  if (rest.filterBy === "overdueDotInspectionCount")
    filteredData = allData.filter((item) =>
      stats.expiredInspectionIds.has(item.equipment_ref.equipment_id)
    );
  if (rest.filterBy === "overDueCount")
    filteredData = allData.filter((item) =>
      stats.overdueValidThroughIds.has(item.equipment_ref.equipment_id)
    );

  if (rest.filterBy === "ersInProgressCount")
    filteredData = allData.filter((item) =>
      stats.ersInProgressIds.has(item.equipment_ref.equipment_id)
    );

  return filteredData;
};

/**
 * Extract basic equipment information
 */
const extractBasicEquipmentInfo = (eq: any, item: any) => ({
  equipment_id: eq.equipment_id,
  activation_date: item.activation_date,
  deactivation_date: item.deactivation_date,
  driver_name: `Driver ${eq.unit_number ?? ""}`,
  unitNumber: eq.unit_number,
  telematicDeviceId: eq.telematic_device_id ?? null,
  customerUnitNumber: eq.customer_unit_number,
  status: eq.status ?? null,
  vin: eq.vin,
  permit: eq.equipment_permit ?? null,
  created_by: eq.created_by,
});

/**
 * Extract equipment specifications
 */
const extractEquipmentSpecs = (eq: any) => ({
  make: eq.oem_make_model_ref?.make ?? null,
  model: eq.oem_make_model_ref?.model ?? null,
  year: eq.oem_make_model_ref?.year ?? null,
  doorType: eq.door_type ?? null,
  wallType: eq.wall_type ?? null,
  breakType: eq.brake_type ?? null,
  color: eq.color ?? null,
  liftGate: eq.liftgate ?? null,
  tenBranch: eq.ten_branch ?? null,
  equipmentType: eq.equipment_type_lookup_ref?.equipment_type ?? null,
});

/**
 * Extract maintenance information
 */
const extractMaintenanceInfo = (eq: any) => ({
  lastPmDate: eq.last_pm_date ?? null,
  nextPmDue: eq.next_pm_due ?? null,
  dotCviStatus: eq.dot_cvi_status ?? null,
  dotCviExpire: eq.dot_inspection?.[0]?.next_inspection_due ?? null,
  lastReeferPmDate: eq.last_reefer_pm_date ?? null,
  nextReeferPmDue: eq.next_reefer_pm_due ?? null,
  lastMRDate: eq.last_m_and_r_date ?? null,
  dateInService: eq.date_in_service ?? null,
});

/**
 * Extract reefer and liftgate information
 */
const extractReeferLiftgateInfo = (eq: any) => ({
  reeferMakeType: eq.reefer_make_type ?? null,
  reeferSerial: eq.reefer_serial ?? null,
  liftGateSerial: eq.lifgate_serial ?? null,
});

/**
 * Extract trailer dimensions
 */
const extractTrailerDimensions = (eq: any) => ({
  trailerHeight: eq.trailer_height ?? null,
  trailerWidth: eq.trailer_width ?? null,
  trailerLength: eq.trailer_length ?? null,
  tireSize: eq.tire_size ?? null,
  floorType: eq.floor_type ?? null,
  roofType: eq.roof_type ?? null,
  rimType: eq.rim_type ?? null,
});

/**
 * Extract account information
 */
const extractAccountInfo = (accountRef: any) => ({
  AccountId: accountRef.account_id,
  accountNumber: accountRef.account?.account_number,
  accountName: accountRef.account?.account_name,
  account: accountRef.account
    ? `(${accountRef.account.account_number}) - ${accountRef.account.account_name}`
    : null,
});

/**
 * Extract contract and rate information
 */
const extractContractInfo = (
  acloc: any,
  schedule: any,
  masterAgreement: any
) => ({
  rate: acloc?.rate ?? null,
  fixedRate: acloc?.fixed_rate ?? null,
  variableRate: acloc?.variable_rate ?? null,
  estimatedMiles: acloc?.estimated_miles ?? null,
  estimatedHours: acloc?.estimated_hours ?? null,
  contractStartDate: masterAgreement?.contract_start_Date ?? null,
  contractEndDate: schedule?.termination_date ?? null,
  contractTermType: schedule?.contract_term_type ?? null,
  agreementType: schedule?.schedule_type ?? null,
});

/**
 * Extract permit information
 */
const extractPermitInfo = (permit: any) => ({
  licensePlateNumber: permit?.license_plate_number ?? null,
  licensePlateState: permit?.license_plate_state ?? null,
});

/**
 * Extract attachment information
 */
const extractAttachmentInfo = (schedule: any) => ({
  url:
    schedule?.schedule_agreement_has_attachment?.[0]?.attachment?.url ?? null,
  mimeType:
    schedule?.schedule_agreement_has_attachment?.[0]?.attachment?.mime_type ??
    null,
});

/**
 * Extract telematics information
 */
const extractTelematicsInfo = (telemetry: any) => {
  const arrival_time_val = telemetry?.recived_timestamp
    ? new Date(telemetry?.recived_timestamp).toLocaleTimeString("en-US", {
        hour12: true,
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return {
    current_equipment_gps_location_id: telemetry?.telematics_id ?? null,
    latitude: telemetry?.latitude?.toString() ?? null,
    longitude: telemetry?.longitude?.toString() ?? null,
    last_gps_coordinates:
      telemetry?.latitude && telemetry?.longitude
        ? `${telemetry.latitude.toString()},${telemetry.longitude.toString()}`
        : null,
    location: telemetry?.address ?? null,
    motionStatus: telemetry?.motion_status ?? null,
    alarmCodeStatus: telemetry?.alarm_code_status ?? null,
    arrival_time: arrival_time_val ?? null,
    lastGpsUpdate: telemetry?.recived_timestamp ?? null,
  };
};

/**
 * Extract load detail information
 */
const extractLoadDetailInfo = (loadDetail: any) => ({
  equipmentLoadStatus: loadDetail?.load_status_lookup?.field_code ?? loadDetail?.equipment_load_status ?? null,
  equipmentLoadDate: loadDetail?.equipment_load_date ?? null,
  equipmentUnloadDate: loadDetail?.equipment_unload_date ?? null,
  equipmentLoadDetail: loadDetail ?? null,
});

/**
 * Map equipment assignment data to DTO format
 */
const mapEquipmentData = (item: any) => {
  const eq = item.equipment_ref;
  const accountRef = item.equipment_type_allocation_ref;
  const acloc = accountRef.schedule_agreement_line_item_ref;
  const schedule =
    accountRef.schedule_agreement_line_item_ref?.schedule_agreement_ref;
  const masterAgreement = schedule?.master_agreement_ref;
  const telemetry = eq.telematics;
  const loadDetail = eq.equipment_load_detail?.[0];
  const permit = eq.equipment_permit;
  const vendorName =
    eq.equipment_iot_device_ref?.iot_device_ref?.iot_device_vendor_ref
      ?.vendor_name ?? null;

  return {
    ...extractBasicEquipmentInfo(eq, item),
    ...extractEquipmentSpecs(eq),
    ...extractMaintenanceInfo(eq),
    ...extractReeferLiftgateInfo(eq),
    ...extractTrailerDimensions(eq),
    ...extractAccountInfo(accountRef),
    ...extractContractInfo(acloc, schedule, masterAgreement),
    ...extractPermitInfo(permit),
    ...extractAttachmentInfo(schedule),
    ...extractTelematicsInfo(telemetry),
    ...extractLoadDetailInfo(loadDetail),
    vendorName,
  };
};

/**
 * Get Fleet List View Service
 *
 * Retrieves a paginated list of fleet equipment with comprehensive filtering,
 * sorting, and statistics calculation. Supports complex queries across multiple
 * related tables including equipment, accounts, agreements, and telematics.
 *
 * @param params - Query parameters for filtering and pagination
 * @param params.account_ids - Array of account IDs to filter by (required)
 * @param params.page - Page number for pagination (default: 1)
 * @param params.perPage - Items per page (default: 10)
 * @param params.sort - Sorting configuration
 * @param params - Additional filter parameters for equipment properties
 *
 * @returns Promise containing paginated data, statistics, and metadata
 *
 * @throws {Error} When account_ids are not provided or invalid
 *
 * @example
 * const result = await getListViewService({
 *   account_ids: [1, 2, 3],
 *   page: 1,
 *   perPage: 10,
 *   unitNumber: "ABC123",
 *   sort: { unitNumber: "asc" }
 * });
 */
export const getListViewService = async (params: GetListViewParams) => {
  const page = Number(params.page) || 1;
  const perPage = Number(params.perPage) || 10;

  const { account_ids, sort, ...rest } = params;

  if (!account_ids || !Array.isArray(account_ids) || account_ids.length == 0) {
    throw new Error("account_ids must be provided");
  }

  // Build filters using helper functions
  const equipmentRefFilter = buildEquipmentFilters(rest);
  const accountFilters = buildAccountFilters(rest);
  const contractFilters = buildContractFilters(rest);

  const whereCondition: Prisma.equipment_type_allocationWhereInput = {
    account: {
      account_id: { in: account_ids },
      ...accountFilters,
    },
    schedule_agreement_line_item_ref: {
      schedule_agreement_ref: contractFilters,
    },
  };

  // Build sorting configuration
  const { rawOrderBy, inMemorySort } = buildSortingConfig(sort);

  // Build assignment filters
  const assignmentFilters = buildAssignmentFilters(rest);

  // Fetch all matching rows
  const allData = await prisma.equipment_assignment.findMany({
    where: {
      equipment_type_allocation_ref: whereCondition,
      equipment_ref: equipmentRefFilter,
      ...assignmentFilters,
    },
    include: {
      equipment_ref: {
        include: {
          simple_field_lookup: true,
          door_type_lookup: true,
          wall_type_lookup: true,
          floor_type_lookup: true,
          roof_type_lookup: true,
          rim_type_lookup: true,
          oem_make_model_ref: true,
          equipment_permit: true,
          equipment_type_lookup_ref: true,
          telematics: true,
          equipment_iot_device_ref: {
            include: {
              iot_device_ref: { include: { iot_device_vendor_ref: true } },
            },
          },
          equipment_load_detail: {
            take: 1,
            orderBy: { equipment_load_date: "desc" },
            include: { load_status_lookup: true },
          },
          dot_inspection: { take: 1, orderBy: { next_inspection_due: "desc" } },
        },
      },
      equipment_type_allocation_ref: {
        include: {
          account: true,
          schedule_agreement_line_item_ref: {
            include: {
              schedule_agreement_ref: {
                include: {
                  master_agreement_ref: true,
                  schedule_agreement_has_attachment: {
                    include: { attachment: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: rawOrderBy,
  });

  // Stats calculation using helper function
  const dbTotal = allData.length;
  const equipmentIds = allData.map((r) => r.equipment_ref.equipment_id);

  const stats = await calculateStatistics(equipmentIds, allData);

  // Apply filtering
  const filteredData = applyFiltering(allData, rest, stats);

  // Pagination
  const total = filteredData.length;
  const totalPages = Math.ceil(total / perPage);
  const paginatedData = filteredData.slice(
    (page - 1) * perPage,
    page * perPage
  );

  // Map DTO
  const mappedData = paginatedData.map((item: any) => mapEquipmentData(item));

  // In-memory sort
  if (inMemorySort) {
    performInMemorySort(mappedData, inMemorySort);
  }

  // Final return
  return {
    stats: {
      totalCount: dbTotal,
      gpsEquippedCount: stats.gpsEquippedCount,
      accessWithoutGpsCount: stats.accessWithoutGpsCount,
      idleUnitsCount: stats.idleUnitsCount,
      overdueDotInspectionCount: stats.overdueDotInspectionCount,
      overDueCount: stats.overDueCount,
      ersInProgressCount: stats.ersInProgressCount,
    },
    data: mappedData,
    total,
    page,
    perPage,
    totalPages,
  };
};

/**
 * Build equipment specification details
 */
const buildEquipmentSpecificationDetails = (eq: any, iotDevice: any) => {
  return {
    unitNumber: eq.unit_number,
    telematicDeviceId: eq.telematic_device_id ?? null,
    customerUnitNumber: eq.customer_unit_number,
    status: eq.simple_field_lookup?.field_name ?? eq.status,
    vin: eq.vin,
    permit: eq.equipment_permit?.permit_date ?? null,
    make: eq.oem_make_model_ref?.make ?? null,
    model: eq.oem_make_model_ref?.model ?? null,
    year: eq.oem_make_model_ref?.year ?? null,
    length: eq.oem_make_model_ref?.length ?? null,
    doorType: eq.door_type_lookup?.field_name ?? eq.door_type,
    wallType: eq.wall_type_lookup?.field_name ?? eq.wall_type,
    breakType: eq.brake_type,
    color: eq.color,
    liftGate: eq.liftgate,
    domicile: eq.domicile,
    tenBranch: eq.ten_branch,
    lastPmDate: eq.last_pm_date,
    nextPmDue: eq.next_pm_due,
    dotCviStatus: eq.dot_cvi_status,
    dotCviExpire: eq.dot_cvi_expire,
    lastReeferPmDate: eq.last_reefer_pm_date,
    nextReeferPmDue: eq.next_reefer_pm_due,
    lastMRDate: eq.last_m_and_r_date,
    reeferMakeType: eq.reefer_make_type,
    reeferSerial: eq.reefer_serial,
    liftGateSerial: eq.lifgate_serial,
    trailerHeight: eq.trailer_height,
    trailerWidth: eq.trailer_width,
    trailerLength: eq.trailer_length,
    dateInService: eq.date_in_service,
    tireSize: eq.tire_size,
    floorType: eq.floor_type_lookup?.field_name ?? eq.floor_type,
    roofType: eq.roof_type_lookup?.field_name ?? eq.roof_type,
    rimType: eq.rim_type_lookup?.field_name ?? eq.rim_type,
    vendorName:
      iotDevice?.iot_device_ref?.iot_device_vendor_ref?.vendor_name ?? null,
  };
};

/**
 * Build equipment contact details
 */
const buildEquipmentContactDetails = (
  account: any,
  lineItem: any,
  agreement: any,
  eq: any
) => {
  return {
    accountNumber: account?.account_number ?? null,
    accountName: account?.account_name ?? null,
    account: account
      ? `${account.account_number ?? ""} - ${account.account_name ?? ""}`
      : null,
    rate: lineItem?.rate ?? null,
    fixedRate: lineItem?.fixed_rate ?? null,
    variableRate: lineItem?.variable_rate ?? null,
    estimatedMiles: lineItem?.estimated_miles ?? null,
    estimatedHours: lineItem?.estimated_hours ?? null,
    contractStartDate:
      agreement?.master_agreement_ref?.contract_start_Date ?? null,
    contractEndDate: agreement?.termination_date ?? null,
    contractTermType:
      agreement?.master_agreement_ref?.contract_term_type ?? null,
    licensePlateNumber: eq.equipment_permit?.license_plate_number ?? null,
    licensePlateState: eq.equipment_permit?.license_plate_state ?? null,
  };
};

/**
 * Build attachment details
 */
const buildAttachmentDetails = (agreement: any) => {
  const attachment =
    agreement?.schedule_agreement_has_attachment[0]?.attachment;

  return {
    url: attachment?.url ?? null,
    mimeType: attachment?.mime_type ?? null,
    agreementType: agreement?.schedule_type ?? null,
  };
};

/**
 * Build GPS details
 */
const buildGpsDetails = (gps: any) => {
  return gps
    ? {
        latitude: gps.latitude,
        longitude: gps.longitude,
        location: gps.address,
        motionStatus: gps.motion_status ?? null,
        alarmCodeStatus: gps.alarm_code_status ?? null,
        lastGpsUpdate: gps.recived_timestamp,
      }
    : null;
};

/**
 * Get Equipment Details Service
 *
 * Retrieves comprehensive details for a specific piece of equipment including
 * specifications, contact information, attachments, and GPS data. Fetches data
 * from multiple related tables to provide complete equipment information.
 *
 * @param params - Parameters for equipment lookup
 * @param params.accountId - Account ID (required)
 * @param params.equipmentId - Equipment ID (required)
 *
 * @returns Promise containing equipment details or null if not found
 *
 * @example
 * const details = await getEquipmentDetailsService({
 *   accountId: 123,
 *   equipmentId: 456
 * });
 */
export const getEquipmentDetailsService = async (
  params: GetEquipmentDetailsParams
) => {
  const { accountId, equipmentId } = params;

  const assignment = await prisma.equipment_assignment.findFirst({
    where: {
      equipment_type_allocation_ref: {
        account_id: accountId,
      },
      equipment_id: equipmentId,
    },
    include: {
      equipment_ref: {
        include: {
          simple_field_lookup: true,
          door_type_lookup: true,
          wall_type_lookup: true,
          floor_type_lookup: true,
          roof_type_lookup: true,
          rim_type_lookup: true,
          oem_make_model_ref: true,
          equipment_permit: true,
        },
      },
      equipment_type_allocation_ref: {
        include: {
          account: true,
          schedule_agreement_line_item_ref: {
            include: {
              schedule_agreement_ref: {
                include: {
                  master_agreement_ref: true,
                  schedule_agreement_has_attachment: {
                    include: { attachment: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!assignment?.equipment_ref) {
    return null;
  }

  const { equipment_ref: eq, equipment_type_allocation_ref: alloc } =
    assignment;
  const { schedule_agreement_line_item_ref: lineItem, account } = alloc;
  const agreement = lineItem?.schedule_agreement_ref;

  const iotDevice = await prisma.equipment_has_iot_device.findFirst({
    where: { equipment_id: eq.equipment_id },
    include: {
      iot_device_ref: { include: { iot_device_vendor_ref: true } },
    },
  });

  const gps = await prisma.telematics.findFirst({
    where: { unit_number: eq.telematic_device_id },
  });

  return {
    equipmentSpecificationDetails: buildEquipmentSpecificationDetails(
      eq,
      iotDevice
    ),
    equipmentContactDetails: buildEquipmentContactDetails(
      account,
      lineItem,
      agreement,
      eq
    ),
    attachmentDetails: buildAttachmentDetails(agreement),
    gps: buildGpsDetails(gps),
  };
};

/**
 * Build download sorting configuration
 */
const buildDownloadSortingConfig = (query: GetListViewParams) => {
  const rawOrderBy: Prisma.equipment_assignmentOrderByWithRelationInput[] = [];
  let inMemorySort: { key: string, direction: "asc" | "desc" } | null = null;

  if (query.sort) {
    // Convert sort object to string format if needed
    const sortString =
      typeof query.sort === "string"
        ? query.sort
        : Object.entries(query.sort)
            .map(([key, value]) => `${key}:${String(value)}`)
            .join(",");

    const raw = buildOrderByFromSort(
      sortString,
      FLEET_LIST_VIEW_SORT_FIELDS,
      "equipment_id"
    );

    raw.forEach((o: Record<string, unknown>) => {
      const [key, dir] = Object.entries(o)[0];
      if (key.startsWith("_inMemory")) {
        inMemorySort = { key, direction: dir as "asc" | "desc" };
      } else {
        rawOrderBy.push(
          o as unknown as Prisma.equipment_assignmentOrderByWithRelationInput
        );
      }
    });
  }

  return { rawOrderBy, inMemorySort };
};

/**
 * Build download assignment filters
 */
const buildDownloadAssignmentFilters = (
  query: GetListViewParams
): Prisma.equipment_assignmentWhereInput => {
  const assignmentFilters: Prisma.equipment_assignmentWhereInput = {};

  const createDateRange = (dateString: string) => {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      return { gte: startOfDay, lte: endOfDay };
    }
    return null;
  };

  if (query.activationDate) {
    const dateRange = createDateRange(query.activationDate);
    if (dateRange) {
      assignmentFilters.activation_date = dateRange;
    }
  }

  if (query.deactivationDate) {
    const dateRange = createDateRange(query.deactivationDate);
    if (dateRange) {
      assignmentFilters.deactivation_date = dateRange;
    }
  }

  return assignmentFilters;
};

/**
 * Build Excel columns configuration
 */
const buildExcelColumns = (
  requestedColumns: { label: string, field: string, maxWidth?: number }[]
) => {
  return requestedColumns.map(({ label, field, maxWidth }) => {
    let width: number;
    if (maxWidth) {
      width = maxWidth;
    } else {
      width = field === "sno" ? 10 : 20;
    }

    let formatter: ((val: unknown) => unknown) | undefined;
    if (["dateInService"].includes(field)) {
      formatter = (val: unknown) => {
        if (val instanceof Date) {
          return formatDate(val);
        }
        return val;
      };
    } else {
      formatter = undefined;
    }

    return {
      header: label,
      key: field,
      width,
      formatter,
    };
  });
};

/**
 * Build Excel rows data
 */
const buildExcelRows = (
  mappedData: any[],
  requestedColumns: { label: string, field: string, maxWidth?: number }[]
) => {
  type RowValue = string | number | Date | null;
  type RowType = Record<string, RowValue>;

  return mappedData.map((item, index) => {
    const row: RowType = {};
    requestedColumns.forEach(({ field }) => {
      if (field === "sno") {
        row[field] = index + 1;
      } else {
        const value = (item as Record<string, unknown>)[field];
        if (
          value instanceof Date ||
          typeof value === "string" ||
          typeof value === "number"
        ) {
          row[field] = value;
        } else {
          row[field] = null;
        }
      }
    });
    return row;
  });
};

/**
 * Download Fleet List View Service
 *
 * Exports fleet data to Excel format with customizable columns and filtering.
 * Supports downloading all data or excluding specific equipment IDs. Generates
 * Excel files with proper formatting and column definitions.
 *
 * @param payload - Export configuration
 * @param payload.query - Query parameters for filtering data
 * @param payload.columns - Array of column definitions for Excel export
 *
 * @returns Promise containing Excel buffer and filename
 *
 * @throws {Error} When account_ids are not provided or invalid
 *
 * @example
 * const result = await downloadListViewService({
 *   query: { account_ids: [1, 2, 3], unitNumber: "ABC123" },
 *   columns: [{ label: "Unit Number", field: "unitNumber", maxWidth: 20 }]
 * });
 */
export const downloadListViewService = async (payload: {
  query: GetListViewParams,
  columns: { label: string, field: string, maxWidth?: number }[]
}) => {
  const { query, columns: requestedColumns } = payload;

  // Handle account IDs and equipment filter using helper functions
  const accountIdsArray = await handleDownloadAccountIds(query);
  const equipmentFilter = handleDownloadEquipmentFilter(query);

  // Build filters using helper functions
  const equipmentRefFilter = buildDownloadEquipmentFilters(
    query as unknown as Record<string, unknown>
  );
  const accountFilters = buildDownloadAccountFilters(
    query as unknown as Record<string, unknown>
  );
  const contractFilters = buildDownloadContractFilters(
    query as unknown as Record<string, unknown>
  );

  const whereCondition: Prisma.equipment_type_allocationWhereInput = {
    account: {
      account_id: { in: accountIdsArray },
      ...accountFilters,
    },
    schedule_agreement_line_item_ref: {
      schedule_agreement_ref: contractFilters,
    },
  };

  // Build sorting configuration
  const { rawOrderBy, inMemorySort } = buildDownloadSortingConfig(query);

  // Build assignment filters
  const assignmentFilters = buildDownloadAssignmentFilters(query);

  // Fetch all matching rows
  const allData = await prisma.equipment_assignment.findMany({
    where: {
      equipment_type_allocation_ref: whereCondition,
      equipment_ref: {
        ...equipmentFilter,
        ...equipmentRefFilter,
      },
      ...assignmentFilters,
    },
    include: {
      equipment_ref: {
        include: {
          simple_field_lookup: true,
          door_type_lookup: true,
          wall_type_lookup: true,
          floor_type_lookup: true,
          roof_type_lookup: true,
          rim_type_lookup: true,
          oem_make_model_ref: true,
          equipment_permit: true,
          equipment_type_lookup_ref: true,
          telematics: true,
          equipment_iot_device_ref: {
            include: {
              iot_device_ref: { include: { iot_device_vendor_ref: true } },
            },
          },
          equipment_load_detail: {
            take: 1,
            orderBy: { equipment_load_date: "desc" },
            include: { load_status_lookup: true },
          },
          dot_inspection: { take: 1, orderBy: { next_inspection_due: "desc" } },
        },
      },
      equipment_type_allocation_ref: {
        include: {
          account: true,
          schedule_agreement_line_item_ref: {
            include: {
              schedule_agreement_ref: {
                include: {
                  master_agreement_ref: true,
                  schedule_agreement_has_attachment: {
                    include: { attachment: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: rawOrderBy,
  });

  // Stats calculation using helper function
  const equipmentIds = allData.map((r) => r.equipment_ref.equipment_id);
  const stats = await calculateStatistics(equipmentIds, allData);

  // Filtering using helper function
  const filteredData = handleDownloadFiltering(allData, query, stats);

  // Map DTO using existing helper function
  const mappedData = filteredData.map((item: any) => mapEquipmentData(item));

  // In-memory sort
  if (inMemorySort) {
    performInMemorySort(mappedData, inMemorySort);
  }

  // Build Excel configuration
  const excelColumns = buildExcelColumns(requestedColumns);
  const formattedData = buildExcelRows(mappedData, requestedColumns);

  // Generate filename and export
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const filename = `fleet_list_${timestamp}.xlsx`;

  const exporter = new ExcelExporter();
  exporter.generateWorkbook({
    sheetName: "Fleet List",
    columns: excelColumns,
    data: formattedData,
    filename,
  });

  const buffer = await exporter.writeToBuffer();

  return { buffer, filename };
};

/**
 * Fetch Telematics Data (Legacy)
 *
 * Retrieves all telematics records for a specific unit number from the secondary database.
 * This is a legacy function that returns all records without pagination.
 *
 * @param unitNumber - Unit number to fetch telematics for
 *
 * @returns Promise containing array of telematics records
 *
 * @deprecated Use fetchTelematics for paginated results
 *
 * @example
 * const records = await fetchTelematics1("ABC123");
 */
export async function fetchTelematics1(
  unitNumber: string
): Promise<TelematicsRecord[]> {
  const query = `
    SELECT 
      vendor_id,
      vendor_name,
      unit_number,
      vin_trailer_serial AS vin_trailer_serial_number,
      latitude,
      longitude,
      heading,
      address,
      speed,
      additional_sensors,
      recived_timestamp,
      vendor_timestamp,
      motion_status AS equipment_status,
      mileage,
      engine_hours,
      gps_battery,
      vendor_gps_owner AS gps_owner,
      vendor_message_id AS message_id,
      vendor_gps_id AS gps_id
    FROM telematics
    WHERE unit_number = $1
    ORDER BY vendor_timestamp DESC
  `;

  const client = await secondaryPool.connect();
  try {
    const result = await client.query(query, [unitNumber]);
    return result.rows as TelematicsRecord[];
  } finally {
    client.release();
  }
}

/**
 * Fetch Telematics Data
 *
 * Retrieves paginated telematics records for a specific unit number from the secondary database.
 * Includes GPS coordinates, motion status, and other telemetry data with proper pagination.
 *
 * @param unitNumber - Unit number to fetch telematics for
 * @param page - Page number for pagination (1-based)
 * @param perPage - Number of records per page
 *
 * @returns Promise containing paginated telematics data
 *
 * @example
 * const result = await fetchTelematics("ABC123", 1, 10);
 */
export async function fetchTelematics(
  unitNumber: string,
  page: number,
  perPage: number
): Promise<PaginatedTelematics> {
  const offset = (page - 1) * perPage;
  const client = await secondaryPool.connect();

  try {
    // Get total count
    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM telematics WHERE unit_number = $1`,
      [unitNumber]
    );
    const total = parseInt(countResult.rows[0].count, 10); // number

    // Calculate total pages
    const totalPages = Math.ceil(total / perPage);

    //Fetch paginated records
    const query = `
      SELECT 
        vendor_id,
        vendor_name,
        unit_number,
        vin_trailer_serial AS vin_trailer_serial_number,
        latitude,
        longitude,
        heading,
        address,
        speed,
        additional_sensors,
        recived_timestamp,
        vendor_timestamp,
        motion_status AS equipment_status,
        mileage,
        engine_hours,
        gps_battery,
        vendor_gps_owner AS gps_owner,
        vendor_message_id AS message_id,
        vendor_gps_id AS gps_id
      FROM telematics
      WHERE unit_number = $1
      ORDER BY vendor_timestamp DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await client.query<TelematicsRecord>(query, [
      unitNumber,
      perPage,
      offset,
    ]);

    return {
      data: result.rows,
      total,
      page,
      perPage,
      totalPages,
    };
  } finally {
    client.release();
  }
}

/**
 * Get Equipment Gate Inspections Service
 *
 * Retrieves paginated gate inspection records for a specific equipment ID.
 * Simple service with pagination and sorting support.
 *
 * @param equipmentId - Equipment ID to fetch gate inspections for
 * @param page - Page number for pagination (default: 1)
 * @param perPage - Items per page (default: 10)
 * @param sort - Sorting field and direction (e.g., "inspection_date:desc")
 * @returns Promise<PaginatedGateInspections> - Paginated gate inspection data
 *
 * @throws {Error} When database query fails or equipment ID is invalid
 */
export const getEquipmentGateInspectionsService = async (
  equipmentId: number,
  page = 1,
  perPage = 10,
  sort?: string
): Promise<PaginatedGateInspections> => {
  try {
    // Calculate offset for pagination
    const offset = (page - 1) * perPage;

    // Get total count of gate inspections for the equipment
    const total = await prisma.equipment_has_gateinspection.count({
      where: {
        equipment_id: equipmentId,
        is_deleted: false,
      },
    });

    // Calculate total pages
    const totalPages = Math.ceil(total / perPage);

    // Build orderBy clause from sort parameter
    let orderBy: any = { inspection_date: "desc" }; // Default sorting

    if (sort) {
      const [field, direction] = sort.split(":");
      const validFields = [
        "inspection_date",
        "location",
        "direction",
        "reason",
        "created_at",
      ];
      const validDirections = ["asc", "desc"];

      if (validFields.includes(field) && validDirections.includes(direction)) {
        orderBy = { [field]: direction };
      }
    }

    // Fetch gate inspections with attachments
    const gateInspections = await prisma.equipment_has_gateinspection.findMany({
      where: {
        equipment_id: equipmentId,
        is_deleted: false,
      },
      include: {
        attachments: {
          include: {
            attachment_ref: {
              select: {
                attachment_id: true,
                name: true,
                url: true,
                mime_type: true,
                document_category_type: true,
              },
            },
          },
        },
      },
      orderBy,
      skip: offset,
      take: perPage,
    });
    // Transform the data to match the UI requirements
    const transformedData: GateInspectionRecord[] = gateInspections.map(
      (inspection: any) => ({
        equipment_has_gateinspection_id:
          inspection.equipment_has_gateinspection_id,
        equipment_id: inspection.equipment_id,
        inspection_date: inspection.inspection_date,
        location: inspection.location,
        direction: inspection.direction,
        reason: inspection.reason,
        status: inspection.status,
        notes: inspection.notes,
        created_at: inspection.created_at,
        created_by: inspection.created_by,
        updated_at: inspection.updated_at,
        updated_by: inspection.updated_by,
        attachments: inspection.attachments.map((attachment: any) => ({
          gateinspection_has_attachment_id:
            attachment.gateinspection_has_attachment_id,
          equipment_has_gateinspection_id:
            attachment.equipment_has_gateinspection_id,
          attachment_id: attachment.attachment_id,
          date_uploaded: attachment.date_uploaded,
          expiration_date: attachment.expiration_date,
          created_at: attachment.created_at,
          created_by: attachment.created_by,
          attachment: {
            attachment_id: attachment.attachment_ref.attachment_id,
            name: attachment.attachment_ref.name ?? undefined,
            description: undefined,
            url: attachment.attachment_ref.url ?? undefined,
            mime_type: attachment.attachment_ref.mime_type ?? undefined,
            document_category_type:
              attachment.attachment_ref.document_category_type,
            date_uploaded: undefined,
            expiration_date: undefined,
          },
        })),
        direction_lookup: undefined,
        reason_lookup: undefined,
        status_lookup: undefined,
      })
    );

    return {
      data: transformedData,
      total,
      page,
      perPage,
      totalPages,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error fetching equipment gate inspections:", error);
    throw new Error(
      `Failed to fetch gate inspections for equipment ID ${equipmentId}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};
