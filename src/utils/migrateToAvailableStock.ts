import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AvailableStock } from '../types/firestore';

/**
 * Migration script to populate availableStock collection from existing vegetables
 * This should be run once to create the availableStock collection
 */
export const migrateVegetablesToAvailableStock = async () => {
  try {
    console.log('Starting migration from vegetables to availableStock collection...');
    
    // Get all vegetables from the vegetables collection
    const vegetablesRef = collection(db, 'vegetables');
    const vegetablesSnapshot = await getDocs(vegetablesRef);
    
    if (vegetablesSnapshot.empty) {
      console.log('No vegetables found to migrate.');
      return;
    }
    
    const migrationPromises = vegetablesSnapshot.docs.map(async (vegDoc) => {
      const vegData = vegDoc.data();
      
      // Check if available stock already exists for this product
      const availableStockRef = doc(db, 'availableStock', vegDoc.id);
      
      const availableStockData: AvailableStock = {
        productId: vegDoc.id,
        productName: vegData.name || 'Unknown',
        category: vegData.category || 'Uncategorized',
        pricePerKg: vegData.pricePerKg || 0,
        totalStockKg: vegData.totalStockKg || 0,
        availableStockKg: vegData.totalStockKg || 0, // Initialize with total stock
        unitType: vegData.unitType || 'KG',
        lastUpdated: new Date(),
        updatedBy: 'migration-script'
      };
      
      await setDoc(availableStockRef, availableStockData);
      console.log(`Migrated: ${vegData.name} (${vegDoc.id})`);
    });
    
    await Promise.all(migrationPromises);
    console.log(`Migration completed! Migrated ${vegetablesSnapshot.docs.length} vegetables to availableStock collection.`);
    
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
};

/**
 * Helper function to run the migration
 */
export const runAvailableStockMigration = async () => {
  try {
    await migrateVegetablesToAvailableStock();
    console.log('Available stock migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
};
