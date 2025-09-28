import { getDoc } from 'firebase/firestore';
import { placeOrder, findOrderByOrderId, OrderData } from '../services/dbService';
import { OrderItem } from '../types/firestore';

export const createOrder = async (userId: string, items: OrderItem[]) => {
  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const orderData: OrderData = {
    userId,
    employee_id: userId,
    items: items.map(item => ({
      id: item.productId,
      name: item.productName,
      quantity: item.quantity,
      pricePerKg: item.price,
      subtotal: item.price * item.quantity
    })),
    totalAmount,
    status: 'pending',
    bagCount: 0,
    bagCost: 0,
    cartSubtotal: totalAmount
  };

  // Use the new placeOrder function which stores in date-based collections
  const billNumber = await placeOrder(orderData);
  return billNumber;
};

export const generateBill = async (orderId: string, employeeId: string) => {
  // Use the new helper to find order across date-based collections
  const orderInfo = await findOrderByOrderId(orderId);
  
  if (!orderInfo) throw new Error('Order not found');
  
  const orderData = orderInfo.data;
  const billData = {
    billId: `BILL-${orderId}`,
    employeeId,
    generatedAt: new Date(),
    finalAmount: orderData.totalAmount
  };

  // Note: The order status update is handled by updateOrderStatus function
  // This function now mainly returns bill data for compatibility
  return billData;
};
