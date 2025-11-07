import React, { useState, useEffect } from 'react';
import type { Bill, Vegetable, BillItem } from '../../types/types';
import { XMarkIcon, EyeIcon, ArrowDownTrayIcon, ShareIcon } from './ui/Icon.tsx';
import ImagePreviewModal from './ui/ImagePreviewModal.tsx';
import Button from './ui/Button.tsx';
import { getVegetableById, getDateKey } from '../services/dbService';
import { upiPng } from '../assets/upi.ts';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Firestore imports
import { doc, getDoc, writeBatch, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// New import: html2canvas for emoji fallback raster rendering
import html2canvas from 'html2canvas';

// IMPORTANT: External js font file generated via jsPDF fontconverter.
// Put your generated file at src/fonts/NotoSansTamil-Regular.js
// That file should call jsPDF.API.events.push([...]) and add the font to VFS
import '../fonts/NotoSansTamil-Regular.js';

// Let TypeScript know that jspdf is available on the window object
declare global {
    interface Window {
        jspdf: any;
    }
}

// Quick local type extension to avoid editing global type files
type ExtendedBill = Bill & { employee_name?: string };

// UPI IDs configuration
const UPI_IDS = [
  {
    id: 'qualitykannan1962-1@okhdfcbank',
    name: 'Quality Kannan',
    displayName: 'qualitykannan1962-1@okhdfcbank'
  },
  {
    id: 'vishnusakra.doc-2@okhdfcbank', 
    name: 'Vishnu Sakra',
    displayName: 'vishnusakra.doc-2@okhdfcbank'
  }
];

interface BillDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill | null;
  vegetableMap: Map<string, Vegetable>;
  vegetables: Vegetable[]; // Add vegetables array for adding new items
  onUpdateBill?: (billId: string, updates: Partial<Bill>) => Promise<void>;
  currentUser?: { id: string; name: string; role: string; email?: string };
}

const BillDetailModal: React.FC<BillDetailModalProps> = ({ isOpen, onClose, bill, vegetableMap, vegetables, onUpdateBill, currentUser }) => {
  // Cast to ExtendedBill so we can safely access employee_name if present
  const billTyped = bill as ExtendedBill | null;

  // Utility: remove emojis and invisible emoji-joiner chars from any text before sending to jsPDF
  // This keeps Tamil/English letters intact and only strips emoji-related code points.
  const sanitizeTextForPdf = React.useCallback((input: string | undefined | null): string => {
    if (!input) return '';
    return (
      input
        // Remove common emoji surrogate pairs (U+1F300–U+1FAFF etc.)
        .replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, '')
        // Remove Dingbats and a few decorative symbols (keeps punctuation/letters)
        .replace(/[\u2700-\u27BF]/g, '')
        // Remove private use & variation selectors often attached to emojis
        .replace(/[\uE000-\uF8FF]/g, '')
        .replace(/\uFE0F/g, '') // VS-16
        .replace(/\u200D/g, '') // zero-width-joiner
        // Remove Tamil letters (Unicode block U+0B80–U+0BFF)
        // Note: This strips Tamil characters so remaining English words stay visible in the PDF
        .replace(/[\u0B80-\u0BFF]/g, '')
        // Remove empty brackets left after stripping non-Latin content, e.g., "()", "[]", "{}"
        .replace(/\(\s*\)|\[\s*\]|\{\s*\}/g, '')
        // Remove leftover spaces before closing brackets (defensive)
        .replace(/\s+[)\]}]/g, match => match.trim().slice(-1))
        // Remove trailing punctuation/dividers left dangling
        .replace(/[\s\-–—,:;]+$/g, '')
        // Collapse extra spaces introduced by removals
        .replace(/\s{2,}/g, ' ')
        .trim()
    );
  }, []);

  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [editedItems, setEditedItems] = useState<BillItem[]>([]);
  // Local-only reference checkboxes for each item (not required, not saved by default)
  const [itemChecks, setItemChecks] = useState<Record<string, boolean>>({});
  const [calculatedTotal, setCalculatedTotal] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // const [bagCount, setBagCount] = useState(0); // Moved to user page
  const [showAddVegetables, setShowAddVegetables] = useState(false);
  
  // Added: customer name fetched from DB (if possible)
  const [customerNameFromDB, setCustomerNameFromDB] = useState<string>('');
  
  // Add state to track fetched vegetables for missing items
  const [fetchedVegetables, setFetchedVegetables] = useState<Map<string, Vegetable>>(new Map());
  const [isLoadingVegetables, setIsLoadingVegetables] = useState(false);
  
  // Add global cache to avoid re-fetching same vegetables across different bills
  const globalVegetableCache = React.useRef<Map<string, Vegetable>>(new Map());
  
  // UPI selection state
  const [selectedUpiId, setSelectedUpiId] = useState<string>('');
  
  // Copy UPI ID function
  const copyUpiId = async (upiId: string) => {
    try {
      await navigator.clipboard.writeText(upiId);
      // You could add a toast notification here if you have one
      console.log('UPI ID copied to clipboard:', upiId);
    } catch (err) {
      console.error('Failed to copy UPI ID:', err);
    }
  };
  
  // const BAG_PRICE = 10; // ₹10 per bag - Moved to user page
  
  // Memoized combined vegetable map for better performance
  const combinedVegetableMap = React.useMemo(() => {
    const combined = new Map(vegetableMap);
    fetchedVegetables.forEach((veg, id) => combined.set(id, veg));
    return combined;
  }, [vegetableMap, fetchedVegetables]);

  // Initialize edited items when bill changes
  useEffect(() => {
    if (bill) {
      console.log('🔍 BillDetailModal received bill:', bill.id, 'Items:', bill.items?.length || 0);
      console.log('📊 Bill items data:', bill.items);
      const itemsCopy = bill.items ? [...bill.items] : [];
      setEditedItems(itemsCopy);
      // Initialize checkbox state for each item (local only)
      const checks: Record<string, boolean> = {};
      itemsCopy.forEach((it, idx) => {
        const key = `${it.vegetableId}::${idx}`;
        checks[key] = itemChecks[key] || false;
      });
      setItemChecks(checks);
      // setBagCount(bill.bags || 0); // Moved to user page
      setCalculatedTotal(bill.total || 0);
      setHasUnsavedChanges(false);
      setFetchedVegetables(new Map()); // Reset fetched vegetables for new bill
      setSelectedUpiId(''); // Reset UPI selection for new bill
    }
  }, [bill]);
  
  // Effect to fetch missing vegetable data - OPTIMIZED VERSION
  useEffect(() => {
    if (!bill) return;
    
    const fetchMissingVegetables = async () => {
      setIsLoadingVegetables(true);
      const missingVegetables = new Map<string, Vegetable>();
      
      // Step 1: Identify truly missing vegetables (not in vegetableMap, fetchedVegetables, or global cache)
      const missingIds: string[] = [];
      const cachedVegetables = new Map<string, Vegetable>();
      
      for (const item of bill.items) {
        const existingVeg = vegetableMap.get(item.vegetableId) || 
                           fetchedVegetables.get(item.vegetableId) ||
                           globalVegetableCache.current.get(item.vegetableId);
        
        if (existingVeg) {
          // Add to local cache if found in global cache
          if (globalVegetableCache.current.has(item.vegetableId)) {
            cachedVegetables.set(item.vegetableId, existingVeg);
          }
        } else {
          missingIds.push(item.vegetableId);
        }
      }
      
      // Add cached vegetables to fetched vegetables
      if (cachedVegetables.size > 0) {
        setFetchedVegetables(prev => new Map([...prev, ...cachedVegetables]));
      }
      
      console.log(`🔍 Found ${missingIds.length} missing vegetables out of ${bill.items.length} items`);
      
      if (missingIds.length === 0) {
        setIsLoadingVegetables(false);
        return;
      }
      
      // Step 2: Try to fetch missing vegetables in batches (much faster than individual calls)
      const billDate = new Date(bill.date);
      const dateKey = getDateKey(billDate);
      
      try {
        // Batch fetch from date-based collection first (most likely to succeed)
        const batchPromises = missingIds.map(async (vegId) => {
          try {
            // Try current vegetables collection first
            let vegetableData = await getVegetableById(vegId);
            
            if (!vegetableData) {
              // Try date-based collection
              const dateBasedVegRef = doc(db, 'vegetables', dateKey, 'items', vegId);
              const dateBasedVegDoc = await getDoc(dateBasedVegRef);
              
              if (dateBasedVegDoc.exists()) {
                const data = dateBasedVegDoc.data();
                vegetableData = {
                  id: dateBasedVegDoc.id,
                  name: data.name || `Item ${vegId}`,
                  unitType: (data.unitType as 'KG' | 'COUNT') || 'KG',
                  pricePerKg: Number(data.pricePerKg || data.price) || 0,
                  totalStockKg: Number(data.totalStockKg || data.stock || data.totalStock) || 0,
                  stockKg: Number(data.stockKg || data.availableStock) || 0,
                  category: data.category || 'Other'
                };
              }
            }
            
            if (vegetableData) {
              return { id: vegId, vegetable: vegetableData };
            } else {
              // Create fallback using bill data
              const billItem = bill.items.find(item => item.vegetableId === vegId);
              const fallbackVegetable: Vegetable = {
                id: vegId,
                name: `Item ${vegId.replace('veg_', '').replace(/_/g, ' ').toUpperCase()}`,
                unitType: 'KG',
                pricePerKg: billItem ? (billItem.subtotal / billItem.quantityKg) || 0 : 0,
                totalStockKg: 0,
                stockKg: 0,
                category: 'Unknown'
              };
              return { id: vegId, vegetable: fallbackVegetable };
            }
          } catch (error) {
            console.error(`❌ Error fetching vegetable ${vegId}:`, error);
            // Create fallback even on error
            const billItem = bill.items.find(item => item.vegetableId === vegId);
            const fallbackVegetable: Vegetable = {
              id: vegId,
              name: `Item ${vegId.replace('veg_', '').replace(/_/g, ' ').toUpperCase()}`,
              unitType: 'KG',
              pricePerKg: billItem ? (billItem.subtotal / billItem.quantityKg) || 0 : 0,
              totalStockKg: 0,
              stockKg: 0,
              category: 'Unknown'
            };
            return { id: vegId, vegetable: fallbackVegetable };
          }
        });
        
        // Wait for all batch requests to complete
        const results = await Promise.all(batchPromises);
        
        // Add all results to missing vegetables map and global cache
        results.forEach(result => {
          if (result) {
            missingVegetables.set(result.id, result.vegetable);
            globalVegetableCache.current.set(result.id, result.vegetable); // Cache globally
          }
        });
        
        console.log(`✅ Successfully fetched ${missingVegetables.size} vegetables`);
        
        if (missingVegetables.size > 0) {
          setFetchedVegetables(prev => new Map([...prev, ...missingVegetables]));
        }
        
      } catch (error) {
        console.error('❌ Error in batch vegetable fetch:', error);
      }
      
      setIsLoadingVegetables(false);
    };
    
    fetchMissingVegetables();
  }, [bill?.id]); // Only depend on bill.id to avoid infinite loops and ensure proper refetching
  
  // Recalculate total when items change (bags moved to user page)
  useEffect(() => {
    const itemsTotal = editedItems.reduce((sum, item) => sum + item.subtotal, 0);
    // const bagsTotal = bagCount * BAG_PRICE; // Moved to user page
    // const newTotal = itemsTotal + bagsTotal; // Moved to user page
    const newTotal = itemsTotal;
    setCalculatedTotal(newTotal);
    
    // Check if there are unsaved changes (bags moved to user page)
    if (bill) {
      const originalItemsTotal = bill.items.reduce((sum, item) => sum + item.subtotal, 0);
      // const originalBagsTotal = (bill.bags || 0) * BAG_PRICE; // Moved to user page
      // const originalTotal = originalItemsTotal + originalBagsTotal; // Moved to user page
      const originalTotal = originalItemsTotal;
      
      const hasChanges = newTotal !== originalTotal || 
        // bagCount !== (bill.bags || 0) || // Moved to user page
        editedItems.some((item, index) => 
          item.quantityKg !== bill.items[index]?.quantityKg ||
          item.subtotal !== bill.items[index]?.subtotal
        );
      setHasUnsavedChanges(hasChanges);
    }
  }, [editedItems, bill]); // Removed bagCount dependency
  
  // SAFE helper to discover a "key" to fetch the customer record
  const getCustomerKeyFromBill = (b: Bill): string | null => {
    // try multiple likely property names without hard-failing TypeScript
    const anyBill = b as any;
    if ('customerId' in anyBill && typeof anyBill.customerId === 'string' && anyBill.customerId.trim()) {
      return anyBill.customerId;
    }
    if ('customerUid' in anyBill && typeof anyBill.customerUid === 'string' && anyBill.customerUid.trim()) {
      return anyBill.customerUid;
    }
    if ('customerEmail' in anyBill && typeof anyBill.customerEmail === 'string' && anyBill.customerEmail.trim()) {
      // many apps store email local-part as doc id
      return (anyBill.customerEmail as string).split('@')[0];
    }
    if ('customerPhone' in anyBill && typeof anyBill.customerPhone === 'string' && anyBill.customerPhone.trim()) {
      return anyBill.customerPhone;
    }
    // fallback: maybe bill has createdBy or owner or userId
    if ('userId' in anyBill && typeof anyBill.userId === 'string' && anyBill.userId.trim()) {
      return anyBill.userId;
    }
    if ('createdBy' in anyBill && typeof anyBill.createdBy === 'string' && anyBill.createdBy.trim()) {
      return anyBill.createdBy;
    }
    return null;
  };

  // Fetch the customer name from Firestore if we can find a key on the bill
  useEffect(() => {
    const loadName = async () => {
      setCustomerNameFromDB(''); // reset while loading
      if (!bill) return;
      const key = getCustomerKeyFromBill(bill);
      if (!key) {
        // no usable key available on bill -> nothing to fetch
        setCustomerNameFromDB('');
        return;
      }

      try {
        // try users collection first
        const userDocRef = doc(db, 'users', key);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const data = userSnap.data() as any;
          setCustomerNameFromDB(
            data.employee_name || data.name || data.fullName || data.displayName || ''
          );
          return;
        }

        // fallback: try customers collection (if you store customers separately)
        const custDocRef = doc(db, 'customers', key);
        const custSnap = await getDoc(custDocRef);
        if (custSnap.exists()) {
          const data = custSnap.data() as any;
          setCustomerNameFromDB(
            data.employee_name || data.name || data.fullName || data.displayName || ''
          );
          return;
        }

        // If no document found, keep empty (fallback to bill.customerName later)
        setCustomerNameFromDB('');
      } catch (err) {
        console.error('Error fetching customer name from Firestore:', err);
        setCustomerNameFromDB('');
      }
    };

    loadName();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill]); // run whenever bill changes
  
  if (!isOpen || !bill) return null;

  const handleQuantityChange = (index: number, newQuantity: number) => {
    const vegetable = combinedVegetableMap.get(editedItems[index].vegetableId);
    const currentItem = editedItems[index];
    
    // Ensure quantity is not negative and not more than 2 decimal places
    const clampedQuantity = Math.max(0, Math.round(newQuantity * 100) / 100);
    
    let pricePerKg: number;
    if (vegetable) {
      // Use vegetable price if available
      pricePerKg = vegetable.pricePerKg;
    } else if (currentItem.quantityKg > 0) {
      // Calculate price from existing subtotal if vegetable data not available
      pricePerKg = currentItem.subtotal / currentItem.quantityKg;
    } else {
      // Default to 0 if no data available
      pricePerKg = 0;
    }
    
    const newSubtotal = Math.round(clampedQuantity * pricePerKg * 100) / 100; // Round to 2 decimal places
    
    const updatedItems = [...editedItems];
    updatedItems[index] = {
      ...updatedItems[index],
      quantityKg: clampedQuantity,
      subtotal: newSubtotal,
      // Preserve the calculated price for future reference
      pricePerKg: pricePerKg
    };
    
    setEditedItems(updatedItems);
    // Note: We don't auto-save here, admin needs to click save button
  };

  // Bag count change handler - moved to user page
  /*
  const handleBagCountChange = (increment: boolean) => {
    setBagCount(prev => {
      const newCount = increment ? prev + 1 : Math.max(0, prev - 1);
      return newCount;
    });
  };
  */

  const handleAddVegetable = (vegetableId: string, quantity: number) => {
    const vegetable = combinedVegetableMap.get(vegetableId);
    if (!vegetable || quantity <= 0) return;

    const existingItemIndex = editedItems.findIndex(item => item.vegetableId === vegetableId);
    
    if (existingItemIndex >= 0) {
      // Update existing item
      const newItems = [...editedItems];
      const newQuantity = newItems[existingItemIndex].quantityKg + quantity;
      newItems[existingItemIndex] = {
        ...newItems[existingItemIndex],
        quantityKg: newQuantity,
        subtotal: newQuantity * vegetable.pricePerKg
      };
      setEditedItems(newItems);
    } else {
      // Add new item
      const newItem: BillItem = {
        vegetableId,
        quantityKg: quantity,
        subtotal: quantity * vegetable.pricePerKg
      };
      setEditedItems(prev => [...prev, newItem]);
    }
  };

  const handleRemoveVegetable = (vegetableId: string) => {
    setEditedItems(prev => prev.filter(item => item.vegetableId !== vegetableId));
  };

  const getAvailableVegetables = () => {
    return vegetables.filter(veg => !editedItems.some(item => item.vegetableId === veg.id));
  };

  const handleSaveChanges = async () => {
    if (!onUpdateBill || !bill || !hasUnsavedChanges) return;
    
    setIsSaving(true);
    try {
      console.log(`💰 Updating bill ${bill.id} - Original total: ₹${bill.total}, New total: ₹${calculatedTotal}`);
      
      // Calculate stock reduction for quantity changes
      await updateStockForQuantityChanges();
      
      // Update the bill with new items and total amount
      await onUpdateBill(bill.id, {
        items: editedItems,
        total: calculatedTotal,
        // bags: bagCount // Moved to user page
      });
      
      console.log(`✅ Bill ${bill.id} successfully updated in Firebase with new amount: ₹${calculatedTotal}`);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateStockForQuantityChanges = async () => {
    try {
      const stockBatch = writeBatch(db);
      let stockUpdateCount = 0;
      const targetDate = new Date(bill.date);
      const dateKey = getDateKey(targetDate);
      
      console.log(`📝 Updating stock for bill quantity changes on ${dateKey}`);
      console.log(`📊 Original items count: ${bill.items.length}, Edited items count: ${editedItems.length}`);

      // Create maps for easier comparison
      const originalItemsMap = new Map();
      bill.items.forEach(item => {
        originalItemsMap.set(item.vegetableId, item.quantityKg);
      });

      const editedItemsMap = new Map();
      editedItems.forEach(item => {
        editedItemsMap.set(item.vegetableId, item.quantityKg);
      });

      // Process all unique vegetable IDs from both original and edited items
      const allVegetableIds = new Set([...originalItemsMap.keys(), ...editedItemsMap.keys()]);

      for (const vegetableId of allVegetableIds) {
        const originalQuantity = originalItemsMap.get(vegetableId) || 0;
        const editedQuantity = editedItemsMap.get(vegetableId) || 0;
        const quantityDifference = editedQuantity - originalQuantity;

        // Only process items that have actually changed
        if (quantityDifference !== 0) {
          console.log(`� Processing ${vegetableId}: Original=${originalQuantity}kg, Edited=${editedQuantity}kg, Difference=${quantityDifference}kg`);

          // Update vegetables collection
          const vegRef = doc(db, 'vegetables', dateKey, 'items', vegetableId);
          const vegDoc = await getDoc(vegRef);
          
          if (vegDoc.exists()) {
            const currentStock = vegDoc.data().stockKg || 0;
            let newStock;

            if (quantityDifference > 0) {
              // Quantity increased - reduce stock
              newStock = Math.max(0, currentStock - quantityDifference);
              console.log(`📈 Quantity increased by ${quantityDifference}kg - reducing stock: ${currentStock} -> ${newStock}`);
            } else {
              // Quantity decreased - add stock back
              newStock = currentStock + Math.abs(quantityDifference);
              console.log(`📉 Quantity decreased by ${Math.abs(quantityDifference)}kg - adding stock back: ${currentStock} -> ${newStock}`);
            }
            
            stockBatch.update(vegRef, {
              stockKg: newStock,
              updatedAt: serverTimestamp()
            });
            stockUpdateCount++;
          } else {
            console.warn(`⚠️ Vegetable ${vegetableId} not found in vegetables collection`);
          }
          
          // Update available stock collection
          const availableStockRef = doc(db, 'availableStock', dateKey, 'items', vegetableId);
          const availableStockDoc = await getDoc(availableStockRef);
          
          if (availableStockDoc.exists()) {
            const currentAvailableStock = availableStockDoc.data().availableStockKg || 0;
            let newAvailableStock;

            if (quantityDifference > 0) {
              // Quantity increased - reduce available stock
              newAvailableStock = Math.max(0, currentAvailableStock - quantityDifference);
              console.log(`📈 Available stock reduced: ${currentAvailableStock} -> ${newAvailableStock}`);
            } else {
              // Quantity decreased - add available stock back
              newAvailableStock = currentAvailableStock + Math.abs(quantityDifference);
              console.log(`📉 Available stock increased: ${currentAvailableStock} -> ${newAvailableStock}`);
            }
            
            stockBatch.update(availableStockRef, {
              availableStockKg: newAvailableStock,
              lastUpdated: serverTimestamp(),
              updatedBy: currentUser?.id || 'admin'
            });
            stockUpdateCount++;
          } else {
            console.warn(`⚠️ Available stock for ${vegetableId} not found`);
          }
        } else {
          console.log(`➡️ No change for ${vegetableId} (${originalQuantity}kg) - skipping stock update`);
        }
      }

      // Commit stock updates if we have any
      if (stockUpdateCount > 0) {
        console.log(`💾 Committing ${stockUpdateCount} stock updates for bill ${bill.id}...`);
        await stockBatch.commit();
        console.log(`✅ Stock updates completed for bill ${bill.id}`);
      } else {
        console.log(`ℹ️ No stock updates needed for bill ${bill.id}`);
      }
      
    } catch (stockError) {
      console.error(`❌ Stock update failed for bill ${bill.id}:`, stockError);
      // This doesn't prevent the bill update from proceeding
    }
  };
  // Shared PDF generator for both Download and Share

  // ---- NEW HELPERS FOR FONT + EMOJI DETECTION / RASTER FALLBACK ----
  // Detect if any string contains emoji (basic range check) - used to decide raster fallback
  const containsEmoji = (text: string) => {
    if (!text) return false;
    // broad emoji ranges + variation selectors (covers most common emojis)
    const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
    try {
      return emojiRegex.test(text);
    } catch (e) {
      // If unicode property escapes unsupported, fallback to surrogate pair heuristics
      const surrogateRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]/;
      return surrogateRegex.test(text);
    }
  };

  // Helper: check if any item name or customer name contains emoji
  const billHasEmoji = () => {
    if (!bill) return false;
    if (containsEmoji(customerNameFromDB || bill.customerName || '')) return true;
    for (const it of editedItems) {
      const vegetable = combinedVegetableMap.get(it.vegetableId);
      const name = (it as any).name || vegetable?.name || '';
      if (containsEmoji(String(name))) return true;
    }
    return false;
  };

  // Helper to create a small printable HTML for rasterizing (keeps styling minimal and inline so it renders the same)
  const createPrintableBillElement = async (): Promise<HTMLElement> => {
    // Build a container element
    const container = document.createElement('div');
    container.style.width = '794px'; // ~A4 @ 96dpi: 794px width
    container.style.padding = '18px';
    container.style.boxSizing = 'border-box';
    container.style.background = '#ffffff';
    container.style.color = '#111827';
    container.style.fontFamily = "'Noto Sans Tamil', 'Roboto', Arial, sans-serif";
    container.style.fontSize = '12px';
    container.style.lineHeight = '1.35';
    container.style.border = '0';
    container.style.display = 'block';

    // Header bar (light green gradient)
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.padding = '14px 18px';
    header.style.borderRadius = '8px';
    header.style.background = 'linear-gradient(90deg, #d8f5e6 0%, #48bb78 100%)';
    header.style.color = '#064e3b';
    header.style.marginBottom = '12px';

    const titleWrap = document.createElement('div');
    titleWrap.innerHTML = `<div style="font-weight:800;font-size:20px">Engal Santhai</div><div style="font-size:12px;color:#065f46;margin-top:4px">Your Fresh Vegetable Partner</div>`;
    header.appendChild(titleWrap);

    const logoWrap = document.createElement('div');
    logoWrap.style.textAlign = 'right';
    logoWrap.innerHTML = `<div style="font-weight:700;color:#064e3b">INVOICE</div>`;
    header.appendChild(logoWrap);

    container.appendChild(header);

    // Bill meta block with clean spacing
    const meta = document.createElement('div');
    meta.style.display = 'flex';
    meta.style.justifyContent = 'space-between';
    meta.style.marginBottom = '12px';

    const leftMeta = document.createElement('div');
    leftMeta.style.lineHeight = '1.4';
    const billDateObj = new Date(bill.date);
    const dd = String(billDateObj.getDate()).padStart(2, '0');
    const mm = String(billDateObj.getMonth() + 1).padStart(2, '0');
    const yy = String(billDateObj.getFullYear());
    const idMatch = bill.id.match(/(\d{3,})$/);
    let serial = '001';
    if (idMatch) serial = idMatch[1].slice(-3).padStart(3, '0');
    const billNoFormatted = `ES${dd}${mm}${yy}-${serial}`;
    const timeStr = billDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
    leftMeta.innerHTML = `<div style="font-weight:600">BILL NO: ${billNoFormatted}</div>
      <div style="margin-top:6px">Date: ${dd}/${mm}/${yy}</div>`;
    meta.appendChild(leftMeta);

    const rightMeta = document.createElement('div');
    rightMeta.style.textAlign = 'right';
    rightMeta.style.lineHeight = '1.4';
    const custNameDisplay = customerNameFromDB || bill.customerName || '';
    // EMP ID — attempt to pull employee ID similarly as your earlier logic
    let employeeId = 'N/A';
    try {
      if ((bill as any).customerId) {
        employeeId = (bill as any).customerId;
      } else if (bill.customerName) {
        employeeId = bill.customerName;
      }
      if (typeof employeeId === 'string') {
        if (employeeId.includes('@')) employeeId = employeeId.split('@')[0];
        employeeId = employeeId.toUpperCase().trim();
      }
    } catch (e) {
      employeeId = 'N/A';
    }
    rightMeta.innerHTML = `<div style="font-weight:600">CUSTOMER NAME : ${custNameDisplay}</div>
      <div style="margin-top:6px">Time: ${timeStr}</div>
      <div style="margin-top:6px">EMP ID: ${employeeId}</div>`;
    meta.appendChild(rightMeta);

    container.appendChild(meta);

    // Table (styled)
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.marginTop = '6px';
    table.style.fontSize = '12px';
    table.innerHTML = `<thead>
      <tr style="background:#f1f5f9;color:#0f172a;font-weight:700;font-size:12px">
        <th style="padding:8px;border:1px solid #e6e9ee;width:6%;text-align:left">S.No.</th>
        <th style="padding:8px;border:1px solid #e6e9ee;text-align:left">Item</th>
        <th style="padding:8px;border:1px solid #e6e9ee;width:12%;text-align:right">Qty (kg)</th>
        <th style="padding:8px;border:1px solid #e6e9ee;width:16%;text-align:right">Rate (₹)</th>
        <th style="padding:8px;border:1px solid #e6e9ee;width:16%;text-align:right">Amount (₹)</th>
      </tr>
    </thead>`;
    const tbody = document.createElement('tbody');

    editedItems.forEach((item, idx) => {
      const vegetable = combinedVegetableMap.get(item.vegetableId);
      const name = (item as any).name || vegetable?.name || `Item ${item.vegetableId}`;
      const rate = (item as any).pricePerKg || vegetable?.pricePerKg || 0;
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #eef2f7';
      tr.innerHTML = `<td style="padding:8px;border:1px solid #e6e9ee;vertical-align:middle">${idx + 1}</td>
        <td style="padding:8px;border:1px solid #e6e9ee;vertical-align:middle">${name}</td>
        <td style="padding:8px;border:1px solid #e6e9ee;text-align:right;vertical-align:middle">${String(item.quantityKg)}</td>
        <td style="padding:8px;border:1px solid #e6e9ee;text-align:right;vertical-align:middle">₹${Number(rate).toFixed(2)}</td>
        <td style="padding:8px;border:1px solid #e6e9ee;text-align:right;vertical-align:middle">₹${Number(item.subtotal).toFixed(2)}</td>`;
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);

    // Totals & payment area
    const summary = document.createElement('div');
    summary.style.display = 'flex';
    summary.style.justifyContent = 'space-between';
    summary.style.marginTop = '12px';
    summary.style.alignItems = 'flex-start';

    const leftNotes = document.createElement('div');
    leftNotes.style.width = '60%';
    leftNotes.innerHTML = `<div style="font-size:12px;color:#475569">Thank you for shopping with Engal Santhai. Please verify payment and preserve this bill for your records.</div>`;
    summary.appendChild(leftNotes);

    const rightTotals = document.createElement('div');
    rightTotals.style.width = '36%';
    rightTotals.style.border = '1px solid #e6e9ee';
    rightTotals.style.padding = '8px';
    rightTotals.style.borderRadius = '6px';
    rightTotals.innerHTML = `<div style="display:flex;justify-content:space-between;font-weight:700;margin-bottom:6px"><div>SUBTOTAL</div><div>₹${Number(calculatedTotal).toFixed(2)}</div></div>
      <div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px"><div>TOTAL</div><div>₹${Number(calculatedTotal).toFixed(2)}</div></div>`;
    summary.appendChild(rightTotals);

    container.appendChild(summary);

    // Payment block
    if (selectedUpiId) {
      const upi = UPI_IDS.find(u => u.id === selectedUpiId);
      if (upi) {
        const payDiv = document.createElement('div');
        payDiv.style.marginTop = '12px';
        payDiv.style.padding = '10px';
        payDiv.style.borderRadius = '6px';
        payDiv.style.background = '#f8fafc';
        payDiv.style.border = '1px solid #e6eef4';
        payDiv.innerHTML = `<div style="font-weight:700;margin-bottom:6px">PAYMENT INFORMATION</div>
          <div style="margin-bottom:4px">Payee Name: ${upi.name}</div>
          <div style="margin-bottom:4px">UPI ID: ${upi.displayName}</div>
          <div>Amount: Rs. ${Number(calculatedTotal).toFixed(2)}</div>`;
        container.appendChild(payDiv);
      }
    }

    // Attach a simple inlined link to google fonts (so html2canvas can use it if available)
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil&display=swap';
    fontLink.rel = 'stylesheet';
    container.appendChild(fontLink);

    // attach to body hidden, but visible to html2canvas
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);

    // small delay to allow webfont to load
    await new Promise((res) => setTimeout(res, 250));

    return container;
  };

  // ---- END NEW HELPERS ----

  const generateBillPdfBlobAndFilename = async (): Promise<{ blob: Blob; filename: string }> => {
    const { jsPDF } = window.jspdf;
    // Use A4 portrait (units in mm)
    const pdfDoc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    const pageWidth = pdfDoc.internal.pageSize.getWidth();
    const pageHeight = pdfDoc.internal.pageSize.getHeight();

    const ITEMS_PER_PAGE = 22; // Slightly fewer because of nicer spacing
    const totalPages = Math.max(1, Math.ceil(editedItems.length / ITEMS_PER_PAGE));

    // Extract employee ID from bill's customer information for PDF
    let employeeId = 'N/A';
    try {
      if (bill.customerId) {
        try {
          const userRef = doc(db, 'users', bill.customerId);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const userData = userDoc.data() as any;
            employeeId = userData.employee?.employeeId || userData.employeeId || bill.customerId;
          } else {
            employeeId = bill.customerId;
          }
        } catch (fetchError) {
          console.warn('Could not fetch user data for employee ID, using customerId:', fetchError);
          employeeId = bill.customerId;
        }
      } else if (bill.customerName) {
        if (bill.customerName.includes('@')) {
          employeeId = bill.customerName.split('@')[0];
        } else {
          employeeId = bill.customerName;
        }
      }
      if (employeeId && employeeId !== 'N/A') {
        if (employeeId.includes('@')) employeeId = employeeId.split('@')[0];
        if (employeeId.length > 15 && /^[a-zA-Z0-9]+$/.test(employeeId)) {
          employeeId = employeeId.substring(0, 10).toUpperCase();
        } else {
          employeeId = employeeId.toUpperCase().trim();
        }
      }
    } catch (error) {
      console.error('Error extracting employee ID for PDF:', error);
      employeeId = 'N/A';
    }

    // Format bill number as ESDDMMYYYY-001 and file name parts
    const billDateObj = new Date(bill.date);
    const dd = String(billDateObj.getDate()).padStart(2, '0');
    const mm = String(billDateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = billDateObj.getFullYear();
    let serial = '001';
    const idMatch = bill.id.match(/(\d{3,})$/);
    if (idMatch) serial = idMatch[1].slice(-3).padStart(3, '0');
    const formattedBillNumber = `ES${dd}${mm}${yyyy}-${serial}`;

    // Build pages (same as Download)
    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
      if (pageNum > 0) pdfDoc.addPage();
      let y = 20;

      pdfDoc.setFont('helvetica', 'bold');
      pdfDoc.setFontSize(20);
      pdfDoc.text('Engal Santhai', pageWidth / 2, y, { align: 'center' });
      y += 8;

      pdfDoc.setFont('helvetica', 'normal');
      pdfDoc.setFontSize(11);
      pdfDoc.text('Your Fresh Vegetable Partner', pageWidth / 2, y, { align: 'center' });
      y += 15;

      pdfDoc.setFont('helvetica', 'bold');
      pdfDoc.setFontSize(12);
      pdfDoc.text('INVOICE', 14, y);
      y += 8;

      const billDate = new Date(bill.date);
      const dateStr = billDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = billDate
        .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        .toLowerCase();

      pdfDoc.setFont('helvetica', 'normal');
      pdfDoc.text(`BILL NO: ${formattedBillNumber}`, 14, y);
      pdfDoc.text(`Date: ${dateStr}`, pageWidth - 14, y, { align: 'right' });
      y += 6;
  const safeCustomerName = sanitizeTextForPdf(customerNameFromDB || bill.customerName);
  pdfDoc.text(`CUSTOMER NAME : ${safeCustomerName}`, 14, y);
      pdfDoc.text(`Time: ${timeStr}`, pageWidth - 14, y, { align: 'right' });
      y += 6;
      pdfDoc.text(`EMP ID: ${employeeId}`, 14, y);
      y += 10;

      const startX = 14;
      const endX = pageWidth - 14;
      const colSNo = startX;
      const colItem = startX + 20;
      const colQty = startX + 90;
      const colRate = startX + 130;
      const colAmount = endX;

      pdfDoc.setLineWidth(0.2);
      pdfDoc.line(startX, y, endX, y);
      y += 6;
      pdfDoc.setFont('helvetica', 'bold');
      pdfDoc.text('S.No.', colSNo, y);
      pdfDoc.text('Item', colItem, y);
      pdfDoc.text('Qty (kg)', colQty, y, { align: 'right' });
      pdfDoc.text('Rate (Rs.)', colRate, y, { align: 'right' });
      pdfDoc.text('Amount (Rs.)', colAmount, y, { align: 'right' });
      y += 2;
      pdfDoc.line(startX, y, endX, y);
      y += 6;

      const startIdx = pageNum * ITEMS_PER_PAGE;
      const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, editedItems.length);
      const pageItems = editedItems.slice(startIdx, endIdx);
      pdfDoc.setFont('courier', 'normal');
      pageItems.forEach((item, pageIndex) => {
        const vegetable = combinedVegetableMap.get(item.vegetableId);
        const globalSerialNo = startIdx + pageIndex + 1;
        const rawName = (item as any).name || vegetable?.name || 'Unknown';
        const name = sanitizeTextForPdf(rawName) || 'Unknown';
        const qty = String(item.quantityKg);
        const rate = String((item as any).pricePerKg || vegetable?.pricePerKg || 0);
        const amount = String(item.subtotal);
        pdfDoc.text(globalSerialNo.toString(), colSNo, y);
        pdfDoc.text(name, colItem, y);
        pdfDoc.text(qty, colQty, y, { align: 'right' });
        pdfDoc.text(rate, colRate, y, { align: 'right' });
        pdfDoc.text(amount, colAmount, y, { align: 'right' });
        y += 6;
      });

      pdfDoc.line(startX, y, endX, y);
      y += 10;
      if (pageNum === totalPages - 1) {
        pdfDoc.setFont('helvetica', 'bold');
        pdfDoc.setFontSize(12);
        pdfDoc.text('TOTAL:', colRate, y);
        pdfDoc.text(`Rs. ${Number(calculatedTotal).toFixed(2)}`, colAmount, y, { align: 'right' });
        y += 15;
        if (selectedUpiId) {
          const selectedUpi = UPI_IDS.find((upi) => upi.id === selectedUpiId);
          if (selectedUpi) {
            pdfDoc.line(startX, y - 5, endX, y - 5);
            y += 5;
            pdfDoc.setFont('helvetica', 'bold');
            pdfDoc.setFontSize(11);
            pdfDoc.text('PAYMENT INFORMATION', startX, y);
            y += 8;
            pdfDoc.setFont('helvetica', 'normal');
            pdfDoc.setFontSize(10);
            pdfDoc.text(`Payee Name: ${selectedUpi.name}`, startX, y);
            y += 5;
            pdfDoc.text(`UPI ID: ${selectedUpi.displayName}`, startX, y);
            y += 5;
            pdfDoc.text(`Amount: Rs. ${Number(calculatedTotal).toFixed(2)}`, startX, y);
            y += 8;
            pdfDoc.setFont('helvetica', 'italic');
            pdfDoc.setFontSize(9);
            pdfDoc.text('• Scan the QR code for instant payment', startX, y);
            y += 4;
            pdfDoc.text('• Use any UPI app like GPay, PhonePe, or Paytm', startX, y);
            y += 4;
            pdfDoc.text('• Payment confirmation required for order processing', startX, y);
          }
        }
      }
    }

    // Build filename in the requested format: serialnumber-date-name-department
    const rawName = (customerNameFromDB || bill.customerName || 'customer').toString();
    const rawDept = (bill.department || 'NA').toString();
    const sanitize = (s: string) => s.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '').replace(/_+/g, '_');
    const nameSafe = sanitize(rawName).toUpperCase() || 'CUSTOMER';
    const deptSafe = sanitize(rawDept).toUpperCase() || 'NA';
    const fileSerial = (serial || '000');
    const fileDate = `${dd}${mm}${yyyy}`;
    const filename = `${fileSerial}-${fileDate}-${nameSafe}-${deptSafe}.pdf`;

    // Decide whether to use text-based jsPDF (searchable) or raster fallback (html2canvas) because of emojis
    const useRasterFallback = billHasEmoji();

    // If NOT using raster fallback, we embed and use the NotoSansTamil font so Tamil text is searchable
    if (!useRasterFallback) {
      try {
        // Ensure font is available via the external js font file you imported
        // The imported file should have added the font under the name 'NotoSansTamil'
        // We attempt to set the font; if not available, fallback to helvetica.
        try {
          pdfDoc.setFont('NotoSansTamil');
        } catch (e) {
          // Some builds require adding font explicitly; if external font didn't already add it,
          // we gracefully fallback to helvetica so generation won't crash.
          console.warn('NotoSansTamil font unavailable in jsPDF VFS, falling back to helvetica for generation:', e);
          pdfDoc.setFont('helvetica');
        }

        // Build pages (text-based) with improved visual layout
        for (let pageNum = 0; pageNum < totalPages; pageNum++) {
          if (pageNum > 0) pdfDoc.addPage();
          
          // Light-green header bar
          const headerHeight = 18;
          // Draw gradient-like rectangle (jsPDF doesn't support gradient natively; we use a solid soft green)
          pdfDoc.setFillColor(198, 246, 213); // #c6f6d5 light
          pdfDoc.rect(10, 10, pageWidth - 20, headerHeight, 'F');
          pdfDoc.setTextColor(6, 78, 59); // dark green for text

          // Title
          pdfDoc.setFontSize(18);
          pdfDoc.setFont(undefined, 'bold');
          pdfDoc.text('Engal Santhai', pageWidth / 2, 24, { align: 'center' });

          pdfDoc.setFontSize(10);
          pdfDoc.setFont(undefined, 'normal');
          pdfDoc.text('Your Fresh Vegetable Partner', pageWidth / 2, 29, { align: 'center' });

          // Invoice label
          pdfDoc.setFontSize(12);
          pdfDoc.setFont(undefined, 'bold');
          pdfDoc.text('INVOICE', 14, 42);

          // Bill meta
          const dateStr = billDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
          const timeStr = billDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();

          pdfDoc.setFontSize(10);
          pdfDoc.setFont(undefined, 'normal');
          pdfDoc.text(`BILL NO: ${formattedBillNumber}`, 14, 50);
          pdfDoc.text(`Date: ${dateStr}`, pageWidth - 14, 50, { align: 'right' });

          pdfDoc.text(`CUSTOMER NAME : ${customerNameFromDB || bill.customerName}`, 14, 56);
          pdfDoc.text(`Time: ${timeStr}`, pageWidth - 14, 56, { align: 'right' });

          pdfDoc.text(`EMP ID: ${employeeId}`, 14, 64);

          // Table headings
          const startX = 14;
          let y = 74;
          const endX = pageWidth - 14;
          const colSNo = startX;
          const colItem = startX + 18;
          const colQty = startX + 96;
          const colRate = startX + 126;
          const colAmount = endX;

          // header line
          pdfDoc.setDrawColor(226, 229, 238);
          pdfDoc.setLineWidth(0.4);
          pdfDoc.line(startX, y - 6, endX, y - 6);

          pdfDoc.setFont(undefined, 'bold');
          pdfDoc.setFontSize(10);
          pdfDoc.text('S.No.', colSNo, y);
          pdfDoc.text('Item', colItem, y);
          pdfDoc.text('Qty (kg)', colQty, y, { align: 'right' });
          pdfDoc.text('Rate (Rs.)', colRate, y, { align: 'right' });
          pdfDoc.text('Amount (Rs.)', colAmount, y, { align: 'right' });

          y += 6;
          pdfDoc.setLineWidth(0.2);
          pdfDoc.line(startX, y, endX, y);
          y += 8;

          // Items
          const startIdx = pageNum * ITEMS_PER_PAGE;
          const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, editedItems.length);
          const pageItems = editedItems.slice(startIdx, endIdx);

          pdfDoc.setFont('NotoSansTamil', 'normal');
          pdfDoc.setFontSize(10);
          pageItems.forEach((item, pageIndex) => {
            const vegetable = combinedVegetableMap.get(item.vegetableId);
            const globalSerialNo = startIdx + pageIndex + 1;
            const name = (item as any).name || vegetable?.name || 'Unknown';
            const qty = String(item.quantityKg);
            const rate = String((item as any).pricePerKg || vegetable?.pricePerKg || 0);
            const amount = String(item.subtotal);

            // Wrap item name if longer than allowed width
            const maxItemWidth = colQty - colItem - 4;
            const splitName = pdfDoc.splitTextToSize(name, maxItemWidth);
            const lineCount = splitName.length;

            pdfDoc.text(globalSerialNo.toString(), colSNo, y);
            pdfDoc.text(splitName, colItem, y);
            pdfDoc.text(qty, colQty, y, { align: 'right' });
            pdfDoc.text((Number(rate) ? `₹${Number(rate).toFixed(2)}` : '₹0.00'), colRate, y, { align: 'right' });
            pdfDoc.text(`₹${Number(amount).toFixed(2)}`, colAmount, y, { align: 'right' });

            y += lineCount * 6;
            // If next item would overflow page, add new page
            if (y > pageHeight - 50) {
              // ensure loop stops for current page
            }
          });

          // Footer totals on last page
          if (pageNum === totalPages - 1) {
            pdfDoc.setLineWidth(0.4);
            pdfDoc.line(startX, pageHeight - 60, endX, pageHeight - 60);

            pdfDoc.setFont(undefined, 'bold');
            pdfDoc.setFontSize(12);
            pdfDoc.text('TOTAL:', colRate, pageHeight - 50);
            pdfDoc.text(`Rs. ${Number(calculatedTotal).toFixed(2)}`, colAmount, pageHeight - 50, { align: 'right' });

            // Payment box
            if (selectedUpiId) {
              const selectedUpi = UPI_IDS.find((upi) => upi.id === selectedUpiId);
              if (selectedUpi) {
                const boxY = pageHeight - 40;
                pdfDoc.setDrawColor(230, 238, 238);
                pdfDoc.rect(startX, boxY, endX - startX, 28, 'S');
                pdfDoc.setFontSize(10);
                pdfDoc.setFont(undefined, 'bold');
                pdfDoc.text('PAYMENT INFORMATION', startX + 2, boxY + 7);
                pdfDoc.setFont(undefined, 'normal');
                pdfDoc.setFontSize(9);
                pdfDoc.text(`Payee Name: ${selectedUpi.name}`, startX + 2, boxY + 12);
                pdfDoc.text(`UPI ID: ${selectedUpi.displayName}`, startX + 2, boxY + 17);
                pdfDoc.text(`Amount: Rs. ${Number(calculatedTotal).toFixed(2)}`, startX + 2, boxY + 22);
              }
            }
          }
        }

        // Build blob
        const blob = pdfDoc.output('blob');
        return { blob, filename };
      } catch (err) {
        console.error('Error generating text-based PDF:', err);
        // Fall back to raster fallback if anything goes wrong
      }
    }

    // Raster fallback path (html2canvas) - used when emojis present or text-based path failed
    try {
      // Create printable DOM element and render to canvas
      const element = await createPrintableBillElement();
      // Use a larger scale for better resolution
      const scale = 2;
      const canvas = await html2canvas(element as HTMLElement, {
        scale,
        useCORS: true,
        logging: false,
        scrollY: -window.scrollY
      });

      // Remove temporary element
      try { document.body.removeChild(element); } catch(e) {}

      const imgData = canvas.toDataURL('image/png');

      const imgProps = (pdfDoc as any).getImageProperties(imgData);
      const imgWidth = pageWidth;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

      let heightLeft = imgHeight;
      let position = 0;

      // add first page
      pdfDoc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        pdfDoc.addPage();
        position = heightLeft - imgHeight;
        // when slicing, place the same full image with negative y to shift (works cross-browser)
        pdfDoc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const blob = pdfDoc.output('blob');
      return { blob, filename };
    } catch (rasterErr) {
      console.error('Raster fallback also failed:', rasterErr);
      // As a final fallback, attempt a simple minimal PDF with the filename and a message
      try {
        const fallbackPdf = new jsPDF();
        fallbackPdf.text('Unable to generate bill PDF. Please contact support.', 10, 10);
        const blob = fallbackPdf.output('blob');
        return { blob, filename };
      } catch (finalErr) {
        console.error('Final fallback failed:', finalErr);
        throw new Error('PDF generation failed.');
      }
    }
  };
  // Copy generated PDF to clipboard as a file (so user can paste into WhatsApp Web/Desktop)
 

  const handleDownload = async () => {
    const { blob, filename } = await generateBillPdfBlobAndFilename();
    // Create a temporary link to download the blob
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Helper to normalize phone number to international format for WhatsApp
  const normalizePhoneForWhatsApp = (raw: string | undefined | null): string | null => {
    if (!raw) return null;
    let digits = raw.replace(/\D/g, '');
    if (!digits) return null;

    // Remove leading zeros
    while (digits.startsWith('0')) digits = digits.replace(/^0+/, '');

    // If it already starts with country code (length > 10), assume it's fine
    if (digits.length > 10) {
      return digits;
    }

    // If it's exactly 10 digits, assume India and prefix 91
    if (digits.length === 10) {
      return `91${digits}`;
    }

    // Otherwise return digits as-is
    return digits;
  };

  // Share current edited bill as PDF via system share sheet or WhatsApp fallback
  

const handleShare = async () => {
  try {
    if (hasUnsavedChanges) {
      console.log("💾 Unsaved changes detected — saving before sharing...");
      await handleSaveChanges();
    }

    console.log("🚀 Starting WhatsApp share process...");

    // 🕓 Wait for customerNameFromDB to be ready (max 1 second)
    let employeeNameToQuery =
      billTyped?.employee_name || customerNameFromDB || bill.customerName || "";
    let retries = 0;
    while (
      (!employeeNameToQuery || employeeNameToQuery === "Unknown Customer") &&
      retries < 5
    ) {
      console.log("⏳ Waiting for customerNameFromDB to load...");
      await new Promise((res) => setTimeout(res, 200)); // wait 200ms
      employeeNameToQuery =
        billTyped?.employee_name || customerNameFromDB || bill.customerName || "";
      retries++;
    }

    console.log("🔍 Querying Firestore for employee_name:", employeeNameToQuery);

    let phoneNumber: string | null = null;

    if (employeeNameToQuery.trim()) {
      try {
        const usersRef = collection(db, "users");

        // Query 1: by employee_name
        const q1 = query(usersRef, where("employee_name", "==", employeeNameToQuery));
        const snap1 = await getDocs(q1);
        console.log(`📊 Query by employee_name returned ${snap1.size} results`);

        let userData: any = null;

        if (!snap1.empty) {
          userData = snap1.docs[0].data();
          console.log("✅ Found user (by employee_name):", userData);
        } else {
          // Fallback: query by name
          const q2 = query(usersRef, where("name", "==", employeeNameToQuery));
          const snap2 = await getDocs(q2);
          console.log(`📊 Query by name returned ${snap2.size} results`);
          if (!snap2.empty) {
            userData = snap2.docs[0].data();
            console.log("✅ Found user (by name):", userData);
          } else {
            console.warn("⚠️ No user found for:", employeeNameToQuery);
          }
        }

        if (userData) {
          // Handle multiple possible phone field names
          phoneNumber =
            String(
              userData.phone ||
                userData.mobile ||
                userData.contact ||
                userData.phoneNumber ||
                ""
            ) || null;
        }
      } catch (queryErr) {
        console.error("🔥 Firestore query error:", queryErr);
      }
    }

    if (!phoneNumber) {
      console.warn("⚠️ No phone number found — will fallback to default share method");
    } else {
      console.log("📞 Raw phone number from Firestore:", phoneNumber);
    }

    const normalized = normalizePhoneForWhatsApp(phoneNumber);
    console.log("📱 Normalized phone for WhatsApp:", normalized);

    // ✅ Generate bill PDF and upload to Firebase Storage
    let downloadURL: string | null = null;
    try {
      const { blob, filename } = await generateBillPdfBlobAndFilename();
      const storage = getStorage();
      const pdfRef = ref(
        storage,
        `bills/${(bill as any).billNumber || bill.id || Date.now()}.pdf`
      );
      await uploadBytes(pdfRef, blob);
      const rawURL = await getDownloadURL(pdfRef);
      // Append &dl=1 for auto-download
      downloadURL = rawURL + (rawURL.includes("?") ? "&dl=1" : "?dl=1");

      console.log("☁️ Uploaded PDF to Firebase Storage:", downloadURL);
    } catch (pdfErr) {
      console.warn("⚠️ PDF upload failed:", pdfErr);
    }

    // ✅ Create WhatsApp message
    const message = `Hello ${
      customerNameFromDB || bill.customerName
    },\n\nYour Engal Santhai bill is ready.\nTotal: ₹${Number(
      calculatedTotal
    ).toFixed(2)}\n📄 Download your E-bill here: ${
      downloadURL || "Please find your bill attached."
    }\n\nThank you for shopping with us!`;

    // ✅ Copy message to clipboard as backup
    try {
      await navigator.clipboard.writeText(message);
      console.log("📋 Copied message text to clipboard as backup.");
    } catch (clipErr) {
      console.warn("⚠️ Clipboard write failed:", clipErr);
    }

    // ✅ Open WhatsApp chat
    const waUrl = normalized
      ? `https://wa.me/${encodeURIComponent(
          normalized
        )}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    console.log("🌐 Opening WhatsApp URL:", waUrl);
    window.open(waUrl, "_blank");

    // ✅ Try sharing file natively (optional mobile support)
    try {
      const { blob, filename } = await generateBillPdfBlobAndFilename();
      const file = new File([blob], filename, { type: "application/pdf" });
      if (
        (navigator as any).share &&
        (navigator as any).canShare?.({ files: [file] })
      ) {
        console.log("📤 Sharing file using native share API...");
        await (navigator as any).share({
          title: "Engal Santhai Bill",
          text: message,
          files: [file],
        });
      } else {
        console.log("ℹ️ Native share API not supported, opened WhatsApp instead.");
      }
    } catch (shareErr) {
      console.warn("⚠️ Native share API failed:", shareErr);
    }

  } catch (err) {
    console.error("❌ handleShare failed:", err);
    alert("Unable to open WhatsApp. Please try downloading and sending manually.");
  }
};
 




  return (
    <>
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in-down"
    >
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b bg-slate-50 rounded-t-lg">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Bill Details</h2>
              {hasUnsavedChanges && (
                <p className="text-sm text-amber-600 font-medium">• Unsaved changes</p>
              )}
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200">
                <XMarkIcon className="h-6 w-6 text-slate-600" />
            </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                    <p className="text-sm text-slate-500">Bill Number</p>
                    <p className="font-mono text-sm text-slate-800">{(() => {
                      const billDateObj = new Date(bill.date);
                      const dd = String(billDateObj.getDate()).padStart(2, '0');
                      const mm = String(billDateObj.getMonth() + 1).padStart(2, '0');
                      const yyyy = billDateObj.getFullYear();
                      let serial = '001';
                      const idMatch = bill.id.match(/(\d{3,})$/);
                      if (idMatch) {
                        serial = idMatch[1].slice(-3).padStart(3, '0');
                      }
                      return `ES${dd}${mm}${yyyy}-${serial}`;
                    })()}</p>
                </div>
                <div>
                    <p className="text-sm text-slate-500">Customer Name</p>
                    <p className="font-semibold text-slate-800">{customerNameFromDB || bill.customerName}</p>
                </div>
                <div>
                    <p className="text-sm text-slate-500">Date</p>
                    <p className="font-semibold text-slate-800">{new Date(bill.date).toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-sm text-slate-500">Payment Screenshot</p>
                    {bill.paymentScreenshot ? (
                        <button 
                            onClick={() => setIsImagePreviewOpen(true)} 
                            className="text-sm font-semibold text-primary-600 hover:underline flex items-center"
                        >
                            <EyeIcon className="h-4 w-4 mr-1"/> View Screenshot
                        </button>
                    ) : (
                        <p className="text-sm text-slate-400">Not provided</p>
                    )}
                </div>
            </div>

         <div className="border-t border-slate-200 pt-4">
         <h3 className="text-lg font-bold text-slate-800 mb-2">Order Items</h3>
         <p className="text-xs text-slate-500 mb-2">Reference checkboxes: optional, for your reference only (not required and not saved by default).</p>
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-500">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                        <tr>
              <th scope="col" className="px-2 py-2 w-8 text-center"> </th>
                            <th scope="col" className="px-2 py-2 w-12 text-center">S.No.</th>
                            <th scope="col" className="px-4 py-2">Item</th>
                            <th scope="col" className="px-4 py-2 text-right">Qty (kg)</th>
                            <th scope="col" className="px-4 py-2 text-right">Rate</th>
                            <th scope="col" className="px-4 py-2 text-right">Subtotal</th>
                            <th scope="col" className="px-4 py-2 text-center">Action</th>
                        </tr>
                        </thead>
                        <tbody>
                            {editedItems.map((item, index) => {
                                const checkKey = `${item.vegetableId}::${index}`;
                                const vegetable = combinedVegetableMap.get(item.vegetableId);
                                return (
                                    <tr key={index} className="bg-white border-b last:border-0">
                                        <td className="px-2 py-3 text-center">
                                          <input
                                            type="checkbox"
                                            checked={!!itemChecks[checkKey]}
                                            onChange={() => setItemChecks(prev => ({ ...prev, [checkKey]: !prev[checkKey] }))}
                                            className="h-4 w-4 text-primary-600 rounded"
                                            aria-label={`Reference checkbox for item ${index + 1}`}
                                          />
                                        </td>
                                        <td className="px-2 py-3 text-center font-medium text-slate-700">
                                            {index + 1}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-900">
                                            {isLoadingVegetables && !vegetable ? (
                                              <div className="flex items-center">
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                                                Loading...
                                              </div>
                                            ) : (
                                              <>
                                                {vegetable?.name || `Item ${item.vegetableId}`}
                                                {!vegetable && !isLoadingVegetables && (
                                                  <div className="text-xs text-amber-600 mt-1">
                                                    ⚠️ Using calculated price: ₹{(item.subtotal / item.quantityKg).toFixed(2)}/kg
                                                  </div>
                                                )}
                                              </>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <input
                                                type="number"
                                                value={item.quantityKg}
                                                onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)}
                                                className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 font-medium text-slate-900"
                                                min="0"
                                                step="0.25"
                                                onFocus={(e) => e.target.select()}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {(() => {
                                              if (vegetable) {
                                                return `₹${Number(vegetable.pricePerKg).toFixed(2)}`;
                                              } else if (item.pricePerKg) {
                                                return `₹${Number(item.pricePerKg).toFixed(2)}`;
                                              } else if (item.quantityKg > 0) {
                                                const calculatedPrice = item.subtotal / item.quantityKg;
                                                return `₹${Number(calculatedPrice).toFixed(2)}`;
                                              } else {
                                                return '₹0.00';
                                              }
                                            })()}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-primary-600">₹{Number(item.subtotal).toFixed(2)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => handleRemoveVegetable(item.vegetableId)}
                                                className="text-red-600 hover:text-red-800 font-semibold px-2 py-1 rounded hover:bg-red-50"
                                                title="Remove item"
                                            >
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                 </div>
            </div>

            {/* Add Vegetables Section */}
            <div className="border-t border-slate-200 pt-4 mt-4">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-slate-800">Add Vegetables</h4>
                    <Button
                        onClick={() => setShowAddVegetables(!showAddVegetables)}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2"
                    >
                        {showAddVegetables ? 'Hide' : 'Add Items'}
                    </Button>
                </div>
                
                {showAddVegetables && (
                    <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                        {getAvailableVegetables().length > 0 ? (
                            getAvailableVegetables().map(veg => (
                                <VegetableAddRow
                                    key={veg.id}
                                    vegetable={veg}
                                    onAdd={(quantity) => {
                                        handleAddVegetable(veg.id, quantity);
                                        setShowAddVegetables(false);
                                    }}
                                />
                            ))
                        ) : (
                            <p className="text-slate-500 text-center py-4">All available vegetables are already in this order</p>
                        )}
                    </div>
                )}
            </div>

            {/* Bag Management Section - Moved to user page */}

            {/* UPI Selection Section */}
            <div className="mt-6 pt-4 border-t-2 border-slate-200">
                <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg mb-4">
                    <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center">
                        💳 Select UPI ID for Payment
                    </h3>
                    <p className="text-sm text-slate-600">Choose a UPI ID to generate the payment QR code and download the bill</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {UPI_IDS.map((upi) => (
                        <div 
                            key={upi.id}
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                selectedUpiId === upi.id 
                                    ? 'border-green-500 bg-green-50' 
                                    : 'border-slate-300 hover:border-slate-400'
                            }`}
                            onClick={() => setSelectedUpiId(upi.id)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="font-medium text-slate-800">{upi.name}</p>
                                    <p className="text-sm text-slate-600">{upi.displayName}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            copyUpiId(upi.id);
                                        }}
                                        className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded text-slate-600"
                                        title="Copy UPI ID"
                                    >
                                        Copy
                                    </button>
                                    <div className={`w-4 h-4 rounded-full border-2 ${
                                        selectedUpiId === upi.id 
                                            ? 'border-green-500 bg-green-500' 
                                            : 'border-slate-300'
                                    }`}>
                                        {selectedUpiId === upi.id && (
                                            <div className="w-full h-full rounded-full bg-white scale-50"></div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                
                {/* Show selected UPI QR Code */}
                {selectedUpiId ? (
                    <div className="bg-slate-50 p-6 rounded-lg">
                        <div className="text-center">
                            <p className="text-sm font-medium text-slate-700 mb-3">
                                Payment QR Code for: {UPI_IDS.find(upi => upi.id === selectedUpiId)?.displayName}
                            </p>
                            <div className="inline-block p-4 bg-white rounded-lg shadow-sm">
                                <img 
                                    src={upiPng} 
                                    alt="UPI QR Code" 
                                    className="w-32 h-32 mx-auto rounded border" 
                                />
                            </div>
              <p className="text-xs text-slate-500 mt-2">
                Scan this QR code to pay ₹{Number(calculatedTotal).toFixed(2)}
              </p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                        <div className="text-center">
                            <p className="text-sm text-amber-700">
                                Please select a UPI ID above to view the payment QR code
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-200">
                <div className="flex gap-3">
                    <Button 
                        onClick={handleSaveChanges} 
                        disabled={!hasUnsavedChanges || isSaving}
                        className={`${hasUnsavedChanges ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-400 cursor-not-allowed'} text-white`}
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
          <Button 
            onClick={handleShare}
            className={`bg-primary-600 hover:bg-primary-700 text-white`}
            title={'Share bill via WhatsApp or other apps'}
          >
            <ShareIcon className="h-5 w-5 mr-2" />
            Share
          </Button>
                    
                    
<Button 
                        onClick={handleDownload} 
                        disabled={!selectedUpiId}
                        className={`${selectedUpiId ? 'bg-slate-600 hover:bg-slate-700' : 'bg-slate-400 cursor-not-allowed'}`}
                        title={!selectedUpiId ? 'Please select a UPI ID first' : ''}
                    >
                        <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                        Download Bill
                    </Button>
                </div>
                <div className="text-right">
                    <p className="text-sm text-slate-500">Total Amount</p>
          <p className="text-2xl font-bold text-slate-800">₹{Number(calculatedTotal).toFixed(2)}</p>
          {Number(calculatedTotal) !== Number(bill.total) && (
            <p className="text-xs text-slate-500 mt-1">
              Original: ₹{Number(bill.total).toFixed(2)}
            </p>
          )}
                </div>
            </div>
        </div>
      </div>
    </div>
    <ImagePreviewModal 
        isOpen={isImagePreviewOpen} 
        onClose={() => setIsImagePreviewOpen(false)} 
        imageUrl={bill.paymentScreenshot || ''} 
    />
    </>
  );
};

// Component for adding vegetables to the order
interface VegetableAddRowProps {
  vegetable: Vegetable;
  onAdd: (quantity: number) => void;
}

const VegetableAddRow: React.FC<VegetableAddRowProps> = ({ vegetable, onAdd }) => {
  const [quantity, setQuantity] = useState(0.25);

  const handleAdd = () => {
    if (quantity > 0) {
      onAdd(quantity);
      setQuantity(0.25); // Reset to default
    }
  };

  return (
    <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-slate-200">
      <div className="flex items-center gap-3">
        <div>
          <h5 className="font-medium text-slate-800">{vegetable.name}</h5>
          <p className="text-sm text-slate-600">₹{vegetable.pricePerKg}/kg</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setQuantity(Math.max(0.25, quantity - 0.25))}
            className="w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-sm font-semibold"
            disabled={quantity <= 0.25}
          >
            -
          </button>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(0.25, parseFloat(e.target.value) || 0.25))}
            className="w-16 text-center border border-slate-300 rounded px-2 py-1 text-sm"
            min="0.25"
            step="0.25"
          />
          <button
            onClick={() => setQuantity(quantity + 0.25)}
            className="w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-sm font-semibold"
          >
            +
          </button>
          <span className="text-sm text-slate-500">kg</span>
        </div>
        
        <Button
          onClick={handleAdd}
          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-sm"
        >
          Add ₹{(quantity * vegetable.pricePerKg).toFixed(2)}
        </Button>
      </div>
    </div>
  );
};

export default BillDetailModal;
