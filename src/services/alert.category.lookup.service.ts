import prisma from "../config/database.config";
import { CreateAlertCategoryRequestDto } from "../types/dtos/alert.category.lookup.request.dto";

export class AlertCategoryLookupService {
  public async createAlertCategory(dto: CreateAlertCategoryRequestDto) {
    return prisma.alert_category_lookup.create({
      data: {
        category_name: dto.category_name,
        status: dto.status ?? "ACTIVE",
        created_by: dto.created_by,
        created_at: new Date(),
        updated_at: new Date(),
      },
      select: {
        alert_category_lookup_id: true,
        category_name: true,
        status: true,
        created_by: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  public async getAllAlertCategories() {
    return prisma.alert_category_lookup.findMany({
      where: { status: { equals: "Active", mode: "insensitive" } },
      orderBy: { alert_category_lookup_id: "asc" },
      select: {
        alert_category_lookup_id: true,
        category_name: true,
        status: true,
        created_by: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  public async getAlertCategoryById(id: number) {
    return prisma.alert_category_lookup.findUnique({
      where: { alert_category_lookup_id: id },
      select: {
        alert_category_lookup_id: true,
        category_name: true,
        status: true,
        created_by: true,
        created_at: true,
        updated_at: true,
      },
    });
  }
}
