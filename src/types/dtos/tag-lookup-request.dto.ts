// Request DTOs

export interface CreateTagLookupRequestDto {
  tag_name: string;
  status?: string;
  updated_by?: string
}

export interface UpdateTagLookupRequestDto {
  tag_name?: string;
  status?: string;
  updated_by?: string
}

export interface FetchTagLookupsQueryDto {
  page?: number;
  perPage?: number;
  tag_name?: string;
  status?: string;
  updated_by?: string
}
