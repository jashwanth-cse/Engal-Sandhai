import { db } from '../firebase';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
} from 'firebase/firestore';
import type { Vegetable } from '../../types/types';

const ordersCol = collection(db, 'orders');
const vegetablesCol = collection(db, 'vegetables');

export interface OrderItem {
  id: string;
  name: string;
  pricePerKg: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
  bagCost: number;
  bagCount: number;
  cartSubtotal: number;
  createdAt: string;
  employee_id: string;
  items: OrderItem[];
  status: string;
  totalAmount: number;
  userId: string;
}

export const placeOrder = async (
  order: Omit<Order, 'createdAt'>
): Promise<string> => {
  const now = new Date().toISOString();
  // Add order to Firestore
  const docRef = await addDoc(ordersCol, {
    ...order,
    createdAt: now,
  });

  // Update vegetable stock in real time
  for (const item of order.items) {
    const vegRef = doc(vegetablesCol, item.id);
    const vegSnap = await getDoc(vegRef);
    if (vegSnap.exists()) {
      const vegData = vegSnap.data() as Vegetable;
      const newStock = (vegData.stockKg || 0) - item.quantity;
      await updateDoc(vegRef, {
        stockKg: newStock,
        updatedAt: now,
        updatedBy: order.userId,
      });
    }
  }

  return docRef.id;
};
