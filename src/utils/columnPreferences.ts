import prisma from "../config/database.config"; // Adjust path as needed

// Get user's saved column preferences for a particular table
export const getUserColumnPreferences = async (
  userId: number,
  tableNameId: number
): Promise<string[] | null> => {
  const pref = await prisma.column_preferences.findUnique({
    where: {
      user_id_column_preference_table_name_id: {
        user_id: userId,
        column_preference_table_name_id: tableNameId,
      },
    },
    select: { selected_columns: true },
  });

  return pref ? (pref.selected_columns as string[]) : null;
};

// Build Prisma select object dynamically based on column names
export const buildPrismaSelect = (
  columns: string[]
): Record<string, unknown> => {
  const select: Record<string, unknown> = {};
  for (const col of columns) {
    if (col.includes(".")) {
      // Handle relation (e.g., "user_role_ref.name")
      const [relation, field] = col.split(".");
      select[relation] ??= { select: {} };
      (select[relation] as { select: Record<string, boolean> }).select[field] =
        true;
    } else {
      select[col] = true;
    }
  }
  return select;
};

// Default columns for your tables
export const getDefaultColumns = (tableName: string): string[] => {
  if (tableName === "users") {
    return [
      "user_id",
      "first_name",
      // "last_name",
      // "email",
      // "status",
      // "user_role_ref.name",
    ];
  }
  // Add any other tables here
  return [];
};
