export interface Vegetable {
  id: string;
  name: string;
  unitType: 'KG' | 'COUNT'; // Unit type for stock tracking
  pricePerKg: number;
  totalStockKg: number; // Total stock set by admin
  stockKg: number; // Available stock (dynamically calculated)
  category: string;
}

export interface BillItem {
  vegetableId: string;
  quantityKg: number;
  subtotal: number;
  name?: string; // Optional field for historical data preservation
  pricePerKg?: number; // Optional field for historical data preservation
}

export interface Bill {
  id: string;
  date: string; // ISO string
  items: BillItem[];
  total: number;
  customerName: string;
  department?: string; // Optional department field
  paymentScreenshot?: string; // base64 string
  // Added new statuses: 'inprogress' and 'bill_sent'
  status: 'pending' | 'packed' | 'delivered' | 'inprogress' | 'bill_sent';
  bags?: number; // Number of bags purchased (₹10 each)
  customerId?: string; // Added for customer ID reference
}

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'user';
  email?: string; // Optional email field for settings
}
