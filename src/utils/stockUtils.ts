import { collection, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Stock } from '../types/firestore';

export const addStock = async (stockData: Omit<Stock, 'addedAt' | 'lastUpdated'>) => {
  const newStock: Stock = {
    ...stockData,
    // Initialize availableStock to be the same as quantity when adding new stock
    availableStock: stockData.quantity,
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

export const updateAvailableStock = async (productId: string, quantitySold: number) => {
  const stockRef = doc(db, 'stocks', productId);
  const stockDoc = await getDoc(stockRef);
  
  if (stockDoc.exists()) {
    const currentData = stockDoc.data();
    const currentAvailableStock = currentData.availableStock || currentData.quantity || 0;
    const newAvailableStock = Math.max(0, currentAvailableStock - quantitySold);
    
    await updateDoc(stockRef, {
      availableStock: newAvailableStock,
      lastUpdated: new Date()
    });
  }
};

export const updateStockQuantityAndAvailable = async (productId: string, newQuantity: number) => {
  const stockRef = doc(db, 'stocks', productId);
  const stockDoc = await getDoc(stockRef);
  
  if (stockDoc.exists()) {
    const currentData = stockDoc.data();
    const currentAvailableStock = currentData.availableStock || currentData.quantity || 0;
    const quantityDifference = newQuantity - (currentData.quantity || 0);
    const newAvailableStock = Math.max(0, currentAvailableStock + quantityDifference);
    
    await updateDoc(stockRef, {
      quantity: newQuantity,
      availableStock: newAvailableStock,
      lastUpdated: new Date()
    });
  }
};
