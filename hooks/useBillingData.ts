
import { useState, useCallback, useEffect } from 'react';
import { BILLS_DATA } from '../constants.ts';
import type { Vegetable, Bill } from '../types/types.ts';
import {
  subscribeToVegetables,
  addVegetableToDb,
  updateVegetableInDb,
  deleteVegetableFromDb,
  subscribeToOrders,
  subscribeToDateOrders,
  subscribeToTodayOrders,
  subscribeToAvailableStock,
  batchReduceVegetableStock,
} from '../src/services/dbService.ts';

interface UseBillingDataProps {
  selectedDate?: Date | null;
}

export const useBillingData = (props: UseBillingDataProps = {}) => {
  const { selectedDate } = props;
  const [vegetables, setVegetables] = useState<Vegetable[]>([]);
  const [bills, setBills] = useState<Bill[]>(BILLS_DATA);
  const [vegetablesLoaded, setVegetablesLoaded] = useState(false);
  const [availableStock, setAvailableStock] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    // Use date-based subscriptions for inventory when a date is selected
    const unsubscribeVeg = subscribeToVegetables((items) => {
      setVegetables(items);
      setVegetablesLoaded(true);
    }, selectedDate);

    // Subscribe to available stock for the selected date
    const unsubscribeAvailableStock = subscribeToAvailableStock((stockMap) => {
      setAvailableStock(stockMap);
    }, selectedDate);

    // Subscribe to orders based on selected date
    let unsubscribeOrders: (() => void) | null = null;
    
    if (selectedDate) {
      // Subscribe to orders for specific date
      unsubscribeOrders = subscribeToDateOrders(selectedDate, (incomingBills) => {
        setBills(incomingBills);
      });
    } else {
      // Subscribe to today's orders (default behavior)
      unsubscribeOrders = subscribeToTodayOrders((incomingBills) => {
        setBills(incomingBills);
      });
    }

    return () => {
      unsubscribeVeg();
      unsubscribeAvailableStock();
      if (unsubscribeOrders) {
        unsubscribeOrders();
      }
    };
  }, [selectedDate]);

  const addVegetable = useCallback(async (newVegetable: Omit<Vegetable, 'id'>, date?: Date) => {
    // Use the provided date, or selected date from hook, or current date as fallback
    const targetDate = date || selectedDate || new Date();
    await addVegetableToDb(newVegetable, targetDate);
  }, [selectedDate]);

  const updateVegetable = useCallback(async (updatedVegetable: Vegetable, date?: Date) => {
    // Use the provided date, or selected date from hook, or current date as fallback
    const targetDate = date || selectedDate || new Date();
    await updateVegetableInDb(updatedVegetable, targetDate);
  }, [selectedDate]);

  const deleteVegetable = useCallback(async (vegId: string, date?: Date) => {
    // Use the provided date, or selected date from hook, or current date as fallback
    const targetDate = date || selectedDate || new Date();
    await deleteVegetableFromDb(vegId, targetDate);
  }, [selectedDate]);

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

    // 3. Update stock in the database using the batch stock reduction function
    try {
      const stockUpdates = newBill.items.map(item => ({
        vegetableId: item.vegetableId,
        quantityToReduce: item.quantityKg
      }));

      // Update stock in Firebase vegetables collection (this will also update availableStock)
      await batchReduceVegetableStock(stockUpdates, selectedDate);
      console.log('✅ Successfully updated vegetable stock in database for order:', invoiceId);
    } catch (error) {
      console.error('❌ Error updating vegetable stock in database for order:', invoiceId, error);
      // You might want to handle this error appropriately
      throw error; // Throw error to prevent order creation if stock update fails
    }

    // Keep the legacy vegetables stock update for immediate UI feedback
    // The real-time listener will update this from the database, but this provides instant feedback
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
  }, [bills, selectedDate]);

  const updateBill = useCallback((billId: string, updates: Partial<Bill>) => {
    setBills(prev =>
      prev.map(bill => bill.id === billId ? { ...bill, ...updates } : bill)
    );
  }, []);

  return {
    vegetables,
    vegetablesLoaded,
    availableStock,
    addVegetable,
    updateVegetable,
    deleteVegetable,
    bills,
    addBill,
    updateBill,
  };
};

