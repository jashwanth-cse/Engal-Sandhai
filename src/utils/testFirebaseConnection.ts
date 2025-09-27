import { collection, addDoc, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Test Firebase connection and available stock operations
 */
export const testFirebaseConnection = async () => {
  try {
    console.log('Testing Firebase connection...');
    
    // Test 1: Check if we can read from availableStock collection
    console.log('Test 1: Reading from availableStock collection...');
    const availableStockRef = collection(db, 'availableStock');
    const snapshot = await getDocs(availableStockRef);
    console.log(`Found ${snapshot.docs.length} documents in availableStock collection`);
    
    // Test 2: Try to add a test document
    console.log('Test 2: Adding test document...');
    const testDoc = {
      productId: 'test-product-123',
      productName: 'Test Product',
      category: 'Test',
      pricePerKg: 100,
      totalStockKg: 50,
      availableStockKg: 50,
      unitType: 'KG',
      lastUpdated: new Date(),
      updatedBy: 'test-user'
    };
    
    const testDocRef = doc(db, 'availableStock', 'test-product-123');
    await setDoc(testDocRef, testDoc);
    console.log('Test document added successfully');
    
    // Test 3: Try to update the test document
    console.log('Test 3: Updating test document...');
    await setDoc(testDocRef, {
      ...testDoc,
      availableStockKg: 45,
      lastUpdated: new Date()
    });
    console.log('Test document updated successfully');
    
    // Test 4: Try to delete the test document
    console.log('Test 4: Deleting test document...');
    await deleteDoc(testDocRef);
    console.log('Test document deleted successfully');
    
    console.log('All Firebase tests passed! ✅');
    return true;
    
  } catch (error) {
    console.error('Firebase test failed:', error);
    return false;
  }
};

/**
 * Test available stock operations specifically
 */
export const testAvailableStockOperations = async () => {
  try {
    console.log('Testing available stock operations...');
    
    // Test adding a product
    const testProduct = {
      productId: 'test-apple-001',
      productName: 'Test Apple',
      category: 'Fruits',
      pricePerKg: 180,
      totalStockKg: 100,
      availableStockKg: 100,
      unitType: 'KG' as const,
      lastUpdated: new Date(),
      updatedBy: 'test-user'
    };
    
    const productRef = doc(db, 'availableStock', 'test-apple-001');
    await setDoc(productRef, testProduct);
    console.log('✅ Product added to availableStock');
    
    // Test reducing stock
    await setDoc(productRef, {
      ...testProduct,
      availableStockKg: 95,
      lastUpdated: new Date()
    });
    console.log('✅ Stock reduced successfully');
    
    // Test deleting product
    await deleteDoc(productRef);
    console.log('✅ Product deleted from availableStock');
    
    console.log('All available stock operations passed! ✅');
    return true;
    
  } catch (error) {
    console.error('Available stock test failed:', error);
    return false;
  }
};
