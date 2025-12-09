import type { Vegetable, User, Bill } from './types/types';

export const VEGETABLES_DATA: Vegetable[] = [
  { id: 'veg1', name: 'Tomato', unitType: 'KG', pricePerKg: 40, totalStockKg: 100, stockKg: 100, category: 'Vegetables' },
  { id: 'veg2', name: 'Potato', unitType: 'KG', pricePerKg: 30, totalStockKg: 150, stockKg: 150, category: 'Vegetables' },
  { id: 'veg3', name: 'Onion', unitType: 'KG', pricePerKg: 50, totalStockKg: 200, stockKg: 200, category: 'Vegetables' },
  { id: 'veg4', name: 'Carrot', unitType: 'KG', pricePerKg: 60, totalStockKg: 80, stockKg: 80, category: 'Vegetables' },
  { id: 'veg5', name: 'Broccoli', unitType: 'KG', pricePerKg: 120, totalStockKg: 50, stockKg: 50, category: 'Vegetables' },
  { id: 'veg6', name: 'Spinach', unitType: 'KG', pricePerKg: 20, totalStockKg: 60, stockKg: 60, category: 'Greens' },
  { id: 'veg7', name: 'Cucumber', unitType: 'KG', pricePerKg: 35, totalStockKg: 70, stockKg: 70, category: 'Vegetables' },
  { id: 'veg8', name: 'Bell Pepper', unitType: 'KG', pricePerKg: 80, totalStockKg: 40, stockKg: 40, category: 'Vegetables' },
  { id: 'veg9', name: 'Lettuce', unitType: 'KG', pricePerKg: 100, totalStockKg: 30, stockKg: 30, category: 'Greens' },
  { id: 'veg10', name: 'Apple', unitType: 'COUNT', pricePerKg: 150, totalStockKg: 100, stockKg: 100, category: 'Fruits' },
  { id: 'veg11', name: 'Organic Fertilizer', unitType: 'KG', pricePerKg: 200, totalStockKg: 25, stockKg: 25, category: 'Others' },
];

export const USERS_DATA: User[] = [
  { id: 'admin', name: 'Admin One', role: 'admin' },
  { id: 'user', name: 'Priya Kumar', role: 'user' },
  { id: 'user2', name: 'Ravi Singh', role: 'user' },
];

export const BILLS_DATA: Bill[] = []; // Start with no bills

// Stock management constants
export const ORDERABLE_STOCK_PERCENTAGE = 0.85; // 85% of stock is orderable to prevent overselling
export const RESERVED_STOCK_PERCENTAGE = 0.15; // 15% reserved buffer

/**
 * Calculate orderable stock for users
 * KG items: 85% of TOTAL stock (not current available) - orders consumed
 * COUNT items: 100% of available stock
 * 
 * For KG items, we calculate based on original total stock to maintain the 15% reserve:
 * - If total was 10kg, orderable is always max 8.5kg
 * - Even if 5kg sold, orderable is min(8.5 - 5 = 3.5kg, available 5kg)
 * - When 8.5kg sold, orderable becomes 0, leaving 1.5kg reserved
 */
export const getOrderableStock = (availableStock: number, totalStock: number, unitType: 'KG' | 'COUNT'): number => {
  if (unitType === 'KG') {
    // Calculate max orderable from original total (85%)
    const maxOrderable = totalStock * ORDERABLE_STOCK_PERCENTAGE;
    // Calculate how much has been sold
    const soldAmount = totalStock - availableStock;
    // Remaining orderable = max orderable - already sold
    const remainingOrderable = Math.max(0, maxOrderable - soldAmount);
    // Return the minimum of remaining orderable and available stock
    return Math.min(remainingOrderable, availableStock);
  }
  return availableStock;
};
