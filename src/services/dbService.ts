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


