import type { Vegetable, User, Bill } from './types/types';

export const VEGETABLES_DATA: Vegetable[] = [
  { id: 'veg1', name: 'Tomato', unitType: 'KG', pricePerKg: 40, totalStockKg: 100, stockKg: 100, category: 'Vegetables', icon: '🍅' },
  { id: 'veg2', name: 'Potato', unitType: 'KG', pricePerKg: 30, totalStockKg: 150, stockKg: 150, category: 'Vegetables', icon: '🥔' },
  { id: 'veg3', name: 'Onion', unitType: 'KG', pricePerKg: 50, totalStockKg: 200, stockKg: 200, category: 'Vegetables', icon: '🧅' },
  { id: 'veg4', name: 'Carrot', unitType: 'KG', pricePerKg: 60, totalStockKg: 80, stockKg: 80, category: 'Vegetables', icon: '🥕' },
  { id: 'veg5', name: 'Broccoli', unitType: 'KG', pricePerKg: 120, totalStockKg: 50, stockKg: 50, category: 'Vegetables', icon: '🥦' },
  { id: 'veg6', name: 'Spinach', unitType: 'KG', pricePerKg: 20, totalStockKg: 60, stockKg: 60, category: 'Greens', icon: '🥬' },
  { id: 'veg7', name: 'Cucumber', unitType: 'KG', pricePerKg: 35, totalStockKg: 70, stockKg: 70, category: 'Vegetables', icon: '🥒' },
  { id: 'veg8', name: 'Bell Pepper', unitType: 'KG', pricePerKg: 80, totalStockKg: 40, stockKg: 40, category: 'Vegetables', icon: '🫑' },
  { id: 'veg9', name: 'Lettuce', unitType: 'KG', pricePerKg: 100, totalStockKg: 30, stockKg: 30, category: 'Greens', icon: '🥬' },
  { id: 'veg10', name: 'Apple', unitType: 'COUNT', pricePerKg: 150, totalStockKg: 100, stockKg: 100, category: 'Fruits', icon: '�' },
];

export const USERS_DATA: User[] = [
  { id: 'admin', name: 'Admin One', role: 'admin' },
  { id: 'user', name: 'Priya Kumar', role: 'user' },
  { id: 'user2', name: 'Ravi Singh', role: 'user' },
];

export const BILLS_DATA: Bill[] = []; // Start with no bills
