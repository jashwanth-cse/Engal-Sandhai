
import { useState, useCallback, useEffect } from 'react';
import { BILLS_DATA } from '../constants.ts';
import type { Vegetable, Bill } from '../types/types.ts';
import { doc, updateDoc, serverTimestamp, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../src/firebase';
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
  getDateKey,
  updateBill as updateBillInDb,
} from '../src/services/dbService.ts';

interface UseBillingDataProps {
  selectedDate?: Date | null;
  currentUser?: { id: string; name: string; role: string; email?: string; department?: string } | null;
}

export const useBillingData = (props: UseBillingDataProps = {}) => {
  const { selectedDate, currentUser } = props;
  const [vegetables, setVegetables] = useState<Vegetable[]>([]);
  const [bills, setBills] = useState<Bill[]>(BILLS_DATA);
  const [vegetablesLoaded, setVegetablesLoaded] = useState(false);
  const [availableStock, setAvailableStock] = useState<Map<string, number>>(new Map());
  const [stockLoaded, setStockLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If not authenticated, don't attach any Firestore listeners
    if (!currentUser) {
      setVegetables([]);
      setAvailableStock(new Map());
      setBills([]);
      setVegetablesLoaded(false);
      setStockLoaded(false);
      setLoading(false);
      return;
    }

    // Use date-based subscriptions for inventory when a date is selected
    const unsubscribeVeg = subscribeToVegetables((items) => {
      setVegetables(items);
      setVegetablesLoaded(true);
    }, selectedDate);

    // Subscribe to available stock for the selected date
    const unsubscribeAvailableStock = subscribeToAvailableStock((stockMap) => {
      setAvailableStock(stockMap);
      setStockLoaded(true);
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
  }, [selectedDate, currentUser]);

  // Derive overall loading from individual sources for first paint
  useEffect(() => {
    setLoading(!(vegetablesLoaded && stockLoaded));
  }, [vegetablesLoaded, stockLoaded]);

  // One-shot data fetcher to force immediate data availability (used after login)
  const refreshData = useCallback(async (): Promise<boolean> => {
    try {
      const targetDate = selectedDate || new Date();
      const dateKey = getDateKey(targetDate);
      setLoading(true);

      // Fetch vegetables
      const vegCol = collection(db, 'vegetables', dateKey, 'items');
      const vegSnap = await getDocs(query(vegCol, orderBy('name')));
      const vegItems: Vegetable[] = vegSnap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name,
          unitType: data.unitType || 'KG',
          pricePerKg: Number(data.pricePerKg) || 0,
          totalStockKg: Number(data.totalStockKg) || Number(data.stockKg) || 0,
          stockKg: Number(data.stockKg) || Number(data.availableStockKg) || 0,
          category: data.category,
        } as Vegetable;
      });

      // Fetch available stock
      const stockCol = collection(db, 'availableStock', dateKey, 'items');
      const stockSnap = await getDocs(stockCol);
      const stockMap = new Map<string, number>();
      stockSnap.docs.forEach((d) => {
        const data = d.data() as any;
        const qty = Number(data.availableStockKg ?? data.stockKg ?? 0) || 0;
        stockMap.set(d.id, qty);
      });

      // Apply state updates
      setVegetables(vegItems);
      setAvailableStock(stockMap);
      setVegetablesLoaded(true);
      setStockLoaded(true);
      setLoading(false);
      return true;
    } catch (error) {
      console.error('Error refreshing billing data:', error);
      setLoading(false);
      return false;
    }
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
        employee_id: currentUser?.id || 'unknown',
        items: newBillData.items.map(item => ({
          id: item.vegetableId,
          name: vegetables.find(v => v.id === item.vegetableId)?.name || 'Unknown',
          pricePerKg: vegetables.find(v => v.id === item.vegetableId)?.pricePerKg || 0,
          quantity: item.quantityKg,
          subtotal: item.subtotal
        })),
        status: newBillData.status || 'pending',
        totalAmount: newBillData.total,
        // For admin-created bills (Create Bill page), use the entered customer info
        // For regular user orders, use the current user's info
        userId: newBillData.customerId || currentUser?.id || 'unknown',
        customerName: newBillData.customerName || currentUser?.name || 'Unknown Customer',
        customerId: newBillData.customerId || currentUser?.id || 'unknown',
        // Add department info for regular users
        department: currentUser?.department || undefined
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

  const updateBill = useCallback(async (billId: string, updates: Partial<Bill>) => {
    try {
      console.log(`🔄 Updating bill ${billId} via hook:`, updates);
      
      // Find the bill to get its date for the correct collection path
      const targetBill = bills.find(bill => bill.id === billId);
      const targetDate = targetBill ? new Date(targetBill.date) : (selectedDate || new Date());
      
      // Use the updateBill function from dbService for consistency
      await updateBillInDb(billId, updates, targetDate);
      
      console.log(`✅ Bill ${billId} updated successfully via hook`);

      // Note: We don't update local state here because the real-time subscriptions 
      // will automatically update the bills state when the database changes
      
    } catch (error) {
      console.error('❌ Error updating bill in hook:', error);
      throw error;
    }
  }, [bills, selectedDate]);

  return {
    vegetables,
    vegetablesLoaded,
    availableStock,
    loading,
    addVegetable,
    updateVegetable,
    deleteVegetable,
    bills,
    addBill,
    updateBill,
    refreshData,
  };
};

