export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
  productName: string;
}

export interface Order {
  orderId: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'billed' | 'completed';
  createdAt: Date;
  bill?: {
    billId: string;
    employeeId: string;
    generatedAt: Date;
    finalAmount: number;
  };
}

export interface Stock {
  productId: string;
  productName: string;
  quantity: number;
  availableStock: number;
  price: number;
  addedBy: string;
  addedAt: Date;
  lastUpdated: Date;
}

export interface AvailableStock {
  productId: string;
  productName: string;
  category: string;
  pricePerKg: number;
  totalStockKg: number;
  availableStockKg: number;
  unitType: 'KG' | 'COUNT';
  lastUpdated: Date;
  updatedBy: string;
}
