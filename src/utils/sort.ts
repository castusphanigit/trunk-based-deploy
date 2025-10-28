export type SortFieldMap = Record<string, string | NestedSortField>;

interface NestedSortField {
  [relation: string]: string | NestedSortField
}

export function buildOrderByFromSort<T>(
  sort: string | undefined,
  allowedFields: SortFieldMap,
  defaultField: keyof T,
  opts: { expandName?: boolean } = { expandName: true } // default true
): Record<string, unknown>[] {
  if (!sort) {
    return [{ [defaultField]: "desc" as const }];
  }

  const orderBy: Record<string, unknown>[] = [];
  const parts = sort.split(",");

  // helper: recursively build nested orderBy
  function applySort(
    obj: Record<string, unknown>,
    order: "asc" | "desc"
  ): Record<string, unknown> {
    const key = Object.keys(obj)[0];
    const value = obj[key];

    if (typeof value === "object" && value !== null) {
      return { [key]: applySort(value as Record<string, unknown>, order) }; // recurse deeper
    }

    return { [key]: order }; // leaf node
  }

  for (const part of parts) {
    const [field, directionRaw] = part.split(":");
    const order = directionRaw?.toLowerCase() === "desc" ? "desc" : "asc";
    const mappedField = allowedFields[field?.trim()];

    if (!mappedField) continue;

    if (mappedField === "name" && opts.expandName) {
      // expand into first_name + last_name only if expandName is true
      orderBy.push({ first_name: order }, { last_name: order });
    } else if (typeof mappedField === "object") {
      orderBy.push(applySort(mappedField, order));
    } else {
      orderBy.push({ [mappedField]: order });
    }
  }

  return orderBy.length > 0 ? orderBy : [{ [defaultField]: "desc" as const }];
}
