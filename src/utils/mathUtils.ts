/**
 * Utility functions for safe floating-point arithmetic.
 * Handles precision issues common in JavaScript (e.g., 0.1 + 0.2 !== 0.3).
 */

// Precision factor for 2 decimal places (100)
const PRECISION = 100;

/**
 * Rounds a number to 2 decimal places safely.
 * @param num The number to round
 * @returns The rounded number
 */
export const round = (num: number): number => {
    return Math.round((num + Number.EPSILON) * PRECISION) / PRECISION;
};

/**
 * Adds two numbers safely.
 * @param a First number
 * @param b Second number
 * @returns The sum, rounded to 2 decimal places
 */
export const add = (a: number, b: number): number => {
    return round(a + b);
};

/**
 * Subtracts b from a safely.
 * @param a Minuend
 * @param b Subtrahend
 * @returns The difference, rounded to 2 decimal places
 */
export const sub = (a: number, b: number): number => {
    return round(a - b);
};

/**
 * Multiplies two numbers safely.
 * @param a First number
 * @param b Second number
 * @returns The product, rounded to 2 decimal places
 */
export const mul = (a: number, b: number): number => {
    return round(a * b);
};

/**
 * Divides a by b safely.
 * @param a Dividend
 * @param b Divisor
 * @returns The quotient, rounded to 2 decimal places
 */
export const div = (a: number, b: number): number => {
    if (b === 0) return 0; // Handle division by zero gracefully
    return round(a / b);
};
