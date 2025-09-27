# Available Stock Implementation

## Overview
This implementation adds an `availableStock` field to your Firebase stock storage schema to track real-time available inventory that updates when users make purchases.

## Schema Changes

### Updated Stock Interface
```typescript
export interface Stock {
  productId: string;
  productName: string;
  quantity: number;           // Total stock quantity
  availableStock: number;    // Available stock (reduces on purchase)
  price: number;
  addedBy: string;
  addedAt: Date;
  lastUpdated: Date;
}
```

## Key Features

### 1. Real-time Stock Updates
- When users make purchases, `availableStock` is automatically reduced
- `totalStockKg` remains unchanged (for historical tracking)
- `availableStock` cannot go below 0

### 2. New Utility Functions

#### `updateAvailableStock(productId, quantitySold)`
- Reduces available stock when items are sold
- Automatically prevents negative stock values
- Updates `lastUpdated` timestamp

#### `updateStockQuantityAndAvailable(productId, newQuantity)`
- Updates both total quantity and available stock
- Maintains consistency between total and available stock
- Used when adding new stock or adjusting inventory

### 3. Integration Points

#### CartView Component
- Automatically updates `availableStock` when orders are placed
- Only updates for admin users (as per existing logic)
- Uses batch updates for performance

#### Inventory Component
- Initializes `availableStock` to match `totalStockKg` when adding new items
- Updates both fields when modifying existing items

## Migration

### For Existing Data
Run the migration script to add `availableStock` field to existing stock documents:

```typescript
import { runStockMigration } from './src/utils/migrateStock';

// Run once to migrate existing data
runStockMigration();
```

### Migration Process
1. Fetches all existing stock documents
2. Adds `availableStock` field (set to current `totalStockKg` or `quantity`)
3. Updates `lastUpdated` timestamp
4. Skips documents that already have `availableStock` field

## Usage Examples

### Adding New Stock
```typescript
import { addStock } from './src/utils/stockUtils';

const newStock = {
  productId: 'apple-001',
  productName: 'Apple',
  quantity: 100,
  price: 180,
  addedBy: 'admin-user-id'
};

// availableStock will be automatically set to 100
await addStock(newStock);
```

### Processing a Purchase
```typescript
import { updateAvailableStock } from './src/utils/stockUtils';

// When user buys 5kg of apples
await updateAvailableStock('apple-001', 5);
// availableStock: 100 -> 95
```

### Updating Total Stock
```typescript
import { updateStockQuantityAndAvailable } from './src/utils/stockUtils';

// When adding 20kg more to total stock
await updateStockQuantityAndAvailable('apple-001', 120);
// quantity: 100 -> 120
// availableStock: 95 -> 115 (increased by 20)
```

## Database Structure

### Before (Old Schema)
```json
{
  "name": "Apple",
  "category": "Fruits",
  "pricePerKg": 180,
  "totalStockKg": 27.5,
  "createdAt": "24 September 2025 at 11:22:49 UTC+5:30",
  "createdBy": "SECETCS033",
  "role": "admin"
}
```

### After (New Schema)
```json
{
  "name": "Apple",
  "category": "Fruits",
  "pricePerKg": 180,
  "totalStockKg": 27.5,
  "availableStock": 22.5,  // NEW FIELD - reduces on purchase
  "createdAt": "24 September 2025 at 11:22:49 UTC+5:30",
  "createdBy": "SECETCS033",
  "role": "admin",
  "lastUpdated": "24 September 2025 at 11:22:49 UTC+5:30"
}
```

## Benefits

1. **Real-time Tracking**: Always know exactly how much stock is available for sale
2. **Historical Data**: `totalStockKg` preserves original stock levels
3. **Performance**: Efficient batch updates for multiple items
4. **Data Integrity**: Prevents negative stock values
5. **Backward Compatibility**: Existing code continues to work

## Implementation Notes

- All stock updates are atomic operations
- Error handling prevents partial updates
- Migration is safe to run multiple times
- Compatible with existing order processing logic
- Maintains audit trail with timestamps

## Next Steps

1. Run the migration script on your Firebase database
2. Test the functionality with sample purchases
3. Update any custom reporting to use `availableStock` field
4. Consider adding low stock alerts based on `availableStock`
