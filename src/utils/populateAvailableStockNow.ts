import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AvailableStock } from '../types/firestore';

/**
 * Immediately populate availableStock collection from existing vegetables
 * This function will be called to fix the missing available stock entries
 */
export const populateAvailableStockNow = async () => {
  try {
    console.log('🚀 Starting immediate population of availableStock collection...');
    
    // Get all vegetables from the vegetables collection
    const vegetablesRef = collection(db, 'vegetables');
    const vegetablesSnapshot = await getDocs(vegetablesRef);
    
    if (vegetablesSnapshot.empty) {
      console.log('❌ No vegetables found to migrate.');
      return { success: false, message: 'No vegetables found' };
    }
    
    console.log(`📦 Found ${vegetablesSnapshot.docs.length} vegetables to process`);
    
    const results = [];
    
    for (const vegDoc of vegetablesSnapshot.docs) {
      try {
        const vegData = vegDoc.data();
        const productId = vegDoc.id;
        
        // Create available stock entry
        const availableStockData: AvailableStock = {
          productId: productId,
          productName: vegData.name || 'Unknown',
          category: vegData.category || 'Uncategorized',
          pricePerKg: vegData.pricePerKg || 0,
          totalStockKg: vegData.totalStockKg || 0,
          availableStockKg: vegData.totalStockKg || 0, // Initialize with total stock
          unitType: vegData.unitType || 'KG',
          lastUpdated: new Date(),
          updatedBy: 'migration-script'
        };
        
        const availableStockRef = doc(db, 'availableStock', productId);
        await setDoc(availableStockRef, availableStockData);
        
        console.log(`✅ Created available stock for: ${vegData.name} (${productId})`);
        results.push({ productId, name: vegData.name, success: true });
        
      } catch (error) {
        console.error(`❌ Failed to create available stock for ${vegDoc.id}:`, error);
        results.push({ productId: vegDoc.id, name: vegData.name, success: false, error: error.message });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    console.log(`🎉 Population completed! Success: ${successCount}, Failed: ${failCount}`);
    
    return { 
      success: true, 
      total: vegetablesSnapshot.docs.length,
      successCount,
      failCount,
      results 
    };
    
  } catch (error) {
    console.error('❌ Error during population:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if availableStock collection exists and has data
 */
export const checkAvailableStockStatus = async () => {
  try {
    const availableStockRef = collection(db, 'availableStock');
    const snapshot = await getDocs(availableStockRef);
    
    const status = {
      exists: true,
      count: snapshot.docs.length,
      docs: snapshot.docs.map(doc => ({ 
        id: doc.id, 
        name: doc.data().productName || 'Unknown',
        availableStock: doc.data().availableStockKg || 0
      }))
    };
    
    console.log('📊 Available Stock Status:', status);
    return status;
  } catch (error) {
    console.error('❌ Error checking availableStock collection:', error);
    return { exists: false, error: error.message };
  }
};

/**
 * Force populate available stock - call this to fix the issue
 */
export const forcePopulateAvailableStock = async () => {
  console.log('🔧 Force populating available stock collection...');
  
  // First check current status
  const status = await checkAvailableStockStatus();
  console.log('Current status:', status);
  
  // Then populate
  const result = await populateAvailableStockNow();
  console.log('Population result:', result);
  
  // Check status again
  const newStatus = await checkAvailableStockStatus();
  console.log('New status:', newStatus);
  
  return { before: status, after: newStatus, result };
};
