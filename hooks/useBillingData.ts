
import { useState, useCallback, useEffect } from 'react';
import { BILLS_DATA } from '../constants.ts';
import type { Vegetable, Bill } from '../types/types.ts';
import {
  subscribeToVegetables,
  addVegetableToDb,
  updateVegetableInDb,
  deleteVegetableFromDb,
  subscribeToOrders,
} from '../src/services/dbService.ts';

export const useBillingData = () => {
  const [vegetables, setVegetables] = useState<Vegetable[]>([]);
  const [bills, setBills] = useState<Bill[]>(BILLS_DATA);
  const [vegetablesLoaded, setVegetablesLoaded] = useState(false);

  useEffect(() => {
    const unsubscribeVeg = subscribeToVegetables((items) => {
      setVegetables(items);
      setVegetablesLoaded(true);
    });
    const unsubscribeOrders = subscribeToOrders((incomingBills) => {
      setBills(incomingBills);
    });
    return () => {
      unsubscribeVeg();
      unsubscribeOrders();
    };
  }, []);

  const addVegetable = useCallback(async (newVegetable: Omit<Vegetable, 'id'>) => {
    await addVegetableToDb(newVegetable);
  }, []);

  const updateVegetable = useCallback(async (updatedVegetable: Vegetable) => {
    await updateVegetableInDb(updatedVegetable);
  }, []);

  const deleteVegetable = useCallback(async (vegId: string) => {
    await deleteVegetableFromDb(vegId);
  }, []);

  const addBill = useCallback(async (newBillData: Omit<Bill, 'id' | 'date'>): Promise<Bill> => {
    // --- START FIREBASE INTEGRATION POINT ---
    // In the future, this function will contain your Firebase logic.
    // 1. You would start a Firebase transaction.
    // 2. Create a new bill document in your 'bills' collection.
    
    // Generate invoice number in format: ESdatemonthyear-ordernumber
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const datePrefix = `ES${day}${month}${year}`;
    
    // Count existing bills for today to generate order number
    const todayStart = new Date(year, now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(year, now.getMonth(), now.getDate(), 23, 59, 59);
    
    const todayBillsCount = bills.filter(bill => {
      const billDate = new Date(bill.date);
      return billDate >= todayStart && billDate <= todayEnd;
    }).length;
    
    const orderNumber = (todayBillsCount + 1).toString().padStart(3, '0');
    const invoiceId = `${datePrefix}-${orderNumber}`;
    
    const newBill: Bill = {
      ...newBillData,
      id: invoiceId,
      date: new Date().toISOString(),
      status: 'pending', // Default status
    };

    // 3. For each item in the bill, you would update the stock in your 'vegetables' collection.
    // This local state update correctly mimics that database transaction.
    setVegetables(prevVeggies => {
      const updatedVeggies = [...prevVeggies];
      newBill.items.forEach(item => {
        const vegIndex = updatedVeggies.findIndex(v => v.id === item.vegetableId);
        if (vegIndex !== -1) {
          const originalStock = updatedVeggies[vegIndex].stockKg;
          updatedVeggies[vegIndex] = {
            ...updatedVeggies[vegIndex],
            // Ensure stock doesn't go below zero
            stockKg: Math.max(0, originalStock - item.quantityKg),
          };
        }
      });
      return updatedVeggies;
    });

    // 4. Finally, you would commit the transaction.
    
    // This local state update mimics adding the new bill to your app's state.
    // With Firebase, you'd likely rely on a real-time listener for bills instead.
    setBills(prev => [newBill, ...prev]);

    // The function returns the created bill, which is good practice.
    return newBill;
    // --- END FIREBASE INTEGRATION POINT ---
  }, [bills]);

  const updateBill = useCallback((billId: string, updates: Partial<Bill>) => {
    setBills(prev =>
      prev.map(bill => bill.id === billId ? { ...bill, ...updates } : bill)
    );
  }, []);

  return {
    vegetables,
    vegetablesLoaded,
    addVegetable,
    updateVegetable,
    deleteVegetable,
    bills,
    addBill,
    updateBill,
  };
};

