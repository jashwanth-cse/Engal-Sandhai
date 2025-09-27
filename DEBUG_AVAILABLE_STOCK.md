# Available Stock Debugging Guide

## Issues Fixed

### 1. **Real-time Updates Not Working**
**Problem**: Available stock was not updating in real-time when users made purchases.

**Solutions Applied**:
- ✅ Added comprehensive error handling and logging
- ✅ Improved batch update functionality
- ✅ Added fallback creation for missing stock entries
- ✅ Enhanced error messages for debugging

### 2. **Inventory Deletion Not Reflecting in Database**
**Problem**: When deleting items from inventory, the available stock collection was not being updated.

**Solutions Applied**:
- ✅ Added proper error handling in delete operations
- ✅ Added existence checks before deletion
- ✅ Enhanced logging for delete operations
- ✅ Added user feedback for sync failures

## Debugging Tools Created

### 1. **AvailableStockDebugger Component**
```typescript
// Use this component to test and monitor the system
import AvailableStockDebugger from './src/components/AvailableStockDebugger';

// Add to your app to debug available stock issues
<AvailableStockDebugger />
```

**Features**:
- Real-time monitoring of available stock collection
- Firebase connection testing
- Stock reduction testing
- Stock deletion testing
- Comprehensive error reporting

### 2. **Test Functions**
```typescript
import { testFirebaseConnection, testAvailableStockOperations } from './src/utils/testFirebaseConnection';
import { runAvailableStockMigration } from './src/utils/populateAvailableStock';

// Test Firebase connection
await testFirebaseConnection();

// Test available stock operations
await testAvailableStockOperations();

// Run migration to populate available stock
await runAvailableStockMigration();
```

## Step-by-Step Debugging Process

### Step 1: Check Firebase Connection
```javascript
// Open browser console and run:
import { testFirebaseConnection } from './src/utils/testFirebaseConnection';
await testFirebaseConnection();
```

**Expected Output**:
```
Testing Firebase connection...
Test 1: Reading from availableStock collection...
Found X documents in availableStock collection
Test 2: Adding test document...
Test document added successfully
Test 3: Updating test document...
Test document updated successfully
Test 4: Deleting test document...
Test document deleted successfully
All Firebase tests passed! ✅
```

### Step 2: Populate Available Stock Collection
```javascript
// Run migration to populate available stock from existing vegetables
import { runAvailableStockMigration } from './src/utils/populateAvailableStock';
await runAvailableStockMigration();
```

**Expected Output**:
```
🚀 Starting available stock migration...
Found X vegetables to migrate
✅ Migrated: Apple (apple-001)
✅ Migrated: Banana (banana-002)
...
🎉 Migration completed! Successfully migrated X vegetables to availableStock collection.
```

### Step 3: Test Real-time Updates
1. Open the AvailableStockDebugger component
2. Click "Run Tests" button
3. Try reducing stock for a product
4. Check if updates appear in real-time

### Step 4: Test Inventory Operations
1. Add a new vegetable in inventory
2. Check if available stock entry is created
3. Update a vegetable
4. Check if available stock is updated
5. Delete a vegetable
6. Check if available stock entry is removed

## Common Issues and Solutions

### Issue 1: "Available stock not found for product"
**Cause**: The available stock collection is not populated or the product ID doesn't match.

**Solution**:
```javascript
// Run migration to populate available stock
await runAvailableStockMigration();
```

### Issue 2: "Failed to sync available stock"
**Cause**: Firebase permissions or network issues.

**Solution**:
1. Check Firebase console for errors
2. Verify Firebase rules allow read/write to availableStock collection
3. Check network connection

### Issue 3: Real-time updates not working
**Cause**: Firestore listeners not properly set up.

**Solution**:
1. Check browser console for errors
2. Verify Firebase configuration
3. Test with AvailableStockDebugger component

## Firebase Security Rules

Make sure your Firestore rules allow access to the availableStock collection:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to availableStock collection
    match /availableStock/{document} {
      allow read, write: if true; // Adjust based on your auth requirements
    }
    
    // Your existing rules...
  }
}
```

## Monitoring and Logs

### Console Logs to Watch For:
- `"Upserting available stock for: [productId]"` - When creating/updating stock
- `"Reducing available stock for [productId] by [quantity]"` - When processing purchases
- `"Deleting available stock for product [productId]"` - When deleting items
- `"Available stock upserted successfully: [productId]"` - Success messages

### Error Logs to Watch For:
- `"Error upserting available stock"` - Creation/update failures
- `"Error reducing available stock"` - Purchase processing failures
- `"Error deleting available stock"` - Deletion failures
- `"Failed to sync available stock"` - General sync failures

## Testing Checklist

- [ ] Firebase connection works
- [ ] Available stock collection is populated
- [ ] Adding vegetables creates available stock entries
- [ ] Updating vegetables updates available stock
- [ ] Deleting vegetables removes available stock entries
- [ ] Purchases reduce available stock in real-time
- [ ] Real-time display shows live updates
- [ ] Error handling works properly

## Performance Optimization

### Batch Operations
The system uses batch operations for multiple items:
```typescript
// Multiple items in a single purchase
const stockUpdates = cartItems.map((item) => ({
  productId: item.vegetableId,
  quantitySold: item.quantityKg
}));
await batchUpdateAvailableStock(stockUpdates, userId);
```

### Real-time Listeners
Use the RealTimeAvailableStock component for live monitoring:
```typescript
import RealTimeAvailableStock from './src/components/RealTimeAvailableStock';

// This will show live updates
<RealTimeAvailableStock />
```

## Next Steps

1. **Run Migration**: Execute the migration script to populate available stock
2. **Test Operations**: Use the debugger to test all operations
3. **Monitor Logs**: Watch console for any errors
4. **Verify Real-time**: Check that updates appear immediately
5. **Test Edge Cases**: Try deleting non-existent items, etc.

The system now has comprehensive error handling, logging, and debugging tools to help identify and resolve any issues with real-time available stock updates!
