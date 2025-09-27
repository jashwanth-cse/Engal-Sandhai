# Real-time Available Stock System

## Overview
This implementation creates a separate `availableStock` collection in Firebase that updates in real-time when users make purchases and when inventory items are added, updated, or deleted.

## Key Features

### 1. **Separate Available Stock Collection**
- Independent `availableStock` collection in Firebase
- Real-time updates using Firestore listeners
- Automatic synchronization with inventory changes

### 2. **Real-time Updates**
- ✅ **Purchases**: Available stock reduces immediately when users buy items
- ✅ **Inventory Changes**: Available stock updates when items are added/updated/deleted
- ✅ **Live Monitoring**: Real-time display of stock levels

### 3. **Data Structure**

#### AvailableStock Interface
```typescript
export interface AvailableStock {
  productId: string;
  productName: string;
  category: string;
  pricePerKg: number;
  totalStockKg: number;
  availableStockKg: number;  // Real-time available stock
  unitType: 'KG' | 'COUNT';
  lastUpdated: Date;
  updatedBy: string;
}
```

## Implementation Details

### 1. **Available Stock Utilities** (`src/utils/availableStockUtils.ts`)

#### Core Functions:
- `upsertAvailableStock()` - Create or update available stock entry
- `reduceAvailableStock()` - Reduce stock when items are purchased
- `updateAvailableStockFromInventory()` - Update from inventory changes
- `deleteAvailableStock()` - Remove stock entry when item is deleted
- `batchUpdateAvailableStock()` - Efficient batch updates for purchases
- `syncAvailableStockWithVegetables()` - Sync with inventory operations

### 2. **Inventory Integration** (`src/components/Inventory.tsx`)

#### Automatic Synchronization:
- **Add Item**: Creates new available stock entry
- **Update Item**: Updates available stock with new total
- **Delete Item**: Removes available stock entry

```typescript
// Example: Adding a new vegetable
await syncAvailableStockWithVegetables(vegetable, 'add', userId);

// Example: Updating a vegetable
await syncAvailableStockWithVegetables(vegetable, 'update', userId);

// Example: Deleting a vegetable
await syncAvailableStockWithVegetables(vegetable, 'delete', userId);
```

### 3. **Purchase Integration** (`src/components/CartView.tsx`)

#### Real-time Stock Reduction:
```typescript
// When user completes purchase
const stockUpdates = cartItems.map((item) => ({
  productId: item.vegetableId,
  quantitySold: item.quantityKg
}));
await batchUpdateAvailableStock(stockUpdates, userId);
```

### 4. **Real-time Display** (`src/components/RealTimeAvailableStock.tsx`)

#### Live Monitoring Features:
- Real-time updates using Firestore listeners
- Visual stock level indicators
- Low stock warnings (below 20%)
- Out of stock alerts
- Last updated timestamps

## Migration Process

### 1. **Run Initial Migration**
```typescript
import { runAvailableStockMigration } from './src/utils/migrateToAvailableStock';

// Run once to populate availableStock collection
await runAvailableStockMigration();
```

### 2. **Migration Benefits**
- Populates `availableStock` collection from existing vegetables
- Initializes `availableStockKg` to match `totalStockKg`
- Safe to run multiple times
- Preserves all existing data

## Usage Examples

### 1. **Adding New Inventory Item**
```typescript
// In Inventory component - automatically handled
const newVegetable = {
  name: 'Apple',
  category: 'Fruits',
  pricePerKg: 180,
  totalStockKg: 50,
  unitType: 'KG'
};

// This automatically:
// 1. Adds to vegetables collection
// 2. Creates availableStock entry
// 3. Sets availableStockKg = totalStockKg
```

### 2. **Processing a Purchase**
```typescript
// In CartView component - automatically handled
const purchase = [
  { productId: 'apple-001', quantitySold: 5 },
  { productId: 'banana-002', quantitySold: 3 }
];

// This automatically:
// 1. Reduces availableStockKg for each item
// 2. Updates lastUpdated timestamp
// 3. Records who made the purchase
```

### 3. **Real-time Monitoring**
```typescript
// Use RealTimeAvailableStock component
<RealTimeAvailableStock />

// Features:
// - Live updates without page refresh
// - Visual stock level indicators
// - Low stock warnings
// - Out of stock alerts
```

## Database Structure

### Before (Vegetables Only)
```
vegetables/
  ├── apple-001/
  │   ├── name: "Apple"
  │   ├── totalStockKg: 50
  │   └── pricePerKg: 180
  └── banana-002/
      ├── name: "Banana"
      ├── totalStockKg: 30
      └── pricePerKg: 120
```

### After (With Available Stock)
```
vegetables/                    availableStock/
  ├── apple-001/               ├── apple-001/
  │   ├── name: "Apple"        │   ├── productName: "Apple"
  │   ├── totalStockKg: 50     │   ├── totalStockKg: 50
  │   └── pricePerKg: 180      │   ├── availableStockKg: 45  ← Real-time
  └── banana-002/              │   └── lastUpdated: timestamp
      ├── name: "Banana"       └── banana-002/
      ├── totalStockKg: 30         ├── productName: "Banana"
      └── pricePerKg: 120          ├── totalStockKg: 30
                                   ├── availableStockKg: 27  ← Real-time
                                   └── lastUpdated: timestamp
```

## Benefits

### 1. **Real-time Accuracy**
- Always know exactly how much stock is available
- Immediate updates when purchases are made
- No need to calculate from historical data

### 2. **Performance**
- Dedicated collection for stock queries
- Efficient real-time listeners
- Batch updates for multiple items

### 3. **Data Integrity**
- Automatic synchronization with inventory changes
- Prevents negative stock values
- Maintains audit trail

### 4. **User Experience**
- Live stock updates without page refresh
- Visual indicators for stock levels
- Immediate feedback on purchases

## Error Handling

### 1. **Graceful Degradation**
- Continues working if availableStock sync fails
- Logs errors for debugging
- Shows user-friendly error messages

### 2. **Data Consistency**
- Validates stock levels before updates
- Prevents negative stock values
- Maintains referential integrity

## Next Steps

1. **Run Migration**: Execute migration script to populate availableStock collection
2. **Test Real-time Updates**: Make test purchases to verify live updates
3. **Monitor Performance**: Use RealTimeAvailableStock component for monitoring
4. **Add Notifications**: Consider implementing low stock alerts
5. **Analytics**: Track stock movement patterns

## Troubleshooting

### Common Issues:
1. **Migration Fails**: Check Firebase permissions and network connection
2. **Real-time Not Working**: Verify Firestore listeners are properly set up
3. **Stock Not Updating**: Check if sync functions are being called
4. **Negative Stock**: Verify validation logic in reduceAvailableStock function

This system provides a robust, real-time available stock management solution that automatically stays in sync with your inventory and purchase operations!
