import { db } from '../firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  Timestamp,
  writeBatch,
  serverTimestamp,
  runTransaction,
  setDoc,
} from 'firebase/firestore';
import type { Vegetable } from '../../types/types';
import type { Bill, BillItem } from '../../types/types';

// Utility function to get date key (YYYY-MM-DD format)
export const getDateKey = (date?: Date): string => {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Date-based collections
const getVegetablesCol = (date?: Date) => collection(db, 'vegetables', getDateKey(date), 'items');
const getAvailableStockCol = (date?: Date) => collection(db, 'availableStock', getDateKey(date), 'items');

const vegetablesCol = collection(db, 'vegetables');

// Helper function to get date-based collection name
// Date-based collections for orders (matching inventory pattern)
export const getOrdersCol = (date?: Date) => collection(db, 'orders', getDateKey(date), 'items');

// Legacy function for backward compatibility
export const getOrdersCollectionName = (date?: Date): string => {
  const targetDate = date || new Date();
  const year = targetDate.getFullYear();
  const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
  const day = targetDate.getDate().toString().padStart(2, '0');
  return `orders-${year}-${month}-${day}`;
};

export const subscribeToVegetables = (
  onChange: (vegetables: Vegetable[]) => void,
  date?: Date
) => {
  // Use date-based collection for new items, fallback to regular collection for existing data
  const isDateBased = date !== undefined;
  const targetCol = isDateBased ? getVegetablesCol(date) : vegetablesCol;
  
  const q = query(targetCol, orderBy('name'));
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
  vegetable: Omit<Vegetable, 'id'>,
  date?: Date
): Promise<string> => {
  const dateKey = getDateKey(date);
  const vegetablesCol = getVegetablesCol(date);
  
  const docRef = await addDoc(vegetablesCol, {
    name: vegetable.name,
    unitType: vegetable.unitType,
    pricePerKg: vegetable.pricePerKg,
    totalStockKg: vegetable.totalStockKg,
    stockKg: vegetable.stockKg,
    category: vegetable.category,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    dateKey: dateKey, // Add date tracking
  });
  
  // Sync with date-based availableStock collection for real-time stock tracking
  try {
    const availableStockRef = doc(db, 'availableStock', dateKey, 'items', docRef.id);
    await setDoc(availableStockRef, {
      productId: docRef.id,
      productName: vegetable.name,
      category: vegetable.category,
      pricePerKg: vegetable.pricePerKg,
      totalStockKg: vegetable.totalStockKg,
      availableStockKg: vegetable.totalStockKg, // Initialize available = total
      unitType: vegetable.unitType || 'KG',
      lastUpdated: serverTimestamp(),
      updatedBy: 'system',
      dateKey: dateKey
    });
    console.log(`✅ Available stock entry created for: ${vegetable.name} on ${dateKey}`);
  } catch (error) {
    console.error('❌ Failed to create available stock entry:', error);
  }
  
  return docRef.id;
};

export const updateVegetableInDb = async (vegetable: Vegetable, date?: Date): Promise<void> => {
  const dateKey = getDateKey(date);
  const isDateBased = date !== undefined;
  
  // Update vegetables collection (date-based if date provided, regular otherwise)
  const ref = isDateBased 
    ? doc(db, 'vegetables', dateKey, 'items', vegetable.id)
    : doc(db, 'vegetables', vegetable.id);
    
  await updateDoc(ref, {
    name: vegetable.name,
    unitType: vegetable.unitType,
    pricePerKg: vegetable.pricePerKg,
    totalStockKg: vegetable.totalStockKg,
    stockKg: vegetable.stockKg,
    category: vegetable.category,
    updatedAt: serverTimestamp(),
    ...(isDateBased && { dateKey })
  });
  
  // Sync with availableStock collection
  try {
    const availableStockRef = isDateBased
      ? doc(db, 'availableStock', dateKey, 'items', vegetable.id)
      : doc(db, 'availableStock', vegetable.id);
      
    await updateDoc(availableStockRef, {
      productName: vegetable.name,
      category: vegetable.category,
      pricePerKg: vegetable.pricePerKg,
      totalStockKg: vegetable.totalStockKg,
      availableStockKg: vegetable.totalStockKg, // Reset available to total on update
      unitType: vegetable.unitType || 'KG',
      lastUpdated: serverTimestamp(),
      updatedBy: 'system',
      ...(isDateBased && { dateKey })
    });
    const target = isDateBased ? `${vegetable.name} on ${dateKey}` : vegetable.name;
    console.log('✅ Available stock updated for:', target);
  } catch (error) {
    console.error('❌ Failed to update available stock:', error);
  }
};

export const deleteVegetableFromDb = async (vegId: string, date?: Date): Promise<void> => {
  const dateKey = getDateKey(date);
  const isDateBased = date !== undefined;
  
  // Delete from vegetables collection (date-based if date provided, regular otherwise)
  const ref = isDateBased 
    ? doc(db, 'vegetables', dateKey, 'items', vegId)
    : doc(db, 'vegetables', vegId);
    
  await deleteDoc(ref);
  
  // Delete from availableStock collection
  try {
    const availableStockRef = isDateBased
      ? doc(db, 'availableStock', dateKey, 'items', vegId)
      : doc(db, 'availableStock', vegId);
      
    await deleteDoc(availableStockRef);
    const target = isDateBased ? `vegetable on ${dateKey}` : 'vegetable';
    console.log('✅ Available stock deleted for', target, ':', vegId);
  } catch (error) {
    console.error('❌ Failed to delete available stock:', error);
  }
};

// Function to reduce stock when items are ordered
export const reduceVegetableStock = async (vegetableId: string, quantityToReduce: number, date?: Date): Promise<void> => {
  const dateKey = getDateKey(date);
  const isDateBased = date !== undefined;
  
  try {
    // Get current vegetable data
    const ref = isDateBased 
      ? doc(db, 'vegetables', dateKey, 'items', vegetableId)
      : doc(db, 'vegetables', vegetableId);
      
    const docSnap = await getDoc(ref);
    if (!docSnap.exists()) {
      console.error(`Vegetable not found: ${vegetableId}`);
      return;
    }
    
    const currentVegetable = docSnap.data() as Vegetable;
    const newStockKg = Math.max(0, currentVegetable.stockKg - quantityToReduce);
    
    console.log(`Reducing stock for ${currentVegetable.name}: ${currentVegetable.stockKg} - ${quantityToReduce} = ${newStockKg}`);
    
    // Update vegetables collection
    await updateDoc(ref, {
      stockKg: newStockKg,
      updatedAt: serverTimestamp()
    });
    
    // Also update availableStock collection
    try {
      const availableStockRef = isDateBased
        ? doc(db, 'availableStock', dateKey, 'items', vegetableId)
        : doc(db, 'availableStock', vegetableId);
        
      await updateDoc(availableStockRef, {
        availableStockKg: newStockKg,
        lastUpdated: serverTimestamp(),
        updatedBy: 'order-system'
      });
      
      const target = isDateBased ? `${currentVegetable.name} on ${dateKey}` : currentVegetable.name;
      console.log('✅ Stock reduced successfully for:', target, `(${quantityToReduce} units)`);
    } catch (error) {
      console.error('❌ Failed to update available stock during reduction:', error);
    }
    
  } catch (error) {
    console.error('❌ Error reducing vegetable stock:', error);
    throw error;
  }
};

// Batch function to reduce stock for multiple items
export const batchReduceVegetableStock = async (
  items: Array<{ vegetableId: string; quantityToReduce: number }>,
  date?: Date
): Promise<void> => {
  console.log(`Starting batch stock reduction for ${items.length} items`);
  
  try {
    // Process all stock reductions
    const promises = items.map(item => 
      reduceVegetableStock(item.vegetableId, item.quantityToReduce, date)
    );
    
    await Promise.all(promises);
    console.log('✅ Batch stock reduction completed successfully');
  } catch (error) {
    console.error('❌ Error in batch stock reduction:', error);
    throw error;
  }
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

// Place order function that stores in date-based collection
export interface OrderData {
  bagCost: number;
  bagCount: number;
  cartSubtotal: number;
  employee_id: string;
  items: {
    id: string;
    name: string;
    pricePerKg: number;
    quantity: number;
    subtotal: number;
  }[];
  // Added new statuses: 'inprogress' and 'bill_sent'
  status: 'pending' | 'packed' | 'delivered' | 'inprogress' | 'bill_sent';
  totalAmount: number;
  userId: string;
  customerName?: string; // Add customer name
  customerId?: string;   // Add customer ID
  department?: string;   // Add department field
}

// Global order processing queue to prevent concurrent order placement
let orderProcessingQueue = Promise.resolve();
let isProcessingOrder = false;

// Function to get the current processing status
export const getOrderProcessingStatus = () => isProcessingOrder;

export const placeOrder = async (orderData: OrderData): Promise<string> => {
  console.log('Order placement requested, adding to queue...');
  
  // Add this order to the processing queue to prevent race conditions
  return new Promise((resolve, reject) => {
    orderProcessingQueue = orderProcessingQueue
      .then(async () => {
        try {
          isProcessingOrder = true;
          console.log('Starting order processing...');
          
          // Add a small delay to ensure sequential processing
          await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
          
          const result = await processOrderInternal(orderData);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          isProcessingOrder = false;
          console.log('Order processing completed');
        }
      })
      .catch((error) => {
        isProcessingOrder = false;
        reject(error);
      });
  });
};

// Internal order processing function
const processOrderInternal = async (orderData: OrderData): Promise<string> => {
  console.log('Processing order internally with data:', orderData);
  
  const today = new Date();
  const dateKey = getDateKey(today);
  const isLegacyDate = dateKey === '2025-09-24' || dateKey === '2025-09-25';
  
  // Use legacy collection for Sept 24-25, new subcollection format for others
  let ordersCollectionRef: any;
  let collectionName: string;
  
  if (isLegacyDate) {
    ordersCollectionRef = collection(db, 'orders');
    collectionName = 'orders (legacy)';
    console.log('Using legacy orders collection for:', dateKey);
  } else {
    ordersCollectionRef = getOrdersCol(today);
    collectionName = `orders/${dateKey}/items`;
    console.log('Using date-based subcollection:', collectionName);
  }
  
  console.log('Collection name:', collectionName);
  
  // Get current bill counter for today
  const day = today.getDate().toString().padStart(2, '0');
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const year = today.getFullYear();
  const counterKey = `${year}${month}${day}`;
  const counterRef = doc(db, 'bill_counters', counterKey);
  
  console.log('Getting bill counter...');
  
  // Get and increment counter with simple approach (since we're processing sequentially)
  let counter = 1;
  try {
    const counterDoc = await getDoc(counterRef);
    if (counterDoc.exists()) {
      counter = (counterDoc.data().counter || 0) + 1;
    }
    console.log('Generated counter:', counter);
  } catch (counterError) {
    console.error('Error getting counter, using default:', counterError);
  }
  
  const billNumber = `ES${day}${month}${year}-${counter.toString().padStart(3, '0')}`;
  console.log('Generated bill number:', billNumber);
  
  // Check if this bill number already exists (extra safety check)
  const orderDocRef = doc(ordersCollectionRef, billNumber);
  
  try {
    const existingOrder = await getDoc(orderDocRef);
    if (existingOrder.exists()) {
      console.error('Bill number already exists, this should not happen with sequential processing');
      throw new Error(`Order ${billNumber} already exists. Please try again.`);
    }
  } catch (checkError) {
    console.error('Error checking existing order:', checkError);
    throw new Error('Failed to verify order uniqueness. Please try again.');
  }
  
  // Prepare the new order with sanitized data (remove undefined values)
  const sanitizedOrderData = Object.fromEntries(
    Object.entries(orderData).filter(([key, value]) => value !== undefined)
  );
  
  const newOrder = {
    ...sanitizedOrderData,
    orderId: billNumber,
    billNumber: billNumber,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    dateKey: dateKey, // Add date tracking for new format
    // Ensure required fields are never undefined
    customerName: orderData.customerName || 'Unknown Customer',
    customerId: orderData.customerId || 'unknown',
    userId: orderData.userId || 'unknown'
  };
  
  console.log('Creating order and updating counter...');
  
  // Use batch to create order and update counter together
  const batch = writeBatch(db);
  
  try {
    // Add order document
    batch.set(orderDocRef, newOrder);
    
    // Update counter
    batch.set(counterRef, { 
      counter, 
      lastUpdated: serverTimestamp() 
    }, { merge: true });
    
    console.log('Committing order batch...');
    await batch.commit();
    console.log(`✅ Order created successfully: ${billNumber}`);
    
  } catch (batchError) {
    console.error('Error committing order batch:', batchError);
    throw new Error(`Failed to create order: ${batchError}`);
  }
  
  // Handle stock updates separately and asynchronously (don't block order completion)
  updateStockAsync(orderData, billNumber, today).catch(error => {
    console.error('Stock update failed (order still successful):', error);
  });
  
  console.log(`✅ Order placed successfully with bill number: ${billNumber} in collection: ${collectionName}`);
  return billNumber;
};

// Async stock update function (runs in background) - now supports date-based collections
const updateStockAsync = async (orderData: OrderData, billNumber: string, orderDate?: Date) => {
  try {
    console.log('Updating stock asynchronously for order:', billNumber);
    const stockBatch = writeBatch(db);
    let stockUpdateCount = 0;
    
    // Always use date-based collections since that's how vegetables are stored now
    const targetDate = orderDate || new Date();
    const dateKey = getDateKey(targetDate);
    
    for (const item of orderData.items) {
      console.log(`🔄 Processing stock for item: ${item.id} (${item.name}), quantity: ${item.quantity} on ${dateKey}`);
      
      try {
        // Update vegetables collection (always date-based now)
        const vegRef = doc(db, 'vegetables', dateKey, 'items', item.id);
        console.log(`📍 Looking for vegetable at path: vegetables/${dateKey}/items/${item.id}`);
        const vegDoc = await getDoc(vegRef);
        
        if (vegDoc.exists()) {
          const currentStock = vegDoc.data().stockKg || 0;
          const newStock = Math.max(0, currentStock - item.quantity);
          console.log(`✅ Updating vegetable ${item.id} stock: ${currentStock} -> ${newStock} on ${dateKey}`);
          
          stockBatch.update(vegRef, {
            stockKg: newStock,
            updatedAt: serverTimestamp()
          });
          stockUpdateCount++;
        } else {
          console.warn(`❌ Vegetable ${item.id} not found in date ${dateKey} - cannot update stock`);
        }
        
        // Update available stock (always date-based now)
        const availableStockRef = doc(db, 'availableStock', dateKey, 'items', item.id);
        console.log(`📍 Looking for available stock at path: availableStock/${dateKey}/items/${item.id}`);
        const availableStockDoc = await getDoc(availableStockRef);
        
        if (availableStockDoc.exists()) {
          const currentAvailableStock = availableStockDoc.data().availableStockKg || 0;
          const newAvailableStock = Math.max(0, currentAvailableStock - item.quantity);
          console.log(`✅ Updating available stock ${item.id}: ${currentAvailableStock} -> ${newAvailableStock} on ${dateKey}`);
          
          stockBatch.update(availableStockRef, { 
            availableStockKg: newAvailableStock,
            lastUpdated: serverTimestamp(),
            updatedBy: orderData.userId
          });
          stockUpdateCount++;
        } else {
          console.warn(`❌ Available stock not found for vegetable ${item.id} on ${dateKey}`);
        }
        
      } catch (itemError) {
        console.error(`Error processing stock for item ${item.id}:`, itemError);
      }
    }
    
    // Commit stock updates if we have any
    if (stockUpdateCount > 0) {
      console.log(`Committing ${stockUpdateCount} stock updates for order ${billNumber}...`);
      await stockBatch.commit();
      console.log(`✅ Stock updates completed for order ${billNumber}`);
    }
    
  } catch (stockError) {
    console.error(`Stock update failed for order ${billNumber}:`, stockError);
    // This doesn't affect the order which was already created successfully
  }
};


// Orders subscription for today's orders (uses legacy collection for Sept 24-25, date-based for others)
export const subscribeToTodayOrders = (
  onChange: (bills: Bill[]) => void
) => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Check if today is September 24th or 25th, 2025 - use legacy collection only
  const isLegacyDate = todayStr === '2025-09-24' || todayStr === '2025-09-25';
  
  if (isLegacyDate) {
    // Subscribe only to legacy orders collection for Sept 24-25
    const legacyOrdersCol = collection(db, 'orders');
    const legacyQuery = query(
      legacyOrdersCol, 
      where('createdAt', '>=', new Date(todayStr + 'T00:00:00')),
      where('createdAt', '<', new Date(todayStr + 'T23:59:59')),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(legacyQuery, (snapshot) => {
      const bills: Bill[] = snapshot.docs.map((docSnapshot) => {
        const orderData = docSnapshot.data();
        const createdAt = orderData.createdAt?.toDate ? orderData.createdAt.toDate() : (orderData.createdAt || new Date());
        
        console.log(`🔍 Processing legacy order (TODAY) ${docSnapshot.id}:`, {
          billNumber: orderData.billNumber,
          orderId: orderData.orderId,
          hasItems: Array.isArray(orderData.items),
          itemsLength: orderData.items?.length || 0,
          itemsSample: orderData.items?.[0] || null,
          allFields: Object.keys(orderData || {}).slice(0, 10)
        });
        
        const items: BillItem[] = Array.isArray(orderData.items)
          ? orderData.items.map((it: any, index: number) => {
              console.log(`  Today Item ${index + 1}:`, {
                originalItem: it,
                id: it.id || it.vegetableId,
                quantity: it.quantity || it.quantityKg,
                subtotal: it.subtotal
              });
              
              // Try multiple possible field combinations for legacy compatibility
              const vegetableId = it.id || it.vegetableId || it.product_id || it.productId || `unknown-${index}`;
              const quantityKg = Number(it.quantity || it.quantityKg || it.qty || it.weight || it.amount) || 0;
              const subtotal = Number(it.subtotal || it.total || it.price || it.cost) || 0;
              
              return {
                vegetableId,
                quantityKg,
                subtotal,
              };
            })
          : [];
        
        console.log(`📦 Legacy order (TODAY) ${docSnapshot.id} processed with ${items.length} items`);
        if (items.length === 0 && orderData.items) {
          console.warn(`⚠️ No items processed for order ${docSnapshot.id}, original items:`, orderData.items);
        }
        const bill: Bill = {
          id: String(orderData.billNumber || orderData.orderId || docSnapshot.id),
          date: new Date(createdAt).toISOString(),
          items,
          total: Number(orderData.totalAmount) || 0,
          customerName: String(orderData.customerName || orderData.userId || orderData.employee_id || 'Unknown'),
          department: orderData.department || undefined, // Add department from order data
          status: (orderData.status as Bill['status']) || 'pending',
          bags: Number(orderData.bagCount || orderData.bags || 0) || undefined,
        };
        (bill as any).customerId = String(orderData.customerId || orderData.userId || orderData.employee_id || '');
        return bill;
      });
      onChange(bills);
    }, (error) => {
      console.error('Error subscribing to legacy orders:', error);
      onChange([]);
    });
  }
  
  // For all other dates, use new date-based subcollection format
  const ordersCollectionRef = getOrdersCol(today);
  const q = query(ordersCollectionRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    console.log(`📦 Today's orders loaded from: orders/${getDateKey(today)}/items - Count: ${snapshot.size}`);
    const bills: Bill[] = snapshot.docs.map((docSnapshot) => {
      const orderData = docSnapshot.data();
      const createdAt = orderData.createdAt?.toDate ? orderData.createdAt.toDate() : (orderData.createdAt || new Date());
      const items: BillItem[] = Array.isArray(orderData.items)
        ? orderData.items.map((it: any) => {
            const billItem: any = {
              vegetableId: it.id,
              quantityKg: Number(it.quantity) || 0,
              subtotal: Number(it.subtotal) || 0,
            };
            // Preserve historical data for PDF generation
            if (it.name) billItem.name = it.name;
            if (it.pricePerKg) billItem.pricePerKg = Number(it.pricePerKg);
            return billItem;
          })
        : [];
      const bill: Bill = {
        id: String(orderData.billNumber || orderData.orderId || docSnapshot.id),
        date: new Date(createdAt).toISOString(),
        items,
        total: Number(orderData.totalAmount) || 0,
        customerName: String(orderData.customerName || orderData.userId || orderData.employee_id || 'Unknown'),
        department: orderData.department || undefined, // Add department from order data
        status: (orderData.status as Bill['status']) || 'pending',
        bags: Number(orderData.bagCount || orderData.bags || 0) || undefined,
      };
      (bill as any).customerId = String(orderData.customerId || orderData.userId || orderData.employee_id || '');
      return bill;
    });
    onChange(bills);
  }, (error) => {
    console.error('Error subscribing to date-based orders:', error);
    onChange([]);
  });
};

// Orders subscription for specific date
// Orders subscription for specific date (uses legacy collection for Sept 24-25, date-based for others)
export const subscribeToDateOrders = (
  date: Date,
  onChange: (bills: Bill[]) => void
) => {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Check if date is September 24th or 25th, 2025 - use legacy collection only
  const isLegacyDate = dateStr === '2025-09-24' || dateStr === '2025-09-25';
  
  if (isLegacyDate) {
    // Subscribe only to legacy orders collection for Sept 24-25
    const legacyOrdersCol = collection(db, 'orders');
    const legacyQuery = query(
      legacyOrdersCol, 
      where('createdAt', '>=', new Date(dateStr + 'T00:00:00')),
      where('createdAt', '<', new Date(dateStr + 'T23:59:59')),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(legacyQuery, (snapshot) => {
      const bills: Bill[] = snapshot.docs.map((docSnapshot) => {
        const orderData = docSnapshot.data();
        const createdAt = orderData.createdAt?.toDate ? orderData.createdAt.toDate() : (orderData.createdAt || new Date());
        
        console.log(`🔍 Processing legacy order (DATE) ${docSnapshot.id}:`, {
          billNumber: orderData.billNumber,
          orderId: orderData.orderId,
          hasItems: Array.isArray(orderData.items),
          itemsLength: orderData.items?.length || 0,
          itemsSample: orderData.items?.[0] || null,
          allFields: Object.keys(orderData || {}).slice(0, 10)
        });
        
        const items: BillItem[] = Array.isArray(orderData.items)
          ? orderData.items.map((it: any, index: number) => {
              console.log(`  Date Item ${index + 1}:`, {
                originalItem: it,
                id: it.id || it.vegetableId,
                quantity: it.quantity || it.quantityKg,
                subtotal: it.subtotal
              });
              
              // Try multiple possible field combinations for legacy compatibility
              const vegetableId = it.id || it.vegetableId || it.product_id || it.productId || `unknown-${index}`;
              const quantityKg = Number(it.quantity || it.quantityKg || it.qty || it.weight || it.amount) || 0;
              const subtotal = Number(it.subtotal || it.total || it.price || it.cost) || 0;
              
              return {
                vegetableId,
                quantityKg,
                subtotal,
              };
            })
          : [];
        
        console.log(`📦 Legacy order (DATE) ${docSnapshot.id} processed with ${items.length} items`);
        if (items.length === 0 && orderData.items) {
          console.warn(`⚠️ No items processed for order ${docSnapshot.id}, original items:`, orderData.items);
        }
        const bill: Bill = {
          id: String(orderData.billNumber || orderData.orderId || docSnapshot.id),
          date: new Date(createdAt).toISOString(),
          items,
          total: Number(orderData.totalAmount) || 0,
          customerName: String(orderData.customerName || orderData.userId || orderData.employee_id || 'Unknown'),
          department: orderData.department || undefined, // Add department from order data
          status: (orderData.status as Bill['status']) || 'pending',
          bags: Number(orderData.bagCount || orderData.bags || 0) || undefined,
        };
        (bill as any).customerId = String(orderData.customerId || orderData.userId || orderData.employee_id || '');
        return bill;
      });
      onChange(bills);
    }, (error) => {
      console.error('Error subscribing to legacy orders:', error);
      onChange([]);
    });
  }
  
  // For all other dates, use new date-based subcollection format
  const ordersCollectionRef = getOrdersCol(date);
  const q = query(ordersCollectionRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    console.log(`📦 Date orders loaded from: orders/${getDateKey(date)}/items - Count: ${snapshot.size}`);
    const bills: Bill[] = snapshot.docs.map((docSnapshot) => {
      const orderData = docSnapshot.data();
      const createdAt = orderData.createdAt?.toDate ? orderData.createdAt.toDate() : (orderData.createdAt || new Date());
      const items: BillItem[] = Array.isArray(orderData.items)
        ? orderData.items.map((it: any) => {
            const billItem: any = {
              vegetableId: it.id,
              quantityKg: Number(it.quantity) || 0,
              subtotal: Number(it.subtotal) || 0,
            };
            // Preserve historical data for PDF generation
            if (it.name) billItem.name = it.name;
            if (it.pricePerKg) billItem.pricePerKg = Number(it.pricePerKg);
            return billItem;
          })
        : [];
      const bill: Bill = {
        id: String(orderData.billNumber || orderData.orderId || docSnapshot.id),
        date: new Date(createdAt).toISOString(),
        items,
        total: Number(orderData.totalAmount) || 0,
        customerName: String(orderData.customerName || orderData.userId || orderData.employee_id || 'Unknown'),
        department: orderData.department || undefined, // Add department from order data
        status: (orderData.status as Bill['status']) || 'pending',
        bags: Number(orderData.bagCount || orderData.bags || 0) || undefined,
      };
      (bill as any).customerId = String(orderData.customerId || orderData.userId || orderData.employee_id || '');
      return bill;
    });
    onChange(bills);
  }, (error) => {
    console.error('Error subscribing to date-based orders:', error);
    onChange([]);
  });
};

// Legacy function - keep for backward compatibility, but now uses today's collection
export const subscribeToOrders = (
  onChange: (bills: Bill[]) => void
) => {
  return subscribeToTodayOrders(onChange);
};

/**
 * Searches for an order across multiple date-based collections by orderId
 * This is needed for bill status updates since we don't know which date collection the order is in
 * Special handling: Sept 24-25 orders are in legacy 'orders' collection, others in date-based collections
 */
export async function findOrderByOrderId(orderId: string): Promise<{ docId: string; collectionName: string; data: any } | null> {
  // First, try searching in the legacy orders collection (for Sept 24-25 and any other legacy orders)
  try {
    const legacyOrderRef = doc(db, 'orders', orderId);
    const legacyDoc = await getDoc(legacyOrderRef);
    if (legacyDoc.exists()) {
      return {
        docId: orderId,
        collectionName: 'orders',
        data: legacyDoc.data()
      };
    }
  } catch (error) {
    console.log(`Order ${orderId} not found in legacy orders collection`);
  }
  
  // Then try searching in date-based collections from the last 30 days (excluding Sept 24-25)
  const searchDays = 30;
  const today = new Date();
  
  for (let i = 0; i < searchDays; i++) {
    const searchDate = new Date(today);
    searchDate.setDate(today.getDate() - i);
    const searchDateStr = searchDate.toISOString().split('T')[0];
    
    // Skip Sept 24-25 as they are in legacy collection
    if (searchDateStr === '2025-09-24' || searchDateStr === '2025-09-25') {
      continue;
    }
    
    const collectionName = getOrdersCollectionName(searchDate);
    const orderDocRef = doc(db, collectionName, orderId);
    
    try {
      const docSnap = await getDoc(orderDocRef);
      if (docSnap.exists()) {
        return {
          docId: orderId,
          collectionName,
          data: docSnap.data()
        };
      }
    } catch (error) {
      // Document might not exist for this date, continue searching
      console.log(`Document ${orderId} in ${collectionName} not found, continuing search...`);
    }
  }
  
  return null;
}

/**
 * Updates order status by orderId across date-based collections AND legacy orders collection
 * Now works with individual order documents within date-based collections and legacy orders
 */
export async function updateOrderStatus(
  orderId: string, 
  status: 'pending' | 'packed' | 'delivered' | 'inprogress' | 'bill_sent',
  employeeId: string,
  targetDateOverride?: Date | null // Optional date override for UI date selection
): Promise<boolean> {
  try {
    const dateOverrideInfo = targetDateOverride ? ` (using selected date: ${getDateKey(targetDateOverride)})` : '';
    console.log(`Updating order status: ${orderId} to ${status} by ${employeeId}${dateOverrideInfo}`);
    
    let targetDate: Date | null = targetDateOverride || null;
    
    // If no date override provided, extract date from orderId (ES28092025-001)
    if (!targetDate && orderId.startsWith('ES')) {
      const dateMatch = orderId.match(/ES(\d{2})(\d{2})(\d{4})-\d{3}/);
      if (dateMatch) {
        const [, day, month, year] = dateMatch;
        targetDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
    }
    
    // If no date extracted, use current date as fallback
    if (!targetDate) {
      targetDate = new Date();
    }
    
    const dateKey = getDateKey(targetDate);
    const isLegacyDate = dateKey === '2025-09-24' || dateKey === '2025-09-25';
    
    let orderDocRef: any;
    let collectionInfo: string;
    
    if (isLegacyDate) {
      // Update in legacy orders collection
      orderDocRef = doc(db, 'orders', orderId);
      collectionInfo = 'orders (legacy)';
    } else {
      // Update in date-based subcollection
      orderDocRef = doc(db, 'orders', dateKey, 'items', orderId);
      collectionInfo = `orders/${dateKey}/items`;
    }
    
    console.log(`Looking for order in: ${collectionInfo}`);
    
    // Check if order exists
    const orderDoc = await getDoc(orderDocRef);
    if (!orderDoc.exists()) {
      console.warn(`❌ Order not found: ${orderId} in ${collectionInfo}`);
      
      // For debugging: try to find the order in other places
      if (isLegacyDate) {
        console.log(`🔍 Searching for legacy order ${orderId} across all possible locations...`);
        
        // Try searching by billNumber field instead of document ID
        console.log(`🔍 Searching legacy orders by billNumber field...`);
        const legacyOrdersCol = collection(db, 'orders');
        const billNumberQuery = query(legacyOrdersCol, where('billNumber', '==', orderId));
        const billNumberSnapshot = await getDocs(billNumberQuery);
        
        if (!billNumberSnapshot.empty) {
          console.log(`✅ Found order by billNumber: ${orderId}`);
          const foundDoc = billNumberSnapshot.docs[0];
          console.log(`Document ID: ${foundDoc.id}, billNumber: ${(foundDoc.data() as any)?.billNumber}`);
          
          // Update the orderDocRef to use the correct document ID
          orderDocRef = doc(db, 'orders', foundDoc.id);
          console.log(`Updated orderDocRef to use document ID: ${foundDoc.id}`);
        } else {
          // Also try searching by orderId field
          console.log(`🔍 Searching legacy orders by orderId field...`);
          const orderIdQuery = query(legacyOrdersCol, where('orderId', '==', orderId));
          const orderIdSnapshot = await getDocs(orderIdQuery);
          
          if (!orderIdSnapshot.empty) {
            console.log(`✅ Found order by orderId: ${orderId}`);
            const foundDoc = orderIdSnapshot.docs[0];
            console.log(`Document ID: ${foundDoc.id}, orderId: ${(foundDoc.data() as any)?.orderId}`);
            
            // Update the orderDocRef to use the correct document ID
            orderDocRef = doc(db, 'orders', foundDoc.id);
            console.log(`Updated orderDocRef to use document ID: ${foundDoc.id}`);
          } else {
            console.log(`❌ Order ${orderId} not found anywhere in legacy collection`);
            return false;
          }
        }
        
        // Try to get the document again with the updated reference
        const retryOrderDoc = await getDoc(orderDocRef);
        if (!retryOrderDoc.exists()) {
          console.log(`❌ Still can't find order after document ID correction`);
          return false;
        }
        console.log(`✅ Found order after document ID correction`);
      } else {
        return false;
      }
    }

    // Get the existing order data to understand its structure
    const existingData = orderDoc.data();
    const currentStatus = (existingData as any)?.status || 'unknown';
    console.log(`Found order ${orderId} in ${collectionInfo}, current status: ${currentStatus}`);

    // Update the order status (different structure for legacy vs new orders)
    if (isLegacyDate) {
      // Legacy orders: simpler update structure
      console.log(`Updating legacy order ${orderId} with simplified structure`);
      try {
        await updateDoc(orderDocRef, {
          status,
          updatedAt: serverTimestamp(),
          employeeId, // Add employeeId directly for legacy orders
        });
        console.log(`✅ Successfully updated legacy order ${orderId} status to ${status}`);
      } catch (updateError) {
        console.error(`❌ Failed to update legacy order ${orderId}:`, updateError);
        console.log(`Trying alternative update structure for legacy order...`);
        
        // Try alternative update - maybe legacy orders have different field names
        try {
          await updateDoc(orderDocRef, {
            status,
            updatedAt: serverTimestamp(),
          });
          console.log(`✅ Successfully updated legacy order ${orderId} with minimal structure`);
        } catch (altUpdateError) {
          console.error(`❌ Alternative update also failed for ${orderId}:`, altUpdateError);
          throw altUpdateError;
        }
      }
    } else {
      // New date-based orders: more complex structure
      console.log(`Updating date-based order ${orderId} with full bill structure`);
      try {
        await updateDoc(orderDocRef, {
          status,
          updatedAt: serverTimestamp(),
          bill: {
            billId: orderId,
            employeeId,
            status,
            updatedAt: serverTimestamp(),
          }
        });
        console.log(`✅ Successfully updated date-based order ${orderId} status to ${status}`);
      } catch (updateError) {
        console.error(`❌ Failed to update date-based order ${orderId}:`, updateError);
        throw updateError;
      }
    }
    
    console.log(`✅ Updated order ${orderId} status to ${status} in ${collectionInfo}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Failed to update order status for ${orderId}:`, error);
    return false;
  }
}

// Debug function to inspect legacy orders structure
export const debugLegacyOrders = async (): Promise<void> => {
  try {
    console.log('🔍 Inspecting legacy orders collection...');
    const legacyOrdersCol = collection(db, 'orders');
    const legacyQuery = query(legacyOrdersCol, limit(5)); // Get first 5 orders
    const snapshot = await getDocs(legacyQuery);
    
    if (snapshot.empty) {
      console.log('❌ No documents found in legacy orders collection');
    } else {
      console.log(`✅ Found ${snapshot.docs.length} documents in legacy orders collection:`);
      snapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`Order ${index + 1}:`, {
          documentId: doc.id,
          status: (data as any)?.status,
          billNumber: (data as any)?.billNumber,
          orderId: (data as any)?.orderId,
          itemsType: typeof (data as any)?.items,
          itemsIsArray: Array.isArray((data as any)?.items),
          itemsLength: (data as any)?.items?.length || 0,
          sampleItem: (data as any)?.items?.[0] || null,
          availableFields: Object.keys(data || {}).slice(0, 15) // Show first 15 fields
        });
      });
    }
  } catch (error) {
    console.error('❌ Error inspecting legacy orders:', error);
  }
};

// Function to fetch individual vegetable data by ID across all date collections
export const getVegetableById = async (vegetableId: string): Promise<Vegetable | null> => {
  try {
    console.log(`🔍 Searching for vegetable: ${vegetableId}`);
    
    // First, try legacy vegetables collection (for Sept 24-25 and other legacy data)
    try {
      const legacyVegRef = doc(db, 'vegetables', vegetableId);
      const legacyVegDoc = await getDoc(legacyVegRef);
      if (legacyVegDoc.exists()) {
        const data = legacyVegDoc.data();
        console.log(`✅ Found vegetable ${vegetableId} in legacy collection`);
        return {
          id: legacyVegDoc.id,
          name: data.name || 'Unknown',
          unitType: (data.unitType as 'KG' | 'COUNT') || 'KG',
          pricePerKg: Number(data.pricePerKg || data.price) || 0,
          totalStockKg: Number(data.totalStockKg || data.stock || data.totalStock) || 0,
          stockKg: Number(data.stockKg || data.availableStock) || 0,
          category: data.category || 'Other',
        };
      }
    } catch (error) {
      console.log(`Vegetable ${vegetableId} not found in legacy collection`);
    }
    
    // Search in date-based collections (last 60 days)
    const searchDays = 60;
    const today = new Date();
    
    for (let i = 0; i < searchDays; i++) {
      const searchDate = new Date(today);
      searchDate.setDate(today.getDate() - i);
      const dateKey = getDateKey(searchDate);
      
      try {
        const dateBasedVegRef = doc(db, 'vegetables', dateKey, 'items', vegetableId);
        const dateBasedVegDoc = await getDoc(dateBasedVegRef);
        
        if (dateBasedVegDoc.exists()) {
          const data = dateBasedVegDoc.data();
          console.log(`✅ Found vegetable ${vegetableId} in date collection: ${dateKey}`);
          return {
            id: dateBasedVegDoc.id,
            name: data.name || 'Unknown',
            unitType: (data.unitType as 'KG' | 'COUNT') || 'KG',
            pricePerKg: Number(data.pricePerKg || data.price) || 0,
            totalStockKg: Number(data.totalStockKg || data.stock || data.totalStock) || 0,
            stockKg: Number(data.stockKg || data.availableStock) || 0,
            category: data.category || 'Other',
          };
        }
      } catch (error) {
        // Continue searching other dates
        continue;
      }
    }
    
    console.log(`❌ Vegetable ${vegetableId} not found in any collection`);
    return null;
  } catch (error) {
    console.error(`Error searching for vegetable ${vegetableId}:`, error);
    return null;
  }
};

// Available Stock subscription
export const subscribeToAvailableStock = (
  onChange: (availableStock: Map<string, number>) => void,
  date?: Date
) => {
  // Use date-based collection for new items, fallback to regular collection for existing data
  const isDateBased = date !== undefined;
  const availableStockCol = isDateBased 
    ? getAvailableStockCol(date)
    : collection(db, 'availableStock');
  
  const q = query(availableStockCol, orderBy('lastUpdated', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const availableStockMap = new Map<string, number>();
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      availableStockMap.set(data.productId, data.availableStockKg || 0);
    });
    onChange(availableStockMap);
  }, (error) => {
    const dateInfo = isDateBased ? ` for ${getDateKey(date)}` : '';
    console.error(`Error subscribing to available stock${dateInfo}:`, error);
    onChange(new Map());
  });
};

// Batch update multiple order statuses
export const updateMultipleOrderStatuses = async (
  updates: Array<{ billNumber: string; status: 'pending' | 'packed' | 'delivered' | 'inprogress' | 'bill_sent'; employeeId: string }>,
  targetDateOverride?: Date | null // Optional date override for UI date selection
): Promise<void> => {
  try {
    console.log(`Batch updating ${updates.length} order statuses...`);
    
    const batch = writeBatch(db);
    
    for (const update of updates) {
      const { billNumber, status, employeeId } = update;
      
      let targetDate: Date | null = targetDateOverride || null;
      
      // If no date override provided, extract date from billNumber
      if (!targetDate && billNumber.startsWith('ES')) {
        const dateMatch = billNumber.match(/ES(\d{2})(\d{2})(\d{4})-\d{3}/);
        if (dateMatch) {
          const [, day, month, year] = dateMatch;
          targetDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
      }
      if (!targetDate) targetDate = new Date();
      
      const dateKey = getDateKey(targetDate);
      const isLegacyDate = dateKey === '2025-09-24' || dateKey === '2025-09-25';
      
      // Get order document reference
      const orderDocRef = isLegacyDate
        ? doc(db, 'orders', billNumber)
        : doc(db, 'orders', dateKey, 'items', billNumber);
      
      // Add to batch (different structure for legacy vs new orders)
      if (isLegacyDate) {
        // Legacy orders: simpler update structure
        console.log(`Batch updating legacy order ${billNumber} with simplified structure`);
        batch.update(orderDocRef, {
          status: status,
          updatedAt: serverTimestamp(),
          employeeId, // Add employeeId directly for legacy orders
        });
      } else {
        // New date-based orders: more complex structure
        console.log(`Batch updating date-based order ${billNumber} with full bill structure`);
        batch.update(orderDocRef, {
          status: status,
          updatedAt: serverTimestamp(),
          bill: {
            billId: billNumber,
            employeeId,
            status,
            updatedAt: serverTimestamp(),
          }
        });
      }
    }
    
    // Commit batch update
    await batch.commit();
    console.log(`✅ Successfully updated ${updates.length} order statuses`);
    
  } catch (error) {
    console.error(`❌ Failed to batch update order statuses:`, error);
    throw error;
  }
};

/**
 * Fetch bills for a date range (e.g., weekly report)
 * This is more efficient than multiple subscriptions
 */
export const fetchBillsForDateRange = async (
  startDate: Date,
  endDate: Date
): Promise<Bill[]> => {
  const allBills: Bill[] = [];
  
  // Generate all dates in the range
  const dates: Date[] = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Fetch bills for each date
  for (const date of dates) {
    const dateStr = date.toISOString().split('T')[0];
    const isLegacyDate = dateStr === '2025-09-24' || dateStr === '2025-09-25';
    
    try {
      if (isLegacyDate) {
        // Fetch from legacy collection for Sept 24-25
        const legacyOrdersCol = collection(db, 'orders');
        const legacyQuery = query(
          legacyOrdersCol,
          where('createdAt', '>=', new Date(dateStr + 'T00:00:00')),
          where('createdAt', '<', new Date(dateStr + 'T23:59:59')),
          orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(legacyQuery);
        const dayBills = snapshot.docs.map((docSnapshot) => {
          const orderData = docSnapshot.data();
          const createdAt = orderData.createdAt?.toDate ? orderData.createdAt.toDate() : (orderData.createdAt || new Date());
          const items = Array.isArray(orderData.items)
            ? orderData.items.map((it: any) => ({
                vegetableId: it.id,
                quantityKg: Number(it.quantity) || 0,
                subtotal: Number(it.subtotal) || 0,
              }))
            : [];
          
          const bill: Bill = {
            id: String(orderData.billNumber || orderData.orderId || docSnapshot.id),
            date: new Date(createdAt).toISOString(),
            items,
            total: Number(orderData.totalAmount) || 0,
            customerName: String(orderData.userId || orderData.employee_id || 'Unknown'),
            department: orderData.department || undefined, // Add department from order data
            status: (orderData.status as Bill['status']) || 'pending',
            bags: Number(orderData.bagCount || orderData.bags || 0) || undefined,
          };
          (bill as any).customerId = String(orderData.userId || orderData.employee_id || '');
          return bill;
        });
        
        allBills.push(...dayBills);
      } else {
        // Fetch from date-based collection
        const ordersCollectionRef = getOrdersCol(date);
        const q = query(ordersCollectionRef, orderBy('createdAt', 'desc'));
        
        const snapshot = await getDocs(q);
        const dayBills = snapshot.docs.map((docSnapshot) => {
          const orderData = docSnapshot.data();
          const createdAt = orderData.createdAt?.toDate ? orderData.createdAt.toDate() : (orderData.createdAt || new Date());
          const items = Array.isArray(orderData.items)
            ? orderData.items.map((it: any) => ({
                vegetableId: it.id,
                quantityKg: Number(it.quantity) || 0,
                subtotal: Number(it.subtotal) || 0,
              }))
            : [];
          
          const bill: Bill = {
            id: String(orderData.billNumber || orderData.orderId || docSnapshot.id),
            date: new Date(createdAt).toISOString(),
            items,
            total: Number(orderData.totalAmount) || 0,
            customerName: String(orderData.userId || orderData.employee_id || 'Unknown'),
            status: (orderData.status as Bill['status']) || 'pending',
            bags: Number(orderData.bagCount || orderData.bags || 0) || undefined,
            department: String(orderData.department || ''),
          };
          (bill as any).customerId = String(orderData.userId || orderData.employee_id || '');
          return bill;
        });
        
        allBills.push(...dayBills);
      }
    } catch (error) {
      console.warn(`Failed to fetch bills for date ${dateStr}:`, error);
      // Continue with other dates even if one fails
    }
  }
  
  // Sort all bills by date descending
  return allBills.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

/**
 * Fetch vegetables for a specific date
 * This is useful for getting historical stock information
 */
export const fetchVegetablesForDate = async (date?: Date): Promise<Vegetable[]> => {
  try {
    const isDateBased = date !== undefined;
    const targetCol = isDateBased ? getVegetablesCol(date) : vegetablesCol;
    
    const q = query(targetCol, orderBy('name'));
    const snapshot = await getDocs(q);
    
    const items: Vegetable[] = snapshot.docs.map((d) => {
      const data = d.data() as Omit<Vegetable, 'id'>;
      return {
        id: d.id,
        name: data.name,
        unitType: data.unitType || 'KG',
        pricePerKg: Number(data.pricePerKg) || 0,
        totalStockKg: Number(data.totalStockKg) || Number(data.stockKg) || 0,
        stockKg: Number(data.stockKg) || 0,
        category: data.category,
      };
    });
    
    console.log(`Fetched ${items.length} vegetables for date ${date ? getDateKey(date) : 'current'}`);
    return items;
  } catch (error) {
    console.error('Error fetching vegetables for date:', error);
    return [];
  }
};

/**
 * Update bill/order with new data (items, total, etc.)
 * Handles both legacy and date-based collections
 */
export const updateBill = async (
  billId: string, 
  updates: Partial<Bill>,
  targetDate?: Date
): Promise<void> => {
  try {
    console.log(`🔄 Updating bill ${billId} with updates:`, updates);
    
    let targetBillDate: Date;
    
    // If target date provided, use it; otherwise extract from billId or use current date
    if (targetDate) {
      targetBillDate = targetDate;
    } else if (billId.startsWith('ES')) {
      // Extract date from bill number format: ES28092025-001
      const dateMatch = billId.match(/ES(\d{2})(\d{2})(\d{4})-\d{3}/);
      if (dateMatch) {
        const [, day, month, year] = dateMatch;
        targetBillDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        targetBillDate = new Date();
      }
    } else {
      targetBillDate = new Date();
    }
    
    const dateKey = getDateKey(targetBillDate);
    const isLegacyDate = dateKey === '2025-09-24' || dateKey === '2025-09-25';
    
    let billDocRef: any;
    let collectionInfo: string;
    
    if (isLegacyDate) {
      // Update in legacy orders collection
      billDocRef = doc(db, 'orders', billId);
      collectionInfo = 'orders (legacy)';
    } else {
      // Update in date-based subcollection
      billDocRef = doc(db, 'orders', dateKey, 'items', billId);
      collectionInfo = `orders/${dateKey}/items`;
    }
    
    console.log(`📍 Updating bill in: ${collectionInfo}`);
    
    // Check if bill exists
    const billDoc = await getDoc(billDocRef);
    if (!billDoc.exists()) {
      console.warn(`❌ Bill not found: ${billId} in ${collectionInfo}`);
      
      // For legacy bills, try to find by billNumber or orderId field
      if (isLegacyDate) {
        console.log(`🔍 Searching for legacy bill ${billId} by billNumber field...`);
        const legacyOrdersCol = collection(db, 'orders');
        const billNumberQuery = query(legacyOrdersCol, where('billNumber', '==', billId));
        const billNumberSnapshot = await getDocs(billNumberQuery);
        
        if (!billNumberSnapshot.empty) {
          console.log(`✅ Found bill by billNumber: ${billId}`);
          const foundDoc = billNumberSnapshot.docs[0];
          billDocRef = doc(db, 'orders', foundDoc.id);
          console.log(`Updated billDocRef to use document ID: ${foundDoc.id}`);
        } else {
          // Also try searching by orderId field
          console.log(`🔍 Searching legacy bills by orderId field...`);
          const orderIdQuery = query(legacyOrdersCol, where('orderId', '==', billId));
          const orderIdSnapshot = await getDocs(orderIdQuery);
          
          if (!orderIdSnapshot.empty) {
            console.log(`✅ Found bill by orderId: ${billId}`);
            const foundDoc = orderIdSnapshot.docs[0];
            billDocRef = doc(db, 'orders', foundDoc.id);
            console.log(`Updated billDocRef to use document ID: ${foundDoc.id}`);
          } else {
            throw new Error(`Bill ${billId} not found in ${collectionInfo}`);
          }
        }
      } else {
        throw new Error(`Bill ${billId} not found in ${collectionInfo}`);
      }
    }
    
    // Prepare update data based on collection type
    const updateData: any = {
      updatedAt: serverTimestamp()
    };
    
    // Map Bill updates to database fields
    if (updates.items !== undefined) {
      // Convert BillItem[] back to order items format
      updateData.items = updates.items.map(item => ({
        id: item.vegetableId,
        quantity: item.quantityKg,
        subtotal: item.subtotal,
        // Preserve additional data if available
        ...(item.name && { name: item.name }),
        ...(item.pricePerKg && { pricePerKg: item.pricePerKg })
      }));
    }
    
    if (updates.total !== undefined) {
      updateData.totalAmount = updates.total;
    }
    
    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }
    
    if (updates.bags !== undefined) {
      updateData.bagCount = updates.bags;
      updateData.bags = updates.bags;
    }
    
    if (updates.customerName !== undefined) {
      updateData.customerName = updates.customerName;
    }
    
    if (updates.department !== undefined) {
      updateData.department = updates.department;
    }
    
    // Perform the update
    await updateDoc(billDocRef, updateData);
    
    console.log(`✅ Successfully updated bill ${billId} in ${collectionInfo}`);
    
  } catch (error) {
    console.error(`❌ Failed to update bill ${billId}:`, error);
    throw error;
  }
};

/**
 * Fetches orders for a specific user/customer on a specific date
 * @param customerId - The unique ID of the customer
 * @param date - The date to fetch orders for (Date object)
 * @returns Promise with array of Bill objects
 */
export const fetchUserOrdersByDate = async (customerId: string, date: Date): Promise<Bill[]> => {
  if (!customerId) {
    console.error('❌ fetchUserOrdersByDate: customerId is required');
    return [];
  }

  console.log(`🔍 Fetching orders for customer: ${customerId} on ${date.toDateString()}`);
  const allOrders: Bill[] = [];
  const vegetableCache = new Map<string, Vegetable>();

  try {
    const dateKey = getDateKey(date);
    console.log(`📅 Searching orders for date: ${dateKey}`);

    // Search in date-based collection for the specific date
    try {
      const ordersCol = collection(db, 'orders', dateKey, 'items');
      const ordersQuery = query(
        ordersCol,
        where('customerId', '==', customerId)
      );
      const orderDocs = await getDocs(ordersQuery);

      // If no results with customerId, try userId (legacy field name)
      if (orderDocs.empty) {
        const userIdQuery = query(
          ordersCol,
          where('userId', '==', customerId)
        );
        const userIdDocs = await getDocs(userIdQuery);
        
        userIdDocs.forEach((doc) => {
          const data = doc.data();
          const bill: Bill = {
            id: doc.id,
            date: data.createdAt?.toDate?.()?.toISOString() || data.date || new Date().toISOString(),
            customerName: data.customerName || '',
            customerId: data.customerId || data.userId || customerId,
            items: (data.items || []).map((item: any) => ({
              vegetableId: item.id || item.vegetableId || '',
              quantityKg: item.quantity || item.quantityKg || 0,
              pricePerKg: item.pricePerKg || 0,
              subtotal: item.subtotal || 0,
              name: item.name || '',
            })),
            total: data.totalAmount || data.total || 0,
            status: data.status || 'pending',
            bags: data.bagCount || data.bags || 0,
            department: data.department,
          };
          allOrders.push(bill);
        });
      } else {
        orderDocs.forEach((doc) => {
          const data = doc.data();
          const bill: Bill = {
            id: doc.id,
            date: data.createdAt?.toDate?.()?.toISOString() || data.date || new Date().toISOString(),
            customerName: data.customerName || '',
            customerId: data.customerId || data.userId || customerId,
            items: (data.items || []).map((item: any) => ({
              vegetableId: item.id || item.vegetableId || '',
              quantityKg: item.quantity || item.quantityKg || 0,
              pricePerKg: item.pricePerKg || 0,
              subtotal: item.subtotal || 0,
              name: item.name || '',
            })),
            total: data.totalAmount || data.total || 0,
            status: data.status || 'pending',
            bags: data.bagCount || data.bags || 0,
            department: data.department,
          };
          allOrders.push(bill);
        });
      }
    } catch (error: any) {
      console.log(`⚠️ No date-based orders found for ${dateKey}:`, error.message);
    }

    // Also check legacy 'orders' collection for the same date
    try {
      const legacyOrdersCol = collection(db, 'orders');
      const legacyQuery = query(
        legacyOrdersCol,
        where('customerId', '==', customerId)
      );
      const legacyDocs = await getDocs(legacyQuery);

      // Filter by date and try userId if needed
      legacyDocs.forEach((doc) => {
        const data = doc.data();
        const orderDate = data.createdAt?.toDate?.() || (data.date ? new Date(data.date) : null);
        
        // Only include orders from the selected date
        if (orderDate && getDateKey(orderDate) === dateKey) {
          const bill: Bill = {
            id: doc.id,
            date: data.createdAt?.toDate?.()?.toISOString() || data.date || new Date().toISOString(),
            customerName: data.customerName || '',
            customerId: data.customerId || data.userId || customerId,
            items: (data.items || []).map((item: any) => ({
              vegetableId: item.id || item.vegetableId || '',
              quantityKg: item.quantity || item.quantityKg || 0,
              pricePerKg: item.pricePerKg || 0,
              subtotal: item.subtotal || 0,
              name: item.name || '',
            })),
            total: data.totalAmount || data.total || 0,
            status: data.status || 'pending',
            bags: data.bagCount || data.bags || 0,
            department: data.department,
          };
          allOrders.push(bill);
        }
      });

      // Try userId if no results
      if (legacyDocs.empty) {
        const userIdQuery = query(
          legacyOrdersCol,
          where('userId', '==', customerId)
        );
        const userIdDocs = await getDocs(userIdQuery);
        
        userIdDocs.forEach((doc) => {
          const data = doc.data();
          const orderDate = data.createdAt?.toDate?.() || (data.date ? new Date(data.date) : null);
          
          // Only include orders from the selected date
          if (orderDate && getDateKey(orderDate) === dateKey) {
            const bill: Bill = {
              id: doc.id,
              date: data.createdAt?.toDate?.()?.toISOString() || data.date || new Date().toISOString(),
              customerName: data.customerName || '',
              customerId: data.customerId || data.userId || customerId,
              items: (data.items || []).map((item: any) => ({
                vegetableId: item.id || item.vegetableId || '',
                quantityKg: item.quantity || item.quantityKg || 0,
                pricePerKg: item.pricePerKg || 0,
                subtotal: item.subtotal || 0,
                name: item.name || '',
              })),
              total: data.totalAmount || data.total || 0,
              status: data.status || 'pending',
              bags: data.bagCount || data.bags || 0,
              department: data.department,
            };
            allOrders.push(bill);
          }
        });
      }
    } catch (error: any) {
      console.log('⚠️ Legacy orders collection not accessible or empty');
    }

    // Enrich orders with vegetable names if missing
    const missingVegetableIds = new Set<string>();
    allOrders.forEach(order => {
      order.items.forEach(item => {
        if (!item.name && item.vegetableId) {
          missingVegetableIds.add(item.vegetableId);
        }
      });
    });

    // Fetch missing vegetable names
    if (missingVegetableIds.size > 0) {
      console.log(`📦 Fetching ${missingVegetableIds.size} vegetable details...`);
      const vegetablePromises = Array.from(missingVegetableIds).map(async (vegId) => {
        try {
          const vegetable = await getVegetableById(vegId);
          if (vegetable) {
            vegetableCache.set(vegId, vegetable);
          }
        } catch (error) {
          console.warn(`Failed to fetch vegetable ${vegId}:`, error);
        }
      });

      await Promise.all(vegetablePromises);

      // Enrich orders with vegetable names
      allOrders.forEach(order => {
        order.items = order.items.map(item => {
          if (!item.name && item.vegetableId) {
            const vegetable = vegetableCache.get(item.vegetableId);
            if (vegetable) {
              return {
                ...item,
                name: vegetable.name,
                pricePerKg: item.pricePerKg || vegetable.pricePerKg,
              };
            }
          }
          return item;
        });
      });
    }

    // Filter orders by allowed statuses only
    const allowedStatuses = ['packed', 'delivered', 'bill sent', 'bill_sent'];
    const filteredOrders = allOrders.filter(order => {
      const status = order.status?.toLowerCase();
      return allowedStatuses.includes(status);
    });

    // Sort orders by date (newest first)
    filteredOrders.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

    console.log(`✅ Found ${filteredOrders.length} completed orders (out of ${allOrders.length} total) for customer ${customerId}`);
    
    if (filteredOrders.length === 0 && allOrders.length > 0) {
      console.log(`⚠️ Found ${allOrders.length} orders, but none with status: packed, delivered, or bill sent`);
    } else if (allOrders.length === 0) {
      console.log(`⚠️ No orders found. Make sure:
        1. Orders exist in Firebase with customerId: ${customerId}
        2. Firebase rules allow reading orders for this user
        3. The field name is 'customerId' (not 'userId')`);
    }

    return filteredOrders;
  } catch (error) {
    console.error('❌ Error fetching user orders:', error);
    throw error;
  }
};




