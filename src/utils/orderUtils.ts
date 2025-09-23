import { collection, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Order, OrderItem } from '../types/firestore';

export const createOrder = async (userId: string, items: OrderItem[]) => {
  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const orderData: Order = {
    orderId: '', // Will be set after creation
    userId,
    items,
    totalAmount,
    status: 'pending',
    createdAt: new Date(),
  };

  const docRef = await addDoc(collection(db, 'orders'), orderData);
  await updateDoc(doc(db, 'orders', docRef.id), {
    orderId: docRef.id
  });

  return docRef.id;
};

export const generateBill = async (orderId: string, employeeId: string) => {
  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);
  
  if (!orderSnap.exists()) throw new Error('Order not found');
  
  const orderData = orderSnap.data() as Order;
  const billData = {
    billId: `BILL-${orderId}`,
    employeeId,
    generatedAt: new Date(),
    finalAmount: orderData.totalAmount
  };

  await updateDoc(orderRef, {
    status: 'billed',
    bill: billData
  });

  return billData;
};
