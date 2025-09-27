// Run this in browser console to populate available stock collection
// Copy and paste this entire script into browser console

(async function populateAvailableStock() {
  console.log('🚀 Starting available stock population...');
  
  try {
    // Import Firebase functions
    const { collection, getDocs, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    
    // Initialize Firebase (you may need to adjust this based on your config)
    const firebaseConfig = {
      apiKey: "AIzaSyAkXcureBhW089DGWb2Wj1FGUBVevXYbmE",
      authDomain: "engal-sandhai.firebaseapp.com",
      projectId: "engal-sandhai",
      storageBucket: "engal-sandhai.firebasestorage.app",
      messagingSenderId: "224014608772",
      appId: "1:224014608772:web:8f06e393560dffad0f55d1"
    };
    
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // Get all vegetables
    const vegetablesRef = collection(db, 'vegetables');
    const vegetablesSnapshot = await getDocs(vegetablesRef);
    
    if (vegetablesSnapshot.empty) {
      console.log('❌ No vegetables found');
      return;
    }
    
    console.log(`📦 Found ${vegetablesSnapshot.docs.length} vegetables`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const vegDoc of vegetablesSnapshot.docs) {
      try {
        const vegData = vegDoc.data();
        const productId = vegDoc.id;
        
        const availableStockData = {
          productId: productId,
          productName: vegData.name || 'Unknown',
          category: vegData.category || 'Uncategorized',
          pricePerKg: vegData.pricePerKg || 0,
          totalStockKg: vegData.totalStockKg || 0,
          availableStockKg: vegData.totalStockKg || 0,
          unitType: vegData.unitType || 'KG',
          lastUpdated: new Date(),
          updatedBy: 'console-migration'
        };
        
        const availableStockRef = doc(db, 'availableStock', productId);
        await setDoc(availableStockRef, availableStockData);
        
        console.log(`✅ Created: ${vegData.name} (${productId})`);
        successCount++;
        
      } catch (error) {
        console.error(`❌ Failed: ${vegDoc.id}`, error);
        failCount++;
      }
    }
    
    console.log(`🎉 Migration completed! Success: ${successCount}, Failed: ${failCount}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
})();
