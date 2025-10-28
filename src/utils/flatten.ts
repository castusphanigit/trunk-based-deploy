export function flattenObject(
  obj: Record<string, unknown>,
  prefix = "",
  separator = "_"
): Record<string, unknown> {
  const flattened: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}${separator}${key}` : key;

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date) //  do NOT recurse into Date
    ) {
      Object.assign(
        flattened,
        flattenObject(value as Record<string, unknown>, newKey, separator)
      );
    } else {
      flattened[newKey] = value instanceof Date ? value.toISOString() : value; //  Preserve date as string
    }
  }

  return flattened;
}
