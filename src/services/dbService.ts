import { db } from '../firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  serverTimestamp,
  where
} from 'firebase/firestore';
import type { Vegetable } from '../../types/types';

const vegetablesCol = collection(db, 'vegetables');

export const subscribeToVegetables = (
  onChange: (vegetables: Vegetable[]) => void
) => {
  const q = query(vegetablesCol, orderBy('name'));
  return onSnapshot(q, (snapshot) => {
    const items: Vegetable[] = snapshot.docs.map((d) => {
      const data = d.data() as Omit<Vegetable, 'id'>;
      return {
        id: d.id,
        name: data.name,
        unitType: data.unitType || 'KG', // Default to KG for existing items
        pricePerKg: Number(data.pricePerKg) || 0,
        totalStockKg: Number(data.totalStockKg) || Number(data.stockKg) || 0, // Fallback for existing data
        stockKg: Number(data.stockKg) || 0,
        category: data.category,
        icon: data.icon,
      };
    });
    onChange(items);
  });
};

export const addVegetableToDb = async (
  vegetable: Omit<Vegetable, 'id'>
): Promise<string> => {
  const now = new Date().toISOString();
  // TODO: Replace placeholders with actual user info from auth context
  const docRef = await addDoc(vegetablesCol, {
    name: vegetable.name,
    unitType: vegetable.unitType,
    pricePerKg: vegetable.pricePerKg,
    totalStockKg: vegetable.totalStockKg,
    stockKg: vegetable.stockKg,
    category: vegetable.category,
    icon: vegetable.icon,
    createdAt: now,
    updatedAt: now,
    createdBy: 'SECETCS033', // placeholder
    updatedBy: 'SECETCS033', // placeholder
    role: 'admin', // placeholder
  });
  return docRef.id;
};

export const updateVegetableInDb = async (vegetable: Vegetable): Promise<void> => {
  const ref = doc(db, 'vegetables', vegetable.id);
  const now = new Date().toISOString();
  // TODO: Replace placeholders with actual user info from auth context
  await updateDoc(ref, {
    name: vegetable.name,
    unitType: vegetable.unitType,
    pricePerKg: vegetable.pricePerKg,
    totalStockKg: vegetable.totalStockKg,
    stockKg: vegetable.stockKg,
    category: vegetable.category,
    icon: vegetable.icon,
    updatedAt: now,
    updatedBy: 'SECETCS033', // placeholder
    role: 'admin', // placeholder
  });
};

export const deleteVegetableFromDb = async (vegId: string): Promise<void> => {
  const ref = doc(db, 'vegetables', vegId);
  await deleteDoc(ref);
};

// User-related functions
export const updateUserNameInDb = async (userId: string, name: string): Promise<void> => {
  const ref = doc(db, 'users', userId);
  await updateDoc(ref, {
    name: name,
    updatedAt: new Date(),
  });
};

export const getUserFromDb = async (userId: string) => {
  const ref = doc(db, 'users', userId);
  const docSnap = await getDoc(ref);
  if (docSnap.exists()) {
    return { ...docSnap.data(), id: userId };
  }
  return null;
};

const ordersCol = collection(db, 'orders');

interface OrderItem {
  id: string;
  name: string;
  pricePerKg: number;
  quantity: number;
  subtotal: number;
}

interface Order {
  bagCost: number;
  bagCount: number;
  cartSubtotal: number;
  createdAt: any; // Firestore Timestamp
  employee_id: string;
  items: OrderItem[];
  status: 'pending' | 'packed' | 'delivered';
  totalAmount: number;
  userId: string;
}

export const placeOrder = async (orderData: Omit<Order, 'createdAt'>): Promise<string> => {
  const batch = writeBatch(db);
  
  // Create the order document
  const orderRef = doc(ordersCol);
  batch.set(orderRef, {
    ...orderData,
    createdAt: serverTimestamp(),
  });

  // Update vegetable stock for each item
  for (const item of orderData.items) {
    const vegRef = doc(vegetablesCol, item.id);
    const vegDoc = await getDoc(vegRef);
    
    if (vegDoc.exists()) {
      const currentStock = vegDoc.data().stockKg || 0;
      const newStock = Math.max(0, currentStock - item.quantity);
      
      batch.update(vegRef, {
        stockKg: newStock,
        updatedAt: serverTimestamp(),
        updatedBy: orderData.userId
      });
    }
  }

  // Commit all changes in a single atomic transaction
  await batch.commit();
  return orderRef.id;
};

export const updateOrderStatus = async (
  orderId: string,
  status: Order['status'],
  userId: string
): Promise<void> => {
  const orderRef = doc(ordersCol, orderId);
  await updateDoc(orderRef, {
    status: status,
    updatedAt: serverTimestamp(),
    updatedBy: userId
  });
};

export const subscribeToOrders = (
  onChange: (orders: Order[]) => void,
  userId?: string
) => {
  // If userId is provided, only get orders for that user
  const constraints = userId ? [where('userId', '==', userId)] : [];
  const q = query(ordersCol, ...constraints, orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        bagCost: data.bagCost || 0,
        bagCount: data.bagCount || 0,
        cartSubtotal: data.cartSubtotal || 0,
        createdAt: data.createdAt,
        employee_id: data.employee_id,
        items: data.items || [],
        status: data.status || 'pending',
        totalAmount: data.totalAmount || 0,
        userId: data.userId
      } as Order;
    });
    onChange(orders);
  });
};


