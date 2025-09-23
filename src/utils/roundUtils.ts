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