# Date-Based Inventory System - Historical Data Preservation

## Problem Solved

**Original Issue**: When inventory was updated on Day 25, Day 24 orders showed "N/A" because the inventory data was overwritten.

## Solution Architecture

### New Database Structure

**Before (Overwriting Problem):**
```
vegetables/
  └── doc123 (gets overwritten each day)

availableStock/
  └── doc123 (gets overwritten each day)
```

**After (Historical Preservation):**
```
vegetables/
  ├── 2024-09-24/items/doc123 (Day 24 inventory preserved)
  └── 2024-09-25/items/doc123 (Day 25 inventory separate)

availableStock/
  ├── 2024-09-24/items/doc123 (Day 24 stock preserved)  
  └── 2024-09-25/items/doc123 (Day 25 stock separate)
```

## How It Works

### 1. **Date-Based Collection Functions**
- `getVegetablesCol(date)` → Returns date-specific collection
- `getAvailableStockCol(date)` → Returns date-specific stock collection
- `getDateKey(date)` → Formats date as "YYYY-MM-DD"

### 2. **Backward Compatibility**
- **No date provided**: Uses regular collections (existing behavior)
- **Date provided**: Uses date-based collections (new behavior)

### 3. **Historical Data Access**
```typescript
// View Day 24 inventory (preserved forever)
subscribeToVegetables(setVegetables, new Date('2024-09-24'));

// View Day 25 inventory (separate data)  
subscribeToVegetables(setVegetables, new Date('2024-09-25'));

// Current inventory (today)
subscribeToVegetables(setVegetables); // No date = today
```

## Real-World Example

### Scenario: Day 24 → Day 25 Transition

**Day 24:**
- Upload inventory: Tomatoes 10kg, Onions 5kg
- Customer orders: 3kg Tomatoes
- Available after orders: Tomatoes 7kg, Onions 5kg

**Day 25:**
- Add new stock: Tomatoes 15kg, Onions 8kg  
- New inventory stored separately in `2024-09-25` collection

**Result:**
- **Day 24 Orders**: Still show Tomatoes 10kg, Onions 5kg ✅
- **Day 25 Orders**: Show Tomatoes 15kg, Onions 8kg ✅
- **Historical integrity preserved** ✅

## Modified Functions

### Database Service (`dbService.ts`)

```typescript
// All functions now accept optional date parameter
addVegetableToDb(vegetable, date?)     // Creates in date-specific collection
updateVegetableInDb(vegetable, date?)   // Updates date-specific collection  
deleteVegetableFromDb(id, date?)       // Deletes from date-specific collection
subscribeToVegetables(callback, date?) // Subscribes to date-specific data
subscribeToAvailableStock(callback, date?) // Real-time stock for specific date
```

### Data Hook (`useBillingData.ts`)

```typescript
// Hook now passes selectedDate to all database functions
const { selectedDate } = props;

// Fetches inventory for selected date (or current date if none)
subscribeToVegetables(callback, selectedDate);
subscribeToAvailableStock(callback, selectedDate);
```

## Migration Strategy

### Phase 1: Existing Data (Completed ✅)
- Existing inventory in regular collections continues to work
- No disruption to current operations

### Phase 2: New Data (Active ✅)
- New inventory automatically uses date-based collections
- Historical data preserved from today forward

### Phase 3: Future Enhancement
- Optional: Migrate existing data to date-based structure
- Maintain backward compatibility

## Benefits

1. **Historical Integrity**: Orders always reference correct inventory
2. **Data Audit Trail**: Complete history of inventory changes  
3. **Date-Specific Reporting**: Analyze inventory on any specific date
4. **Zero Data Loss**: Previous inventory states never overwritten
5. **Seamless Operation**: No disruption to daily workflows

## Usage Examples

```typescript
// Current day inventory (default behavior)
const todayData = useBillingData();

// Historical inventory for specific date  
const sept24Data = useBillingData({ selectedDate: new Date('2024-09-24') });
const sept25Data = useBillingData({ selectedDate: new Date('2024-09-25') });
```

## Testing the Fix

1. **Add inventory on Day 24** → Stored in `vegetables/2024-09-24/items/`
2. **Create orders on Day 24** → References Day 24 inventory
3. **Add inventory on Day 25** → Stored in `vegetables/2024-09-25/items/`  
4. **View Day 24 orders** → Still shows Day 24 inventory correctly ✅

**Result**: Historical orders maintain data integrity permanently.