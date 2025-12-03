/**
 * Rounds a number according to the business rule:
 * - If decimal >= 0.5, round up to next whole number
 * - If decimal < 0.5, round down to previous whole number
 * @param amount - The amount to round
 * @returns The rounded amount
 */
export const roundTotal = (amount: number): number => {
  return Math.round(amount);
};

/**
 * Formats a rounded total for display
 * @param amount - The amount to format
 * @returns Formatted string without decimal places
 */
export const formatRoundedTotal = (amount: number): string => {
  return `₹${roundTotal(amount)}`;
};

/**
 * Fixes floating-point precision errors by rounding to specified decimal places
 * Solves issues like 61.949999999999996 or 1.999999999 or 4.5999999
 * @param num - The number to fix
 * @param decimals - Number of decimal places (default 2)
 * @returns Number with proper precision
 */
export const fixFloatingPoint = (num: number, decimals: number = 2): number => {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
};