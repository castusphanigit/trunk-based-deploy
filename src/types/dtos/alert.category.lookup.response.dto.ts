export interface AlertCategoryResponseDto {
  alert_category_lookup_id: number;
  category_name: string;
  status: string;

  is_deleted: boolean;
  deleted_by?: number | null;
  deleted_at?: Date | null;

  created_at: Date;
  created_by?: number | null;
  updated_at?: Date | null;
  updated_by?: number | null
}
