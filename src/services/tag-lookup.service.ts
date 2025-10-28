import prisma from "../config/database.config";
import { FetchTagLookupsQueryDto } from "../types/dtos/tag-lookup-request.dto";
import { TagLookupResponseDto } from "../types/dtos/tag-lookup-response.dto";
import { getPagination } from "../utils/pagination";

export const TagLookupService = {
  async fetchTagLookups(query: FetchTagLookupsQueryDto): Promise<{
    data: TagLookupResponseDto[],
    total: number,
    page: number,
    perPage: number
  }> {
    const { page, perPage, skip, take } = getPagination(query);

    const filters: Record<string, unknown> = {
      ...(query.tag_name && {
        tag_name: { contains: String(query.tag_name), mode: "insensitive" },
      }),
      ...(query.status && {
        status: { contains: String(query.status), mode: "insensitive" },
      }),
      ...(query.updated_by && {
        updated_by: { contains: String(query.updated_by), mode: "insensitive" },
      }),
    };

    const total = await prisma.tag_lookup.count({ where: filters });

    const data = await prisma.tag_lookup.findMany({
      skip,
      take,
      where: filters,
      orderBy: { tag_lookup_id: "asc" },
      select: {
        tag_lookup_id: true,
        tag_name: true,
        status: true,
        created_at: true,
      },
    });

    return { data, total, page, perPage };
  },
};
