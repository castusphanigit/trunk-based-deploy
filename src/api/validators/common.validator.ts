import { query } from "express-validator";

export const paginateAndFilterAccountsQuery = [
  query("page").optional().isInt({ min: 1 }),
  query("perPage").optional().isInt({ min: 1, max: 200 }),
];
