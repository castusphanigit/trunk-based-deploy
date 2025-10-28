// Response DTOs for EventCategoryMaster

export interface EventCategoryMasterResponseDto {
  event_category_master_id: number;
  category_name: string;
  status: string;
  is_deleted: boolean;
  created_by: number | null;
  created_at: Date;
  updated_at: Date | null
}
