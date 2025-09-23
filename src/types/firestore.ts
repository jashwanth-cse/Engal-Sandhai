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
  price: number;
  addedBy: string;
  addedAt: Date;
  lastUpdated: Date;
}
