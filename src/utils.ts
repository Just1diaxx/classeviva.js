/**
 * Formats a date into the YYYYMMDD string format required by ClasseViva URL path parameters.
 * Supports Date instances, YYYY-MM-DD strings, ISO strings, YYYYMMDD strings, and timestamps.
 */
export function formatDateParam(date: Date | string | number): string {
  if (typeof date === "string") {
    const trimmed = date.trim();
    // Already in YYYYMMDD format (8 digits)
    if (/^\d{8}$/.test(trimmed)) {
      return trimmed;
    }
    // Formatted as YYYY-MM-DD or YYYY/MM/DD
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(trimmed)) {
      const parts = trimmed.split(/[-/T ]/);
      const year = parts[0]?.padStart(4, "0");
      const month = parts[1]?.padStart(2, "0");
      const day = parts[2]?.padStart(2, "0");
      return `${year}${month}${day}`;
    }
    // Attempt standard Date parsing
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateInstance(parsed);
    }
    throw new TypeError(`Invalid date format for ClasseViva API: "${date}". Expected Date, YYYYMMDD, or YYYY-MM-DD.`);
  }

  if (typeof date === "number") {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      throw new TypeError(`Invalid timestamp: ${date}`);
    }
    return formatDateInstance(parsed);
  }

  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) {
      throw new TypeError("Invalid Date object");
    }
    return formatDateInstance(date);
  }

  throw new TypeError(`Unsupported date type: ${typeof date}`);
}

function formatDateInstance(d: Date): string {
  const year = d.getFullYear().toString().padStart(4, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Normalizes and joins URL base and subpaths without duplicate slashes.
 */
export function joinUrl(base: string, ...paths: string[]): string {
  let result = base.replace(/\/+$/, "");
  for (const part of paths) {
    if (!part) continue;
    const cleanPart = part.replace(/^\/+/, "").replace(/\/+$/, "");
    if (cleanPart) {
      result += "/" + cleanPart;
    }
  }
  return result;
}

/**
 * Trims padded spaces from strings (ClasseViva often pads school names with trailing whitespace).
 */
export function trimSafe(str: unknown): string {
  if (typeof str === "string") {
    return str.trim();
  }
  return "";
}
