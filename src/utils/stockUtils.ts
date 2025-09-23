import { collection, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Stock } from '../types/firestore';

export const addStock = async (stockData: Omit<Stock, 'addedAt' | 'lastUpdated'>) => {
  const newStock: Stock = {
    ...stockData,
    addedAt: new Date(),
    lastUpdated: new Date()
  };

  const docRef = await addDoc(collection(db, 'stocks'), newStock);
  return docRef.id;
};

export const updateStockQuantity = async (productId: string, quantity: number) => {
  const stockRef = doc(db, 'stocks', productId);
  await updateDoc(stockRef, {
    quantity,
    lastUpdated: new Date()
  });
};
