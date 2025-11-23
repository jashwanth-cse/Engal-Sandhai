/* src/components/BillDetailModal.tsx */
/* Cleaned, fixed, and optimistic version of your original file.
   - All original imports preserved.
   - Syntax/logic fixes applied.
   - Keep backups of your previous file before replacing.
*/

import React, { useState, useEffect } from 'react';
import type { Bill, Vegetable, BillItem } from '../../types/types';
import { XMarkIcon, EyeIcon, ArrowDownTrayIcon, ShareIcon } from './ui/Icon.tsx';
import ImagePreviewModal from './ui/ImagePreviewModal.tsx';
import Button from './ui/Button.tsx';
import { getVegetableById, getDateKey } from '../services/dbService';
import { roundTotal } from '../utils/roundUtils';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Firestore imports
import { doc, getDoc, writeBatch, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { compressPdf } from '../utils/pdfCompressor.ts';

// New import: html2canvas for emoji fallback raster rendering
import html2canvas from 'html2canvas';

// IMPORTANT: External js font file generated via jsPDF fontconverter.
// Put your generated file at src/fonts/NotoSansTamil-Regular.js
// That file should call jsPDF.API.events.push([...]) and add the font to VFS
import '../fonts/NotoSansTamil-Regular.js';
import PaymentQR from "../assets/paymentQR.jpg";

// Let TypeScript know that jspdf is available on the window object
declare global {
  interface Window {
    jspdf: any;
  }
}

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

// Small helper: safe JSON stringify for logs
const safeString = (v: any) => {
  try { return JSON.stringify(v); } catch { return String(v); }
};

// Sanitize: remove emojis, variation selectors, zero-width joiner, but keep Tamil letters and common punctuation.
// This preserves Tamil text while ensuring emojis are stripped (user requested no emojis).
const sanitizeTextForPdf = (input: string | undefined | null): string => {
  if (!input) return '';
  // Remove emoji presentation/extended pictographic (Unicode property), fallback to surrogate pair heuristic
  try {
    // Remove emoji and symbol presentation characters
    const withoutEmoji = input.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
    // Remove variation selectors and ZERO WIDTH JOINER
    return withoutEmoji
      .replace(/\uFE0F/g, '')
      .replace(/\u200D/g, '')
      // Remove private use characters
      .replace(/[\uE000-\uF8FF]/g, '')
      // Collapse whitespace
      .replace(/\s{2,}/g, ' ')
      .trim();
  } catch (e) {
    // Fallback: strip surrogate pairs likely representing emojis
    return input
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
      .replace(/\uFE0F/g, '')
      .replace(/\u200D/g, '')
      .replace(/[\uE000-\uF8FF]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
};

// Emoji detection util (returns true if text contains emoji-like characters)
const containsEmoji = (text: string | undefined | null): boolean => {
  if (!text) return false;
  try {
    return /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(text);
  } catch (e) {
    // fallback surrogate check
    return /[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(text);
  }
};

const BillDetailModal: React.FC<BillDetailModalProps> = ({
  isOpen,
  onClose,
  bill,
  vegetableMap,
  vegetables,
  onUpdateBill,
  currentUser
}) => {
  const billTyped = bill as ExtendedBill | null;

  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [editedItems, setEditedItems] = useState<BillItem[]>([]);
  const [itemChecks, setItemChecks] = useState<Record<string, boolean>>({});
  const [calculatedTotal, setCalculatedTotal] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddVegetables, setShowAddVegetables] = useState(false);
  const [customerNameFromDB, setCustomerNameFromDB] = useState<string>('');
  const [fetchedVegetables, setFetchedVegetables] = useState<Map<string, Vegetable>>(new Map());
  const [isLoadingVegetables, setIsLoadingVegetables] = useState(false);
  const globalVegetableCache = React.useRef<Map<string, Vegetable>>(new Map());
  const [needsRecalculation, setNeedsRecalculation] = useState(false);

  // New: department fetched from DB for accurate file naming and header printing
  const [customerDeptFromDB, setCustomerDeptFromDB] = useState<string>('');
const [isSharing, setIsSharing] = useState(false);
  const [selectedUpiId, setSelectedUpiId] = useState<string>('');

  useEffect(() => {
    if (bill) {
      const itemsCopy = bill.items ? [...bill.items] : [];
      setEditedItems(itemsCopy);
      const checks: Record<string, boolean> = {};
      itemsCopy.forEach((it, idx) => {
        const key = `${it.vegetableId}::${idx}`;
        checks[key] = itemChecks[key] || false;
      });
      setItemChecks(checks);
      setCalculatedTotal(bill.total || 0);
      setHasUnsavedChanges(false);
      setFetchedVegetables(new Map());
      setSelectedUpiId('');
      setNeedsRecalculation(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill?.id]);

  const combinedVegetableMap = React.useMemo(() => {
    const combined = new Map(vegetableMap);
    fetchedVegetables.forEach((veg, id) => combined.set(id, veg));
    return combined;
  }, [vegetableMap, fetchedVegetables]);

  // Fetch missing vegetables in batch (optimized)
  useEffect(() => {
    if (!bill) return;
    let mounted = true;
    const fetchMissingVegetables = async () => {
      setIsLoadingVegetables(true);
      const missingIds: string[] = [];
      const cachedVegetables = new Map<string, Vegetable>();

      for (const item of bill.items) {
        const existing = vegetableMap.get(item.vegetableId)
          || fetchedVegetables.get(item.vegetableId)
          || globalVegetableCache.current.get(item.vegetableId);
        if (!existing) missingIds.push(item.vegetableId);
        else if (globalVegetableCache.current.has(item.vegetableId)) cachedVegetables.set(item.vegetableId, existing);
      }

      if (cachedVegetables.size > 0) setFetchedVegetables(prev => new Map([...prev, ...cachedVegetables]));

      if (missingIds.length === 0) {
        setIsLoadingVegetables(false);
        return;
      }

      const billDate = new Date(bill.date);
      const dateKey = getDateKey(billDate);

      try {
        const promises = missingIds.map(async (vegId) => {
          try {
            let vegetableData = await getVegetableById(vegId);
            if (!vegetableData) {
              const dateBasedRef = doc(db, 'vegetables', dateKey, 'items', vegId);
              const snap = await getDoc(dateBasedRef);
              if (snap.exists()) {
                const data = snap.data();
                vegetableData = {
                  id: snap.id,
                  name: data.name || `Item ${vegId}`,
                  unitType: (data.unitType as 'KG' | 'COUNT') || 'KG',
                  pricePerKg: Number(data.pricePerKg || data.price) || 0,
                  totalStockKg: Number(data.totalStockKg || data.stock || data.totalStock) || 0,
                  stockKg: Number(data.stockKg || data.availableStock) || 0,
                  category: data.category || 'Other'
                };
              }
            }
            if (!vegetableData) {
              const billItem = bill.items.find(it => it.vegetableId === vegId);
              const fallback: Vegetable = {
                id: vegId,
                name: `Item ${vegId.replace('veg_', '').replace(/_/g, ' ').toUpperCase()}`,
                unitType: 'KG',
                pricePerKg: billItem ? (billItem.subtotal / (billItem.quantityKg || 1)) || 0 : 0,
                totalStockKg: 0,
                stockKg: 0,
                category: 'Unknown'
              };
              return { id: vegId, vegetable: fallback };
            }
            return { id: vegId, vegetable: vegetableData };
          } catch (err) {
            console.error('Error fetching veg', vegId, err);
            const billItem = bill.items.find(it => it.vegetableId === vegId);
            const fallback: Vegetable = {
              id: vegId,
              name: `Item ${vegId.replace('veg_', '').replace(/_/g, ' ').toUpperCase()}`,
              unitType: 'KG',
              pricePerKg: billItem ? (billItem.subtotal / (billItem.quantityKg || 1)) || 0 : 0,
              totalStockKg: 0,
              stockKg: 0,
              category: 'Unknown'
            };
            return { id: vegId, vegetable: fallback };
          }
        });

        const results = await Promise.all(promises);
        const missingMap = new Map<string, Vegetable>();
        results.forEach(r => {
          if (r) {
            missingMap.set(r.id, r.vegetable);
            globalVegetableCache.current.set(r.id, r.vegetable);
          }
        });
        if (mounted && missingMap.size > 0) setFetchedVegetables(prev => new Map([...prev, ...missingMap]));
      } catch (err) {
        console.error('Batch veg fetch failed', err);
      } finally {
        if (mounted) setIsLoadingVegetables(false);
      }
    };

    fetchMissingVegetables();
    return () => { mounted = false; };
  }, [bill?.id]);

  // Recalculate items with current prices after vegetables are loaded
  useEffect(() => {
    if (needsRecalculation && !isLoadingVegetables && editedItems.length > 0 && bill) {
      const recalculatedItems = editedItems.map(item => {
        const veg = combinedVegetableMap.get(item.vegetableId);
        if (veg) {
          // Use current price from database
          const newSubtotal = Math.round(item.quantityKg * veg.pricePerKg * 100) / 100;
          return { ...item, subtotal: newSubtotal, pricePerKg: veg.pricePerKg };
        }
        return item;
      });
      
      // Check if any subtotals actually changed
      const hasActualChanges = recalculatedItems.some((item, idx) => 
        item.subtotal !== bill.items[idx]?.subtotal
      );
      
      setEditedItems(recalculatedItems);
      
      if (hasActualChanges) {
        console.log('📊 Recalculated bill items with current prices - changes detected');
        // Auto-save the corrected amounts to database to overwrite old data
        setTimeout(async () => {
          if (onUpdateBill) {
            const finalTotal = recalculatedItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
            const roundedTotal = roundTotal(finalTotal);
            try {
              console.log(`🔄 Overwriting DB with corrected amounts: Old total ₹${bill.total} → New total ₹${roundedTotal}`);
              await onUpdateBill(bill.id, { items: recalculatedItems, total: roundedTotal });
              console.log('✅ Bill amounts auto-corrected and saved to DB');
            } catch (err) {
              console.error('❌ Failed to auto-save corrected amounts:', err);
            }
          }
        }, 500);
      } else {
        console.log('✓ Bill calculations are already correct');
      }
      
      setNeedsRecalculation(false);
    }
  }, [needsRecalculation, isLoadingVegetables, combinedVegetableMap, bill, onUpdateBill]);

  // Recalculate totals
  useEffect(() => {
    const itemsTotal = editedItems.reduce((s, it) => s + (it.subtotal || 0), 0);
    setCalculatedTotal(itemsTotal);

    if (bill) {
      const originalItemsTotal = bill.items.reduce((s, it) => s + (it.subtotal || 0), 0);
      const hasChanges = itemsTotal !== originalItemsTotal ||
        editedItems.some((item, idx) =>
          item.quantityKg !== bill.items[idx]?.quantityKg || item.subtotal !== bill.items[idx]?.subtotal
        );
      setHasUnsavedChanges(hasChanges);
    }
  }, [editedItems, bill]);

  // Get customer key helper
  const getCustomerKeyFromBill = (b: Bill): string | null => {
    const anyBill = b as any;
    if ('customerId' in anyBill && typeof anyBill.customerId === 'string' && anyBill.customerId.trim()) return anyBill.customerId;
    if ('customerUid' in anyBill && typeof anyBill.customerUid === 'string' && anyBill.customerUid.trim()) return anyBill.customerUid;
    if ('customerEmail' in anyBill && typeof anyBill.customerEmail === 'string' && anyBill.customerEmail.trim()) return (anyBill.customerEmail as string).split('@')[0];
    if ('customerPhone' in anyBill && typeof anyBill.customerPhone === 'string' && anyBill.customerPhone.trim()) return anyBill.customerPhone;
    if ('userId' in anyBill && typeof anyBill.userId === 'string' && anyBill.userId.trim()) return anyBill.userId;
    if ('createdBy' in anyBill && typeof anyBill.createdBy === 'string' && anyBill.createdBy.trim()) return anyBill.createdBy;
    return null;
  };

  // Fetch customer name and department from DB
  useEffect(() => {
    if (!bill) return;
    let mounted = true;
    const loadName = async () => {
      setCustomerNameFromDB('');
      setCustomerDeptFromDB('');
      const key = getCustomerKeyFromBill(bill);
      if (!key) return;
      try {
        const userRef = doc(db, 'users', key);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && mounted) {
          const data = userSnap.data() as any;
          setCustomerNameFromDB(data.employee_name || data.name || data.fullName || data.displayName || '');
          const dept =
            data.department ||
            data.dept ||
            data.departmentName ||
            data.employee?.department ||
            '';
          setCustomerDeptFromDB(typeof dept === 'string' ? dept : '');
          return;
        }
        const custRef = doc(db, 'customers', key);
        const custSnap = await getDoc(custRef);
        if (custSnap.exists() && mounted) {
          const data = custSnap.data() as any;
          setCustomerNameFromDB(data.employee_name || data.name || data.fullName || data.displayName || '');
          const dept =
            data.department ||
            data.dept ||
            data.departmentName ||
            data.employee?.department ||
            '';
          setCustomerDeptFromDB(typeof dept === 'string' ? dept : '');
          return;
        }
      } catch (err) {
        console.error('Error loading customer name', err);
      }
      if (mounted) {
        setCustomerNameFromDB('');
        setCustomerDeptFromDB('');
      }
    };
    loadName();
    return () => { mounted = false; };
  }, [bill?.id]);

  if (!isOpen || !bill) return null;

  const handleQuantityChange = (index: number, newQuantity: number) => {
    const current = editedItems[index];
    if (!current) return;
    const veg = combinedVegetableMap.get(current.vegetableId);
    const clamped = Math.max(0, Math.round(newQuantity * 100) / 100);
    const pricePerKg = veg ? veg.pricePerKg : ((current as any).pricePerKg || (current.quantityKg > 0 ? current.subtotal / current.quantityKg : 0));
    const newSubtotal = Math.round(clamped * pricePerKg * 100) / 100;
    const copy = [...editedItems];
    copy[index] = { ...copy[index], quantityKg: clamped, subtotal: newSubtotal, pricePerKg };
    setEditedItems(copy);
    console.log(`📝 Updated item ${index + 1}: ${clamped}kg × ₹${pricePerKg}/kg = ₹${newSubtotal}`);
  };

  const handleAddVegetable = (vegetableId: string, quantity: number) => {
    const veg = combinedVegetableMap.get(vegetableId);
    if (!veg || quantity <= 0) return;
    const idx = editedItems.findIndex(it => it.vegetableId === vegetableId);
    if (idx >= 0) {
      const copy = [...editedItems];
      const newQty = Math.round((copy[idx].quantityKg + quantity) * 100) / 100;
      const newSubtotal = Math.round(newQty * veg.pricePerKg * 100) / 100;
      copy[idx] = { ...copy[idx], quantityKg: newQty, subtotal: newSubtotal, pricePerKg: veg.pricePerKg };
      setEditedItems(copy);
      console.log(`➕ Added ${veg.name}: ${newQty}kg × ₹${veg.pricePerKg}/kg = ₹${newSubtotal}`);
    } else {
      const subtotal = Math.round(quantity * veg.pricePerKg * 100) / 100;
      const ni: BillItem = { vegetableId, quantityKg: quantity, subtotal, pricePerKg: veg.pricePerKg };
      setEditedItems(prev => [...prev, ni]);
      console.log(`✨ New item ${veg.name}: ${quantity}kg × ₹${veg.pricePerKg}/kg = ₹${subtotal}`);
    }
  };

  const handleRemoveVegetable = (vegetableId: string) => {
    setEditedItems(prev => prev.filter(it => it.vegetableId !== vegetableId));
  };

  const getAvailableVegetables = () => {
    return vegetables.filter(v => !editedItems.some(it => it.vegetableId === v.id));
  };

  const updateStockForQuantityChanges = async () => {
    try {
      const stockBatch = writeBatch(db);
      let stockUpdateCount = 0;
      const targetDate = new Date(bill.date);
      const dateKey = getDateKey(targetDate);

      const originalMap = new Map<string, number>();
      bill.items.forEach(it => originalMap.set(it.vegetableId, it.quantityKg));
      const editedMap = new Map<string, number>();
      editedItems.forEach(it => editedMap.set(it.vegetableId, it.quantityKg));

      const allIds = new Set([...originalMap.keys(), ...editedMap.keys()]);

      for (const vegId of allIds) {
        const originalQty = originalMap.get(vegId) || 0;
        const editedQty = editedMap.get(vegId) || 0;
        const diff = editedQty - originalQty;
        if (diff === 0) continue;

        // veg collection update
        const vegRef = doc(db, 'vegetables', dateKey, 'items', vegId);
        const vegSnap = await getDoc(vegRef);
        if (vegSnap.exists()) {
          const currentStock = Number(vegSnap.data().stockKg || 0);
          const newStock = diff > 0 ? Math.max(0, currentStock - diff) : currentStock + Math.abs(diff);
          stockBatch.update(vegRef, { stockKg: newStock, updatedAt: serverTimestamp() });
          stockUpdateCount++;
        } else {
          console.warn('Vegetable doc missing:', vegId);
        }

        // availableStock collection update
        const availRef = doc(db, 'availableStock', dateKey, 'items', vegId);
        const availSnap = await getDoc(availRef);
        if (availSnap.exists()) {
          const currentAvail = Number(availSnap.data().availableStockKg || 0);
          const newAvail = diff > 0 ? Math.max(0, currentAvail - diff) : currentAvail + Math.abs(diff);
          stockBatch.update(availRef, { availableStockKg: newAvail, lastUpdated: serverTimestamp(), updatedBy: currentUser?.id || 'admin' });
          stockUpdateCount++;
        } else {
          console.warn('Available stock doc missing for:', vegId);
        }
      }

      if (stockUpdateCount > 0) {
        await stockBatch.commit();
        console.log('Stock updates committed:', stockUpdateCount);
      } else {
        console.log('No stock updates required.');
      }
    } catch (err) {
      console.error('Stock update failed', err);
    }
  };

  const handleSaveChanges = async () => {
    if (!onUpdateBill || !bill || !hasUnsavedChanges) return;
    setIsSaving(true);
    try {
      await updateStockForQuantityChanges();
      // Recalculate total from edited items to ensure accuracy
      const finalTotal = editedItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
      const roundedTotal = roundTotal(finalTotal);
      await onUpdateBill(bill.id, { items: editedItems, total: roundedTotal });
      setHasUnsavedChanges(false);
      console.log('Bill updated successfully');
    } catch (err) {
      console.error('Save failed', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------- PDF Generation helpers ----------------

  // Try to set NotoSansTamil in jsPDF if available (imported file should have registered it).
  const trySetNotoInPdf = (pdfDoc: any) => {
    try {
      pdfDoc.setFont('NotoSansTamil');
      return true;
    } catch (e) {
      console.warn('NotoSansTamil not registered in jsPDF VFS, falling back to helvetica');
      try {
        pdfDoc.setFont('helvetica');
      } catch { /* ignore */ }
      return false;
    }
  };

  // Create printable DOM element for raster fallback
  // Create Black & White, Emoji-Free Printable Element for Raster PDF + QR + High Compression
const createPrintableBillElement = async (): Promise<HTMLElement> => {
  const sanitizeNoEmoji = (text: string) =>
    (text || "")
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
      .replace(/\u200D/g, "")
      .trim();

  const container = document.createElement("div");
  container.style.width = "794px";
  container.style.padding = "18px";
  container.style.background = "#ffffff";
  container.style.color = "#000000";
  container.style.fontFamily = "'Noto Sans Tamil', Arial, sans-serif";
  container.style.fontSize = "12px";
  container.style.lineHeight = "1.35";

  // HEADER — black & white only
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.padding = "10px 0";
  header.style.borderBottom = "1px solid #000";

  header.innerHTML = `
    <div>
      <div style="font-weight:800;font-size:20px;color:#000">Engal Santhai</div>
      <div style="font-size:12px;margin-top:3px;color:#000">Your Fresh Vegetable Partner</div>
    </div>
    <div style="text-align:right;font-weight:700;color:#000">INVOICE</div>
  `;
  container.appendChild(header);

  // METADATA
  const meta = document.createElement("div");
  meta.style.display = "flex";
  meta.style.justifyContent = "space-between";
  meta.style.marginTop = "12px";

  const billDateObj = new Date(bill.date);
  const dd = String(billDateObj.getDate()).padStart(2, "0");
  const mm = String(billDateObj.getMonth() + 1).padStart(2, "0");
  const yy = String(billDateObj.getFullYear());

  const serialMatch = bill.id.match(/(\d{3,})$/);
  let serial = serialMatch ? serialMatch[1].slice(-3).padStart(3, "0") : "001";
  const billNoFormatted = `ES${dd}${mm}${yy}-${serial}`;

  const timeStr = billDateObj.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).toLowerCase();

  let employeeId = bill.customerId || bill.customerName || "N/A";
  if (employeeId.includes("@")) employeeId = employeeId.split("@")[0];

  const leftMeta = `
      <div style="font-weight:600">BILL NO: ${billNoFormatted}</div>
      <div>Date: ${dd}/${mm}/${yy}</div>
  `;

  const rightMeta = `
      <div style="font-weight:600">CUSTOMER : ${sanitizeNoEmoji(customerNameFromDB || bill.customerName)}</div>
      <div>Time: ${timeStr}</div>
      <div>EMP ID: ${sanitizeNoEmoji(employeeId)}</div>
  `;

  const left = document.createElement("div");
  left.innerHTML = leftMeta;

  const right = document.createElement("div");
  right.style.textAlign = "right";
  right.innerHTML = rightMeta;

  meta.appendChild(left);
  meta.appendChild(right);
  container.appendChild(meta);

  // TABLE
  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.marginTop = "16px";

  const thead = `
    <thead>
      <tr style="background:#fff;color:#000;font-weight:700">
        <th style="border:0.5px solid #000;padding:6px;width:8%">S.No.</th>
        <th style="border:0.5px solid #000;padding:6px">Item</th>
        <th style="border:0.5px solid #000;padding:6px;text-align:right;width:15%">Qty(kg)</th>
        <th style="border:0.5px solid #000;padding:6px;text-align:right;width:18%">Rate(₹)</th>
        <th style="border:0.5px solid #000;padding:6px;text-align:right;width:20%">Amount(₹)</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement("tbody");

  editedItems.forEach((item, idx) => {
    const veg = combinedVegetableMap.get(item.vegetableId);
    const name = sanitizeNoEmoji((item as any).name || veg?.name || "Item");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="border:0.5px solid #000;padding:6px">${idx + 1}</td>
      <td style="border:0.5px solid #000;padding:6px">${name}</td>
      <td style="border:0.5px solid #000;padding:6px;text-align:right">${item.quantityKg}</td>
      <td style="border:0.5px solid #000;padding:6px;text-align:right">
        ₹${Number((item as any).pricePerKg || veg?.pricePerKg || 0).toFixed(2)}
      </td>
      <td style="border:0.5px solid #000;padding:6px;text-align:right">₹${Number(item.subtotal).toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });

  table.innerHTML = thead;
  table.appendChild(tbody);
  container.appendChild(table);

  // TOTAL ONLY
  const totalDiv = document.createElement("div");
  totalDiv.style.marginTop = "18px";
  totalDiv.style.borderTop = "1px solid #000";
  totalDiv.style.paddingTop = "10px";
  totalDiv.style.display = "flex";
  totalDiv.style.justifyContent = "space-between";
  totalDiv.style.fontWeight = "700";

  totalDiv.innerHTML = `
    <div></div>
    <div style="font-size:16px;color:#000">TOTAL: ₹${Math.round(calculatedTotal)}</div>
  `;
  container.appendChild(totalDiv);

  // PAYMENT INFORMATION BLOCK + STATIC QR IMAGE
  const payBlock = document.createElement("div");
  payBlock.style.marginTop = "20px";
  payBlock.style.padding = "12px";
  payBlock.style.border = "1px solid #000";
  payBlock.style.color = "#000";

  payBlock.innerHTML = `
    <div style="font-weight:700;margin-bottom:8px;font-size:14px;color:#000">
      PAYMENT INFORMATION
    </div>
    <div style="font-size:13px;margin-bottom:4px;color:#000">
      Payee Name: Bakkiyalakshmi Ramaswamy
      UPI ID: bakkiyalakshmi.ramaswamy-2@okhdfcbank
    </div>
    <div style="margin-top:10px;text-align:center;color:#000;font-weight:600">
      <div>Scan & Pay</div>
    </div>
  `;

  // QR CODE (FULL QUALITY PNG)
  const qrImg = document.createElement("img");
  qrImg.src = PaymentQR; // imported image
  qrImg.style.width = "140px";
  qrImg.style.height = "140px";
  qrImg.style.objectFit = "contain";
  qrImg.style.margin = "10px auto 0 auto";
  qrImg.style.display = "block";
  payBlock.appendChild(qrImg);

  container.appendChild(payBlock);

  // Load Tamil font
  const fontLink = document.createElement("link");
  fontLink.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil&display=swap";
  fontLink.rel = "stylesheet";
  container.appendChild(fontLink);

  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  document.body.appendChild(container);

  await new Promise((res) => setTimeout(res, 250));
  return container;
};


  // Generate PDF and filename
  const generateBillPdfBlobAndFilename = async (): Promise<{ blob: Blob; filename: string ;billDate: string;}> => {
    // Ensure window.jspdf present
    if (!(window as any).jspdf || !(window as any).jspdf.jsPDF) {
      throw new Error('jsPDF not available on window.jspdf');
    }
    const { jsPDF } = window.jspdf;
    const pdfDoc: any = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidth = pdfDoc.internal.pageSize.getWidth();
    const pageHeight = pdfDoc.internal.pageSize.getHeight();
    const ITEMS_PER_PAGE = 22;

    // Build filename pieces first
    const billDateObj = new Date(bill.date);
    const dd = String(billDateObj.getDate()).padStart(2, '0');
    const mm = String(billDateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = billDateObj.getFullYear();
    const billDate = `${dd}.${mm}.${yyyy}`;
    const idMatch = bill.id.match(/(\d{3,})$/);
    let serial = '001';
    if (idMatch) serial = idMatch[1].slice(-3).padStart(3, '0');
    const formattedBillNumber = `ES${dd}${mm}${yyyy}-${serial}`;

    const rawName = (customerNameFromDB || bill.customerName || 'customer').toString();
  const rawDept = (customerDeptFromDB || bill.department || 'NA').toString();
    const sanitizeFile = (s: string) => s.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '').replace(/_+/g, '_');
    const nameSafe = sanitizeFile(rawName).toUpperCase() || 'CUSTOMER';
    const deptSafe = sanitizeFile(rawDept).toUpperCase() || 'NA';
    const fileSerial = (serial || '000');
    const fileDate = `${dd}${mm}${yyyy}`;
    const filename = `${fileSerial}-${fileDate}-${nameSafe}-${deptSafe}.pdf`;

    // Decide fallback: if any text has emoji => raster fallback
    const preferRaster = true;   // FORCE raster mode always


    // TEXT-BASED PDF (searchable) branch
    if (!preferRaster) {
      try {
        // Attempt to set Tamil font if available; otherwise helvetica will be used
        trySetNotoInPdf(pdfDoc);

        const totalPages = Math.max(1, Math.ceil(editedItems.length / ITEMS_PER_PAGE));
        for (let pageNum = 0; pageNum < totalPages; pageNum++) {
          if (pageNum > 0) pdfDoc.addPage();

          // Header area
         // pdfDoc.setFillColor(198, 246, 213); // soft green
          //pdfDoc.rect(10, 10, pageWidth - 20, 18, 'F');
       //   pdfDoc.setTextColor(6, 78, 59);
          pdfDoc.setFontSize(18);
          pdfDoc.setFont(undefined, 'bold');
          pdfDoc.text('Engal Santhai', pageWidth / 2, 24, { align: 'center' });
          pdfDoc.setFontSize(10);
          pdfDoc.setFont(undefined, 'normal');
          pdfDoc.text('Your Fresh Vegetable Partner', pageWidth / 2, 29, { align: 'center' });

          pdfDoc.setFontSize(12);
          pdfDoc.setFont(undefined, 'bold');
          pdfDoc.text('INVOICE', 14, 42);

          const dateStr = billDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
         
          const timeStr = billDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
          pdfDoc.setFont(undefined, 'normal');
          pdfDoc.setFontSize(10);
          pdfDoc.text(`BILL NO: ${formattedBillNumber}`, 14, 50);
          pdfDoc.text(`Date: ${dateStr}`, pageWidth - 14, 50, { align: 'right' });
          const safeDept = sanitizeTextForPdf(customerDeptFromDB || bill.department || 'NA');
          pdfDoc.text(`CUSTOMER NAME : ${sanitizeTextForPdf(customerNameFromDB || bill.customerName || '')}`, 14, 56);
          pdfDoc.text(`Time: ${timeStr}`, pageWidth - 14, 56, { align: 'right' });
          pdfDoc.text(`EMP ID: ${(bill.customerId || bill.customerName || 'N/A')}`, 14, 64);
          pdfDoc.text(`DEPT: ${safeDept.toUpperCase()}`, pageWidth - 14, 64, { align: 'right' });

          // Table headings & columns
          let y = 74;
          const startX = 14;
          const endX = pageWidth - 14;
          const colSNo = startX;
          const colItem = startX + 18;
          const colQty = startX + 96;
          const colRate = startX + 126;
          const colAmount = endX;
          pdfDoc.setLineWidth(0.2);
          pdfDoc.line(startX, y - 6, endX, y - 6);

          pdfDoc.setFont(undefined, 'bold');
          pdfDoc.setFontSize(10);
          pdfDoc.text('S.No.', colSNo, y);
          pdfDoc.text('Item', colItem, y);
          pdfDoc.text('Qty (kg)', colQty, y, { align: 'right' });
          pdfDoc.text('Rate (Rs.)', colRate, y, { align: 'right' });
          pdfDoc.text('Amount (Rs.)', colAmount, y, { align: 'right' });
          y += 8;
          pdfDoc.setLineWidth(0.2);
          pdfDoc.line(startX, y, endX, y);
          y += 6;

          const startIdx = pageNum * ITEMS_PER_PAGE;
          const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, editedItems.length);
          const pageItems = editedItems.slice(startIdx, endIdx);

          pdfDoc.setFont('NotoSansTamil' in (pdfDoc as any).fList ? 'NotoSansTamil' : 'helvetica', 'normal');
          pdfDoc.setFontSize(10);

          for (let i = 0; i < pageItems.length; i++) {
            const item = pageItems[i];
            const veg = combinedVegetableMap.get(item.vegetableId);
            const rawName = (item as any).name || veg?.name || 'Unknown';
            const name = sanitizeTextForPdf(rawName) || 'Unknown';
            const qty = String(item.quantityKg);
            const rateStr = Number((item as any).pricePerKg || veg?.pricePerKg || 0).toFixed(2);
            const amountStr = Number(item.subtotal).toFixed(2);

            const maxItemWidth = colQty - colItem - 4;
            const splitName: string[] = (pdfDoc as any).splitTextToSize ? (pdfDoc as any).splitTextToSize(name, maxItemWidth) : [name];
            // S.No
            pdfDoc.setFont('helvetica', 'normal');
            pdfDoc.text(String(startIdx + i + 1), colSNo, y);

            // Name (use Tamil font if present)
            try {
              pdfDoc.setFont('NotoSansTamil');
            } catch (e) {
              pdfDoc.setFont('helvetica');
            }
            pdfDoc.text(splitName, colItem, y);

            // Numeric columns in helvetica
            pdfDoc.setFont('helvetica', 'normal');
            pdfDoc.text(qty, colQty, y, { align: 'right' });
            pdfDoc.text(`₹${rateStr}`, colRate, y, { align: 'right' });
            pdfDoc.text(`₹${amountStr}`, colAmount, y, { align: 'right' });

            y += (splitName.length || 1) * 6;

            if (y > pageHeight - 60) {
              // break to next page (loop will continue)
              break;
            }
          }

          // Footer totals on last page
          if (pageNum === totalPages - 1) {
            pdfDoc.setLineWidth(0.4);
            pdfDoc.line(startX, pageHeight - 60, endX, pageHeight - 60);
            pdfDoc.setFont(undefined, 'bold');
            pdfDoc.setFontSize(12);
            pdfDoc.text('TOTAL:', colRate, pageHeight - 50);
            pdfDoc.text(`Rs. ${Math.round(calculatedTotal)}`, colAmount, pageHeight - 50, { align: 'right' });

            // Payment details
            if (selectedUpiId) {
              const selectedUpi = UPI_IDS.find(u => u.id === selectedUpiId);
              if (selectedUpi) {
                const boxY = pageHeight - 40;
              //  pdfDoc.setDrawColor(230, 238, 238);
               // pdfDoc.rect(startX, boxY, endX - startX, 28, 'S');
                pdfDoc.setFontSize(10);
                pdfDoc.setFont(undefined, 'bold');
                pdfDoc.text('PAYMENT INFORMATION', startX + 2, boxY + 7);
                pdfDoc.setFont(undefined, 'normal');
                pdfDoc.setFontSize(9);
                pdfDoc.text(`Payee Name: ${selectedUpi.name}`, startX + 2, boxY + 12);
                pdfDoc.text(`UPI ID: ${selectedUpi.displayName}`, startX + 2, boxY + 17);
                pdfDoc.text(`Amount: Rs. ${Math.round(calculatedTotal)}`, startX + 2, boxY + 22);
              }
            }
          }
        }

        const blob = pdfDoc.output('blob');
        const compressedBlob = await compressPdf(blob);
        return { blob: compressedBlob, filename,billDate };

      } catch (err) {
        console.error('Text-based PDF generation failed, falling back to raster', err);
      }
    }

    // Raster fallback using html2canvas (for emojis or if text path failed)
    try {
      const element = await createPrintableBillElement();
      const scale = 2; // good resolution
      const canvas = await html2canvas(element as HTMLElement, { scale, useCORS: true, logging: false, scrollY: -window.scrollY });
      try { document.body.removeChild(element); } catch {}
      const imgData = canvas.toDataURL('image/jpeg');
      const imgProps = (pdfDoc as any).getImageProperties(imgData);
      const imgWidth = pageWidth;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdfDoc.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        pdfDoc.addPage();
        position = heightLeft - imgHeight;
      pdfDoc.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      const blob = pdfDoc.output('blob');
const compressedBlob = await compressPdf(blob);
return { blob: compressedBlob, filename ,billDate};

    } catch (rasterErr) {
      console.error('Raster fallback failed', rasterErr);
      // Final minimal PDF
      try {
        const fallback = new jsPDF();
        fallback.text('Unable to generate bill PDF. Please contact support.', 10, 10);
        const blob = pdfDoc.output('blob');
const compressedBlob = await compressPdf(blob);
return { blob: compressedBlob, filename,billDate};

      } catch (finalErr) {
        console.error('Final fallback failed', finalErr);
        throw new Error('PDF generation failed.');
      }
    }
  };

  const handleDownload = async () => {
    try {
      const { blob, filename, billDate } = await generateBillPdfBlobAndFilename();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed', err);
      alert('Failed to download PDF. Check console.');
    }
  };

  const normalizePhoneForWhatsApp = (raw: string | undefined | null): string | null => {
    if (!raw) return null;
    let digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    while (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
    if (digits.length === 10) return `91${digits}`;
    return digits;
  };

  const copyUpiId = async (upiId: string) => {
    try {
      await navigator.clipboard.writeText(upiId);
      console.log('UPI ID copied to clipboard:', upiId);
    } catch (err) {
      console.error('Failed to copy UPI ID:', err);
    }
  };

  const handleShare = async () => {
    setIsSharing(true);

    try {
      if (hasUnsavedChanges) {
        await handleSaveChanges();
      }

      let employeeNameToQuery = billTyped?.employee_name || customerNameFromDB || bill.customerName || '';
      let retries = 0;
      while ((!employeeNameToQuery || employeeNameToQuery === 'Unknown Customer') && retries < 5) {
        await new Promise(res => setTimeout(res, 200));
        employeeNameToQuery = billTyped?.employee_name || customerNameFromDB || bill.customerName || '';
        retries++;
      }

      let phoneNumber: string | null = null;
      if (employeeNameToQuery.trim()) {
        try {
          const usersRef = collection(db, 'users');
          const q1 = query(usersRef, where('employee_name', '==', employeeNameToQuery));
          const snap1 = await getDocs(q1);
          let userData: any = null;
          if (!snap1.empty) userData = snap1.docs[0].data();
          else {
            const q2 = query(usersRef, where('name', '==', employeeNameToQuery));
            const snap2 = await getDocs(q2);
            if (!snap2.empty) userData = snap2.docs[0].data();
          }
          if (userData) {
            phoneNumber = String(userData.phone || userData.mobile || userData.contact || userData.phoneNumber || '') || null;
          }
        } catch (err) {
          console.error('Firestore user lookup failed', err);
        }
      }

      const normalized = normalizePhoneForWhatsApp(phoneNumber);
      let downloadURL: string | null = null;
      try {
        const { blob, filename } = await generateBillPdfBlobAndFilename();
        const storage = getStorage();
        const pdfRef = ref(storage, `bills/${(bill as any).billNumber || bill.id || Date.now()}.pdf`);
        await uploadBytes(pdfRef, blob);
        const rawURL = await getDownloadURL(pdfRef);
        downloadURL = rawURL + (rawURL.includes('?') ? '&dl=1' : '?dl=1');
      } catch (err) {
        console.warn('PDF upload failed', err);
      }
const {billDate } = await generateBillPdfBlobAndFilename();

const totalAmount = Math.round(calculatedTotal);
const upiId = "bakkiyalakshmi.ramaswamy-2@okhdfcbank";
const billDownloadLink = downloadURL || "Kindly download your bill from the link.";

// Final message
const message =
`🌟 Hello!
Thank you for ordering from *Engal Sandhai* on ${billDate} 🙏

Your Engal Sandhai Bill is ready.
*Total: ₹${totalAmount}*

📄 _Download your E-bill here:_
${billDownloadLink}

📌 *Please make your payment to the following UPI ID:*
${upiId}
📷 Once done, kindly send a screenshot of the payment confirmation here.

Thank You!`;

      try {
        await navigator.clipboard.writeText(message);
      } catch (err) {
        console.warn('Copy message failed', err);
      }

      const waUrl = normalized
  ? `https://api.whatsapp.com/send?phone=${encodeURIComponent(normalized)}&text=${encodeURIComponent(message)}`
  : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

window.open(waUrl, "_blank");

      // Try native share with file
      try {
        const { blob, filename } = await generateBillPdfBlobAndFilename();
        const file = new File([blob], filename, { type: 'application/pdf' });
        if ((navigator as any).share && (navigator as any).canShare?.({ files: [file] })) {
          await (navigator as any).share({ title: 'Engal Santhai Bill', text: message, files: [file] });
        }
      } catch (shareErr) {
        console.warn('Native share failed', shareErr);
      }
    } catch (err) {
      console.error('Share flow failed', err);
      alert('Unable to share bill. Please try downloading manually.');
    }
    setIsSharing(false);

  };

  return (
    <>
    {isSharing && (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 text-white text-lg font-semibold">
    Please wait, do not press back or exit...
  </div>
)}

      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in-down"
      >
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b bg-slate-50 rounded-t-lg">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Bill Details</h2>
              {hasUnsavedChanges && <p className="text-sm text-amber-600 font-medium">• Unsaved changes</p>}
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200">
              <XMarkIcon className="h-6 w-6 text-slate-600" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-sm text-slate-500">Bill Number</p>
                <p className="font-mono text-sm text-slate-800">
                  {(() => {
                    const billDateObj = new Date(bill.date);
                    const dd = String(billDateObj.getDate()).padStart(2, '0');
                    const mm = String(billDateObj.getMonth() + 1).padStart(2, '0');
                    const yyyy = billDateObj.getFullYear();
                    let serial = '001';
                    const idMatch = bill.id.match(/(\d{3,})$/);
                    if (idMatch) serial = idMatch[1].slice(-3).padStart(3, '0');
                    return `ES${dd}${mm}${yyyy}-${serial}`;
                  })()}
                </p>
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
                  <button onClick={() => setIsImagePreviewOpen(true)} className="text-sm font-semibold text-primary-600 hover:underline flex items-center">
                    <EyeIcon className="h-4 w-4 mr-1" /> View Screenshot
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
                          <td className="px-2 py-3 text-center font-medium text-slate-700">{index + 1}</td>
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
                                  <div className="text-xs text-amber-600 mt-1">⚠️ Using calculated price: ₹{(item.subtotal / (item.quantityKg || 1)).toFixed(2)}/kg</div>
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
                              if (vegetable) return `₹${Number(vegetable.pricePerKg).toFixed(2)}`;
                              if ((item as any).pricePerKg) return `₹${Number((item as any).pricePerKg).toFixed(2)}`;
                              if (item.quantityKg > 0) {
                                const cp = item.subtotal / (item.quantityKg || 1);
                                return `₹${Number(cp).toFixed(2)}`;
                              }
                              return '₹0.00';
                            })()}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-primary-600">₹{Number(item.subtotal).toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => handleRemoveVegetable(item.vegetableId)} className="text-red-600 hover:text-red-800 font-semibold px-2 py-1 rounded hover:bg-red-50" title="Remove item">✕</button>
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
                <Button onClick={() => setShowAddVegetables(!showAddVegetables)} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2">
                  {showAddVegetables ? 'Hide' : 'Add Items'}
                </Button>
              </div>

              {showAddVegetables && (
                <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                  {getAvailableVegetables().length > 0 ? (
                    getAvailableVegetables().map(veg => (
                      <VegetableAddRow key={veg.id} vegetable={veg} onAdd={(quantity) => { handleAddVegetable(veg.id, quantity); setShowAddVegetables(false); }} />
                    ))
                  ) : (
                    <p className="text-slate-500 text-center py-4">All available vegetables are already in this order</p>
                  )}
                </div>
              )}
            </div>



            <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-200">
              <div className="flex gap-3">
                <Button onClick={handleSaveChanges} disabled={!hasUnsavedChanges || isSaving} className={`${hasUnsavedChanges ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-400 cursor-not-allowed'} text-white`}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>

                <Button onClick={handleShare} className={`bg-primary-600 hover:bg-primary-700 text-white`} title={'Share bill via WhatsApp or other apps'}>
                  <ShareIcon className="h-5 w-5 mr-2" /> Share
                </Button>

                <Button onClick={handleDownload} className="bg-slate-600 hover:bg-slate-700 text-white" title={!selectedUpiId ? 'Please select a UPI ID first' : ''}>
                  <ArrowDownTrayIcon className="h-5 w-5 mr-2" /> Download Bill
                </Button>
              </div>

              <div className="text-right">
                <p className="text-sm text-slate-500">Total Amount</p>
                <p className="text-2xl font-bold text-slate-800">₹{Math.round(calculatedTotal)}</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      <ImagePreviewModal isOpen={isImagePreviewOpen} onClose={() => setIsImagePreviewOpen(false)} imageUrl={bill.paymentScreenshot || ''} />
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
      setQuantity(0.25);
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
          <button onClick={() => setQuantity(Math.max(0.25, quantity - 0.25))} className="w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-sm font-semibold" disabled={quantity <= 0.25}>-</button>
          <input type="number" value={quantity} onChange={(e) => setQuantity(Math.max(0.25, parseFloat(e.target.value) || 0.25))} className="w-16 text-center border border-slate-300 rounded px-2 py-1 text-sm" min="0.25" step="0.25" />
          <button onClick={() => setQuantity(quantity + 0.25)} className="w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-sm font-semibold">+</button>
          <span className="text-sm text-slate-500">kg</span>
        </div>

        <Button onClick={handleAdd} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-sm">Add ₹{(quantity * vegetable.pricePerKg).toFixed(2)}</Button>
      </div>
    </div>
  );
};

export default BillDetailModal;
