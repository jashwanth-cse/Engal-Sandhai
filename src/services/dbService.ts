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
  Timestamp,
} from 'firebase/firestore';
import type { Vegetable } from '../../types/types';
import type { Bill, BillItem } from '../../types/types';

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
      };
    });
    onChange(items);
  });
};

export const addVegetableToDb = async (
  vegetable: Omit<Vegetable, 'id'>
): Promise<string> => {
  const docRef = await addDoc(vegetablesCol, {
    name: vegetable.name,
    unitType: vegetable.unitType,
    pricePerKg: vegetable.pricePerKg,
    totalStockKg: vegetable.totalStockKg,
    stockKg: vegetable.stockKg,
    category: vegetable.category,
  });
  return docRef.id;
};

export const updateVegetableInDb = async (vegetable: Vegetable): Promise<void> => {
  const ref = doc(db, 'vegetables', vegetable.id);
  await updateDoc(ref, {
    name: vegetable.name,
    unitType: vegetable.unitType,
    pricePerKg: vegetable.pricePerKg,
    totalStockKg: vegetable.totalStockKg,
    stockKg: vegetable.stockKg,
    category: vegetable.category,
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


// Orders subscription (maps Firestore 'orders' to Bill model used by UI)
export const subscribeToOrders = (
  onChange: (bills: Bill[]) => void
) => {
  const ordersCol = collection(db, 'orders');
  const q = query(ordersCol, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const bills: Bill[] = snapshot.docs.map((d) => {
      const data = d.data() as any;
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date());
      const items: BillItem[] = Array.isArray(data.items)
        ? data.items.map((it: any) => ({
            vegetableId: it.id,
            quantityKg: Number(it.quantity) || 0,
            subtotal: Number(it.subtotal) || 0,
          }))
        : [];
      const bill: Bill = {
        id: String(data.orderId || d.id),
        date: new Date(createdAt).toISOString(),
        items,
        total: Number(data.totalAmount) || 0,
        // Store the userId in customerName for legacy display; attach explicit customerId for lookups
        customerName: String(data.userId || data.employee_id || 'Unknown'),
        status: (data.status as Bill['status']) || 'pending',
        bags: Number(data.bagCount || data.bags || 0) || undefined,
      };
      // Attach additional lookup id (non-breaking extra field)
      (bill as any).customerId = String(data.userId || data.employee_id || '');
      return bill;
    });
    onChange(bills);
  });
};


