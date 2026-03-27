import { AutoCliError } from "../../../errors.js";

export function parseShoppingLimitOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 25) {
    throw new AutoCliError("INVALID_LIMIT", "Expected --limit to be a number between 1 and 25.");
  }

  return parsed;
}
