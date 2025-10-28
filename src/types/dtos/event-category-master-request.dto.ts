// Request DTOs for EventCategoryMaster

export interface CreateEventCategoryMasterRequestDto {
  category_name: string;
  status: string;
  created_by: number;
  updated_by:number
}
