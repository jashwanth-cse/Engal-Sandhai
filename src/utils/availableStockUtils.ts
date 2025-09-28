import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where,
  setDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { AvailableStock } from '../types/firestore';

/**
 * Create or update available stock entry
 */
export const upsertAvailableStock = async (stockData: Omit<AvailableStock, 'lastUpdated'> & { updatedBy?: string }) => {
  try {
    console.log('Upserting available stock for:', stockData.productId);
    const availableStockRef = doc(db, 'availableStock', stockData.productId);
    const stockDoc = await getDoc(availableStockRef);
    
    const availableStockData: AvailableStock = {
      ...stockData,
      lastUpdated: new Date(),
      updatedBy: stockData.updatedBy || 'system'
    };

    if (stockDoc.exists()) {
      // Update existing entry
      console.log('Updating existing available stock entry');
      await updateDoc(availableStockRef, {
        ...availableStockData,
        lastUpdated: availableStockData.lastUpdated,
        updatedBy: availableStockData.updatedBy
      });
    } else {
      // Create new entry
      console.log('Creating new available stock entry');
      await setDoc(availableStockRef, availableStockData);
    }
    
    console.log('Available stock upserted successfully:', stockData.productId);
    return availableStockData;
  } catch (error) {
    console.error('Error upserting available stock:', error);
    console.error('Stock data:', stockData);
    throw error;
  }
};

/**
 * Update available stock when items are purchased
 */
export const reduceAvailableStock = async (productId: string, quantitySold: number, updatedBy: string = 'system') => {
  try {
    console.log(`Reducing available stock for ${productId} by ${quantitySold}`);
    const availableStockRef = doc(db, 'availableStock', productId);
    const stockDoc = await getDoc(availableStockRef);
    
    if (stockDoc.exists()) {
      const currentData = stockDoc.data() as AvailableStock;
      const newAvailableStock = Math.max(0, currentData.availableStockKg - quantitySold);
      
      console.log(`Current available stock: ${currentData.availableStockKg}, reducing by: ${quantitySold}, new stock: ${newAvailableStock}`);
      
      await updateDoc(availableStockRef, {
        availableStockKg: newAvailableStock,
        lastUpdated: new Date(),
        updatedBy: updatedBy
      });
      
      console.log(`Successfully reduced available stock for ${productId}`);
      return newAvailableStock;
    } else {
      console.warn(`Available stock not found for product ${productId}. Creating new entry...`);
      // Try to create a basic entry if it doesn't exist
      await setDoc(availableStockRef, {
        productId: productId,
        productName: 'Unknown Product',
        category: 'Unknown',
        pricePerKg: 0,
        totalStockKg: 0,
        availableStockKg: 0,
        unitType: 'KG',
        lastUpdated: new Date(),
        updatedBy: updatedBy
      });
      return 0;
    }
  } catch (error) {
    console.error('Error reducing available stock:', error);
    console.error('Product ID:', productId, 'Quantity sold:', quantitySold);
    throw error;
  }
};

/**
 * Update available stock when inventory is updated
 */
export const updateAvailableStockFromInventory = async (
  productId: string, 
  totalStockKg: number, 
  updatedBy: string = 'system'
) => {
  try {
    const availableStockRef = doc(db, 'availableStock', productId);
    const stockDoc = await getDoc(availableStockRef);
    
    if (stockDoc.exists()) {
      const currentData = stockDoc.data() as AvailableStock;
      const quantityDifference = totalStockKg - currentData.totalStockKg;
      const newAvailableStock = Math.max(0, currentData.availableStockKg + quantityDifference);
      
      await updateDoc(availableStockRef, {
        totalStockKg: totalStockKg,
        availableStockKg: newAvailableStock,
        lastUpdated: new Date(),
        updatedBy: updatedBy
      });
      
      return newAvailableStock;
    } else {
      console.warn(`Available stock not found for product ${productId}. Cannot update.`);
      return 0;
    }
  } catch (error) {
    console.error('Error updating available stock from inventory:', error);
    throw error;
  }
};

/**
 * Delete available stock entry
 */
export const deleteAvailableStock = async (productId: string) => {
  try {
    console.log(`Deleting available stock for product ${productId}`);
    const availableStockRef = doc(db, 'availableStock', productId);
    
    // Check if document exists before trying to delete
    const stockDoc = await getDoc(availableStockRef);
    if (stockDoc.exists()) {
      await deleteDoc(availableStockRef);
      console.log(`Available stock deleted for product ${productId}`);
    } else {
      console.warn(`Available stock not found for product ${productId}, nothing to delete`);
    }
  } catch (error) {
    console.error('Error deleting available stock:', error);
    console.error('Product ID:', productId);
    throw error;
  }
};

/**
 * Get all available stock entries
 */
export const getAllAvailableStock = async (): Promise<AvailableStock[]> => {
  try {
    const availableStockRef = collection(db, 'availableStock');
    const snapshot = await getDocs(availableStockRef);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AvailableStock & { id: string }));
  } catch (error) {
    console.error('Error fetching available stock:', error);
    throw error;
  }
};

/**
 * Get available stock for a specific product
 */
export const getAvailableStock = async (productId: string): Promise<AvailableStock | null> => {
  try {
    const availableStockRef = doc(db, 'availableStock', productId);
    const stockDoc = await getDoc(availableStockRef);
    
    if (stockDoc.exists()) {
      return {
        id: stockDoc.id,
        ...stockDoc.data()
      } as AvailableStock & { id: string };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching available stock for product:', error);
    throw error;
  }
};

/**
 * Batch update available stock for multiple products (used in purchases)
 */
export const batchUpdateAvailableStock = async (
  updates: Array<{ productId: string; quantitySold: number }>,
  updatedBy: string = 'system'
) => {
  try {
    console.log(`Starting batch update for ${updates.length} products:`, updates);
    
    const promises = updates.map(async (update) => {
      console.log(`Processing update for ${update.productId}: ${update.quantitySold} units`);
      return await reduceAvailableStock(update.productId, update.quantitySold, updatedBy);
    });
    
    const results = await Promise.all(promises);
    console.log(`Batch update completed successfully for ${updates.length} products`);
    console.log('Results:', results);
    
    return results;
  } catch (error) {
    console.error('Error in batch update available stock:', error);
    console.error('Updates that failed:', updates);
    throw error;
  }
};

/**
 * Sync available stock with vegetables collection
 * This should be called when vegetables are added/updated/deleted
 */
export const syncAvailableStockWithVegetables = async (vegetable: any, action: 'add' | 'update' | 'delete', updatedBy: string = 'system') => {
  try {
    switch (action) {
      case 'add':
        await upsertAvailableStock({
          productId: vegetable.id,
          productName: vegetable.name,
          category: vegetable.category,
          pricePerKg: vegetable.pricePerKg,
          totalStockKg: vegetable.totalStockKg,
          availableStockKg: vegetable.totalStockKg, // Initialize with total stock
          unitType: vegetable.unitType || 'KG',
          updatedBy: updatedBy
        });
        break;
        
      case 'update':
        await upsertAvailableStock({
          productId: vegetable.id,
          productName: vegetable.name,
          category: vegetable.category,
          pricePerKg: vegetable.pricePerKg,
          totalStockKg: vegetable.totalStockKg,
          availableStockKg: vegetable.totalStockKg, // Reset to total stock on update
          unitType: vegetable.unitType || 'KG',
          updatedBy: updatedBy
        });
        break;
        
      case 'delete':
        try {
          await deleteAvailableStock(vegetable.id);
        } catch (error) {
          // If available stock doesn't exist, that's okay for deletion
          if (error.message && error.message.includes('not found')) {
            console.log(`Available stock entry not found for ${vegetable.id}, skipping deletion`);
          } else {
            throw error;
          }
        }
        break;
    }
  } catch (error) {
    console.error('Error syncing available stock with vegetables:', error);
    throw error;
  }
};
