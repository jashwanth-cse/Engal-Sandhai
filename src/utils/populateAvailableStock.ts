import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AvailableStock } from '../types/firestore';

/**
 * Populate availableStock collection from existing vegetables
 * This function should be called to initialize the availableStock collection
 */
export const populateAvailableStockFromVegetables = async () => {
  try {
    console.log('Starting to populate availableStock collection from vegetables...');
    
    // Get all vegetables from the vegetables collection
    const vegetablesRef = collection(db, 'vegetables');
    const vegetablesSnapshot = await getDocs(vegetablesRef);
    
    if (vegetablesSnapshot.empty) {
      console.log('No vegetables found to migrate.');
      return { success: true, count: 0 };
    }
    
    console.log(`Found ${vegetablesSnapshot.docs.length} vegetables to migrate`);
    
    const migrationPromises = vegetablesSnapshot.docs.map(async (vegDoc) => {
      const vegData = vegDoc.data();
      
      // Create available stock entry
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
      
      const availableStockRef = doc(db, 'availableStock', vegDoc.id);
      await setDoc(availableStockRef, availableStockData);
      
      console.log(`✅ Migrated: ${vegData.name} (${vegDoc.id})`);
      return vegDoc.id;
    });
    
    const migratedIds = await Promise.all(migrationPromises);
    
    console.log(`🎉 Migration completed! Successfully migrated ${migratedIds.length} vegetables to availableStock collection.`);
    
    return { success: true, count: migratedIds.length, migratedIds };
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if availableStock collection exists and has data
 */
export const checkAvailableStockCollection = async () => {
  try {
    const availableStockRef = collection(db, 'availableStock');
    const snapshot = await getDocs(availableStockRef);
    
    return {
      exists: true,
      count: snapshot.docs.length,
      docs: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    };
  } catch (error) {
    console.error('Error checking availableStock collection:', error);
    return { exists: false, error: error.message };
  }
};

/**
 * Helper function to run the migration with better error handling
 */
export const runAvailableStockMigration = async () => {
  try {
    console.log('🚀 Starting available stock migration...');
    
    // First check if collection already has data
    const checkResult = await checkAvailableStockCollection();
    if (checkResult.exists && checkResult.count > 0) {
      console.log(`⚠️ AvailableStock collection already has ${checkResult.count} entries. Skipping migration.`);
      return { success: true, message: 'Collection already populated', count: checkResult.count };
    }
    
    // Run migration
    const result = await populateAvailableStockFromVegetables();
    
    if (result.success) {
      console.log('✅ Migration completed successfully!');
      return result;
    } else {
      console.error('❌ Migration failed:', result.error);
      return result;
    }
    
  } catch (error) {
    console.error('❌ Migration process failed:', error);
    return { success: false, error: error.message };
  }
};
