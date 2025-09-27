import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Migration script to add availableStock field to existing stock documents
 * This should be run once to update existing stock records
 */
export const migrateStockToIncludeAvailableStock = async () => {
  try {
    console.log('Starting stock migration to add availableStock field...');
    
    const stocksRef = collection(db, 'stocks');
    const snapshot = await getDocs(stocksRef);
    
    const updatePromises = snapshot.docs.map(async (stockDoc) => {
      const data = stockDoc.data();
      
      // Only update if availableStock field doesn't exist
      if (data.availableStock === undefined) {
        const availableStock = data.totalStockKg || data.quantity || 0;
        
        await updateDoc(doc(db, 'stocks', stockDoc.id), {
          availableStock: availableStock,
          lastUpdated: new Date()
        });
        
        console.log(`Updated stock ${stockDoc.id}: availableStock = ${availableStock}`);
      }
    });
    
    await Promise.all(updatePromises);
    console.log('Stock migration completed successfully!');
    
  } catch (error) {
    console.error('Error during stock migration:', error);
    throw error;
  }
};

/**
 * Helper function to run migration (call this once)
 */
export const runStockMigration = async () => {
  try {
    await migrateStockToIncludeAvailableStock();
    console.log('Migration completed. All existing stock records now have availableStock field.');
  } catch (error) {
    console.error('Migration failed:', error);
  }
};
