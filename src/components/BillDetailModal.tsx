import React, { useState, useEffect } from 'react';
import type { Bill, Vegetable, BillItem } from '../../types/types';
import { XMarkIcon, EyeIcon, ArrowDownTrayIcon } from './ui/Icon.tsx';
import ImagePreviewModal from './ui/ImagePreviewModal.tsx';
import Button from './ui/Button.tsx';
import { getVegetableById } from '../services/dbService';
import { upiPng } from '../assets/upi.ts';

// Firestore imports
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Let TypeScript know that jspdf is available on the window object
declare global {
    interface Window {
        jspdf: any;
    }
}

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
  onUpdateBill?: (billId: string, updates: Partial<Bill>) => void;
  currentUser?: { id: string; name: string; role: string; email?: string };
}

const BillDetailModal: React.FC<BillDetailModalProps> = ({ isOpen, onClose, bill, vegetableMap, vegetables, onUpdateBill, currentUser }) => {
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [editedItems, setEditedItems] = useState<BillItem[]>([]);
  const [calculatedTotal, setCalculatedTotal] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // const [bagCount, setBagCount] = useState(0); // Moved to user page
  const [showAddVegetables, setShowAddVegetables] = useState(false);
  
  // Added: customer name fetched from DB (if possible)
  const [customerNameFromDB, setCustomerNameFromDB] = useState<string>('');
  
  // Add state to track fetched vegetables for missing items
  const [fetchedVegetables, setFetchedVegetables] = useState<Map<string, Vegetable>>(new Map());
  
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
  
  // Initialize edited items when bill changes
  useEffect(() => {
    if (bill) {
      setEditedItems([...bill.items]);
      // setBagCount(bill.bags || 0); // Moved to user page
      setCalculatedTotal(bill.total);
      setHasUnsavedChanges(false);
      setFetchedVegetables(new Map()); // Reset fetched vegetables for new bill
      setSelectedUpiId(''); // Reset UPI selection for new bill
    }
  }, [bill]);
  
  // Effect to fetch missing vegetable data
  useEffect(() => {
    if (!bill) return;
    
    const fetchMissingVegetables = async () => {
      const missingVegetables = new Map<string, Vegetable>();
      
      for (const item of bill.items) {
        // If vegetable is not in the current vegetableMap, try to fetch it
        if (!vegetableMap.has(item.vegetableId) && !fetchedVegetables.has(item.vegetableId)) {
          console.log(`🔍 Fetching missing vegetable data for: ${item.vegetableId}`);
          const vegetableData = await getVegetableById(item.vegetableId);
          if (vegetableData) {
            console.log(`✅ Found vegetable data: ${vegetableData.name}`);
            missingVegetables.set(item.vegetableId, vegetableData);
          } else {
            console.warn(`❌ Could not find vegetable data for: ${item.vegetableId}`);
          }
        }
      }
      
      if (missingVegetables.size > 0) {
        setFetchedVegetables(prev => new Map([...prev, ...missingVegetables]));
      }
    };
    
    fetchMissingVegetables();
  }, [bill, vegetableMap]); // Remove fetchedVegetables from dependency to avoid infinite loop
  
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
    const vegetable = vegetableMap.get(editedItems[index].vegetableId);
    if (!vegetable) return;
    
    // Ensure quantity is not negative and not more than 2 decimal places
    const clampedQuantity = Math.max(0, Math.round(newQuantity * 100) / 100);
    const newSubtotal = clampedQuantity * vegetable.pricePerKg;
    
    const updatedItems = [...editedItems];
    updatedItems[index] = {
      ...updatedItems[index],
      quantityKg: clampedQuantity,
      subtotal: newSubtotal
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
    const vegetable = vegetableMap.get(vegetableId);
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
      await onUpdateBill(bill.id, {
        items: editedItems,
        total: calculatedTotal,
        // bags: bagCount // Moved to user page
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving changes:', error);
      // Could add toast notification here
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const ITEMS_PER_PAGE = 25; // Maximum items per page
    const totalPages = Math.max(1, Math.ceil(editedItems.length / ITEMS_PER_PAGE));

    // Get employee ID from current user
    const employeeId = currentUser?.email?.split('@')[0] || currentUser?.id || 'N/A';
    // Format bill number as ESDDMMYYYY-001
    const billDateObj = new Date(bill.date);
    const dd = String(billDateObj.getDate()).padStart(2, '0');
    const mm = String(billDateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = billDateObj.getFullYear();
    // If bill.id is a string, extract a serial number (last 3 digits or fallback to 001)
    let serial = '001';
    const idMatch = bill.id.match(/(\d{3,})$/);
    if (idMatch) {
      serial = idMatch[1].slice(-3).padStart(3, '0');
    }
    const formattedBillNumber = `ES${dd}${mm}${yyyy}-${serial}`;

    // Generate each page
    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
      if (pageNum > 0) {
        doc.addPage();
      }

      let y = 20;

      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('Engal Santhai', pageWidth / 2, y, { align: 'center' });
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text('Your Fresh Vegetable Partner', pageWidth / 2, y, { align: 'center' });
      y += 15;

      // INVOICE heading
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('INVOICE', 14, y);
      y += 8;

      // Bill details
      const billDate = new Date(bill.date);
      const dateStr = billDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const timeStr = billDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).toLowerCase();

      doc.setFont('helvetica', 'normal');
      doc.text(`BILL NO: ${formattedBillNumber}`, 14, y);
      doc.text(`Date: ${dateStr}`, pageWidth - 14, y, { align: 'right' });
      y += 6;
      doc.text(`CUSTOMER NAME : ${customerNameFromDB || bill.customerName}`, 14, y);
      doc.text(`Time: ${timeStr}`, pageWidth - 14, y, { align: 'right' });
      y += 6;
      doc.text(`EMP ID: ${employeeId}`, 14, y);
      y += 10;

      // Table header
      const startX = 14;
      const endX = pageWidth - 14;

      // Column x-positions
      const colSNo = startX;               // Serial Number
      const colItem = startX + 20;         // Item left
      const colQty = startX + 90;          // Qty
      const colRate = startX + 130;        // Rate
      const colAmount = endX;              // Amount right

      doc.setLineWidth(0.2);
      doc.line(startX, y, endX, y); // top border
      y += 6;

      doc.setFont('helvetica', 'bold');
      doc.text('S.No.', colSNo, y);
      doc.text('Item', colItem, y);
      doc.text('Qty (kg)', colQty, y, { align: 'right' });
      doc.text('Rate (Rs.)', colRate, y, { align: 'right' });
      doc.text('Amount (Rs.)', colAmount, y, { align: 'right' });

      y += 2;
      doc.line(startX, y, endX, y); // header bottom
      y += 6;

      // Get items for this page
      const startIdx = pageNum * ITEMS_PER_PAGE;
      const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, editedItems.length);
      const pageItems = editedItems.slice(startIdx, endIdx);

      // Table rows for this page
      doc.setFont('courier', 'normal');
      pageItems.forEach((item, pageIndex) => {
        const vegetable = vegetableMap.get(item.vegetableId) || fetchedVegetables.get(item.vegetableId);
        const globalSerialNo = startIdx + pageIndex + 1; // Continue serial number across pages
        
        // Use historical data from bill item if available, otherwise fallback to vegetable lookup
        const name = (item as any).name || vegetable?.name || 'Unknown';
        const qty = String(item.quantityKg);
        const rate = String((item as any).pricePerKg || vegetable?.pricePerKg || 0);
        const amount = String(item.subtotal);
        
        // Debug logging
        console.log(`PDF Item ${globalSerialNo}:`, {
          vegetableId: item.vegetableId,
          historicalName: (item as any).name,
          historicalPrice: (item as any).pricePerKg,
          vegetableName: vegetable?.name,
          vegetablePrice: vegetable?.pricePerKg,
          finalName: name,
          finalRate: rate
        });

        doc.text(globalSerialNo.toString(), colSNo, y);
        doc.text(name, colItem, y);
        doc.text(qty, colQty, y, { align: 'right' });
        doc.text(rate, colRate, y, { align: 'right' });
        doc.text(amount, colAmount, y, { align: 'right' });
        y += 6;
      });

      doc.line(startX, y, endX, y); // bottom border
      y += 10;

      // Show total only on the last page
      if (pageNum === totalPages - 1) {
        // TOTAL
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('TOTAL:', colRate, y);
        doc.text(`Rs. ${calculatedTotal}`, colAmount, y, { align: 'right' });
        y += 15;
        
        // UPI Payment Information
        if (selectedUpiId) {
          const selectedUpi = UPI_IDS.find(upi => upi.id === selectedUpiId);
          if (selectedUpi) {
            doc.line(startX, y - 5, endX, y - 5); // separator line
            y += 5;
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text('PAYMENT INFORMATION', startX, y);
            y += 8;
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`Payee Name: ${selectedUpi.name}`, startX, y);
            y += 5;
            doc.text(`UPI ID: ${selectedUpi.displayName}`, startX, y);
            y += 5;
            doc.text(`Amount: Rs. ${calculatedTotal}`, startX, y);
            y += 8;
            
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(9);
            doc.text('• Scan the QR code for instant payment', startX, y);
            y += 4;
            doc.text('• Use any UPI app like GPay, PhonePe, or Paytm', startX, y);
            y += 4;
            doc.text('• Payment confirmation required for order processing', startX, y);
          }
        }
      }
    }

    doc.save(`EngalSanthai-Bill-${bill.id}.pdf`);
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
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-500">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                        <tr>
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
                                const vegetable = vegetableMap.get(item.vegetableId) || fetchedVegetables.get(item.vegetableId);
                                return (
                                    <tr key={index} className="bg-white border-b last:border-0">
                                        <td className="px-2 py-3 text-center font-medium text-slate-700">
                                            {index + 1}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-900">
                                            {vegetable?.name || `Unknown Item (${item.vegetableId})`}
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
                                        <td className="px-4 py-3 text-right">₹{vegetable?.pricePerKg || 'N/A'}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-primary-600">₹{item.subtotal}</td>
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
            {/*
            <div className="border-t border-slate-200 pt-4 mt-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-lg font-semibold text-slate-800">Shopping Bags</h4>
                        <p className="text-sm text-slate-500">₹{BAG_PRICE} per bag</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => handleBagCountChange(false)}
                            disabled={bagCount <= 0}
                            className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white flex items-center justify-center font-semibold"
                        >
                            -
                        </button>
                        <span className="text-xl font-semibold text-slate-800 min-w-[2rem] text-center">
                            {bagCount}
                        </span>
                        <button
                            onClick={() => handleBagCountChange(true)}
                            className="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center font-semibold"
                        >
                            +
                        </button>
                        <div className="ml-4 text-right">
                            <p className="text-sm text-slate-500">Bag Total</p>
                            <p className="font-semibold text-slate-800">₹{bagCount * BAG_PRICE}</p>
                        </div>
                    </div>
                </div>
            </div>
            */}

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
                                Scan this QR code to pay ₹{calculatedTotal}
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
                    <p className="text-2xl font-bold text-slate-800">₹{calculatedTotal}</p>
                    {calculatedTotal !== bill.total && (
                        <p className="text-xs text-slate-500 mt-1">
                            Original: ₹{bill.total}
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
          Add ₹{quantity * vegetable.pricePerKg}
        </Button>
      </div>
    </div>
  );
};

export default BillDetailModal;