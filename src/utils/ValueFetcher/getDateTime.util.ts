/**
 * Returns the current UTC date-time in ISO format: 'YYYY-MM-DDTHH:mm:ss.sssZ'.
 *
 * @returns {string} The current date-time in UTC ISO format.
 */
export function getCurrentDateTime(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");

  const yyyy = now.getUTCFullYear();
  const mm = pad(now.getUTCMonth() + 1);
  const dd = pad(now.getUTCDate());
  const hh = pad(now.getUTCHours());
  const mi = pad(now.getUTCMinutes());
  const ss = pad(now.getUTCSeconds());

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

/**
 * Returns a future UTC date-time in ISO format, offset by the given number of minutes.
 *
 * @param {number} minutes - The number of minutes to add to the current UTC time.
 * @returns {string} The resulting date-time in UTC ISO format.
 */
export function getExpiryDateTime(minutes: number): string {
  const now = new Date();
  const expiry = new Date(now.getTime() + minutes * 60 * 1000);
  return expiry.toISOString();
}

export function addMinutesUTC(utcString: string, minutes: number): string {
  const date = new Date(utcString);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return date.toISOString();
}

/**
 * Returns in format: '07 Jan 2026, 10:57 am'
 *
 */
export const formatDateTime = (dateString: string) => {
  if (!dateString) return "--";

  return new Date(dateString).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

// Helper to convert local datetime-local value to UTC ISO string
export function localDateTimeToUTC(localDateTimeString: string) {
  if (!localDateTimeString) return "";
  const localDate = new Date(localDateTimeString);
  return localDate.toISOString(); // Returns UTC ISO string like "2024-01-15T18:30:00.000Z"
}

export const toDatetimeLocal = (dateString: string): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";

    // Get local time components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
};

/*
 * Retrun the expiry date of the parameter passed.
 */
export const getExpiryDate = (days: number): string => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt.toISOString();
};
