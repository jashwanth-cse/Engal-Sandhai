
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
  placeOrder,
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
        console.log('🔥 subscribeToDateOrders callback - received bills:', incomingBills.length);
        setBills(incomingBills);
      });
    } else {
      // Subscribe to today's orders (default behavior)
      unsubscribeOrders = subscribeToTodayOrders((incomingBills) => {
        console.log('🔥 subscribeToTodayOrders callback - received bills:', incomingBills.length);
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
    console.log('🔥 addBill called with data:', newBillData);
    console.log('🔥 Current bills count before:', bills.length);
    
    try {
      // Calculate bag cost and cart subtotal
      const cartSubtotal = newBillData.items.reduce((sum, item) => sum + item.subtotal, 0);
      const bagCost = (newBillData.bags || 0) * 10; // Assuming ₹10 per bag
      
      // Prepare order data for database
      const orderData = {
        bagCost,
        bagCount: newBillData.bags || 0,
        cartSubtotal,
        employee_id: 'admin', // For now, using admin as employee
        items: newBillData.items.map(item => ({
          id: item.vegetableId,
          name: vegetables.find(v => v.id === item.vegetableId)?.name || 'Unknown',
          pricePerKg: vegetables.find(v => v.id === item.vegetableId)?.pricePerKg || 0,
          quantity: item.quantityKg,
          subtotal: item.subtotal
        })),
        status: newBillData.status || 'pending',
        totalAmount: newBillData.total,
        userId: newBillData.customerId || newBillData.customerName || 'unknown',
        customerName: newBillData.customerName,
        customerId: newBillData.customerId
      };
      
      console.log('Placing order with data:', orderData);
      
      // Place order in database using the proper service
      const billNumber = await placeOrder(orderData);
      
      console.log('✅ Order placed successfully with bill number:', billNumber);
      console.log('🔥 Current bills count after order placed:', bills.length);
      
      // Return a minimal Bill object for the CreateBill component
      // The real-time subscription will handle updating the actual bills list
      const newBill: Bill = {
        ...newBillData,
        id: billNumber,
        date: new Date().toISOString(),
        status: 'pending'
      };
      
      console.log('🔥 Returning bill object:', newBill);
      return newBill;
      
    } catch (error) {
      console.error('❌ Error creating bill:', error);
      throw error;
    }
  }, [vegetables, selectedDate]);

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

