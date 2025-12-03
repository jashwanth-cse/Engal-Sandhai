export interface Vegetable {
  id: string;
  name: string;
  localName?: string; // Optional local name such as Tamil
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
  pdfDownloadUrl?: string; // Firebase Storage download link for the generated bill PDF
  pdfStoragePath?: string; // Storage path of the bill PDF (e.g., bills/ES01122025-001.pdf)
  pdfStorageUri?: string; // Full gs:// URI for the bill PDF
  lastSharedAt?: string; // ISO timestamp of last share action
  lastSharedBy?: string; // User ID that triggered the last share
}

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'user' | 'faculty';
  email?: string;
  employee_name?: string; // Employee name from Firebase
  phone?: string; // Phone number
  department?: string; // Department (e.g., "Purchase", "Mechanical", etc.)
  createdAt?: string; // ISO timestamp
}
