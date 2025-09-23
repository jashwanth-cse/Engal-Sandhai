import React, { useState, useEffect } from 'react';
import type { Bill, Vegetable, BillItem } from '../../types/types';
import { XMarkIcon, EyeIcon, ArrowDownTrayIcon } from './ui/Icon.tsx';
import ImagePreviewModal from './ui/ImagePreviewModal.tsx';
import Button from './ui/Button.tsx';
import { roundTotal, formatRoundedTotal } from '../utils/roundUtils';

// Let TypeScript know that jspdf is available on the window object
declare global {
    interface Window {
        jspdf: any;
    }
}

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
  const [bagCount, setBagCount] = useState(0);
  const [showAddVegetables, setShowAddVegetables] = useState(false);
  
  const BAG_PRICE = 10; // ₹10 per bag
  
  // Initialize edited items when bill changes
  useEffect(() => {
    if (bill) {
      setEditedItems([...bill.items]);
      setBagCount(bill.bags || 0);
      setCalculatedTotal(roundTotal(bill.total));
      setHasUnsavedChanges(false);
    }
  }, [bill]);
  
  // Recalculate total when items or bags change
  useEffect(() => {
    const itemsTotal = editedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const bagsTotal = bagCount * BAG_PRICE;
    const newTotal = itemsTotal + bagsTotal;
    const roundedTotal = roundTotal(newTotal);
    setCalculatedTotal(roundedTotal);
    
    // Check if there are unsaved changes
    if (bill) {
      const originalItemsTotal = bill.items.reduce((sum, item) => sum + item.subtotal, 0);
      const originalBagsTotal = (bill.bags || 0) * BAG_PRICE;
      const originalTotal = roundTotal(originalItemsTotal + originalBagsTotal);
      
      const hasChanges = roundedTotal !== originalTotal || 
        bagCount !== (bill.bags || 0) ||
        editedItems.some((item, index) => 
          item.quantityKg !== bill.items[index]?.quantityKg ||
          item.subtotal !== bill.items[index]?.subtotal
        );
      setHasUnsavedChanges(hasChanges);
    }
  }, [editedItems, bagCount, bill]);
  
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

  const handleBagCountChange = (increment: boolean) => {
    setBagCount(prev => {
      const newCount = increment ? prev + 1 : Math.max(0, prev - 1);
      return newCount;
    });
  };

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
        subtotal: roundTotal(newQuantity * vegetable.pricePerKg)
      };
      setEditedItems(newItems);
    } else {
      // Add new item
      const newItem: BillItem = {
        vegetableId,
        quantityKg: quantity,
        subtotal: roundTotal(quantity * vegetable.pricePerKg)
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
        bags: bagCount
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
    
    const centerX = doc.internal.pageSize.getWidth() / 2;
    let y = 20;

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Engal Santhai', centerX, y, { align: 'center' });
    y += 10;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Your Fresh Vegetable Partner', centerX, y, { align: 'center' });
    y += 15;
    
    // Bill Details
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', 14, y);
    y += 8;
    
    // Date and Time on separate lines
    const billDate = new Date(bill.date);
    const dateStr = billDate.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    const timeStr = billDate.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    }).toUpperCase(); // Convert AM/PM to uppercase
    
    // Get employee ID from current user's email (before @ symbol)
    const employeeId = currentUser?.email?.split('@')[0] || currentUser?.id?.substring(0, 8) || 'N/A';
    
    doc.setFont('helvetica', 'normal');
    doc.text(`BILL NUMBER : ${bill.id}`, 14, y);
    doc.text(`Date: ${dateStr}`, doc.internal.pageSize.getWidth() - 14, y, { align: 'right' });
    y += 8;
    doc.text(`CUSTOMER NAME : ${bill.customerName}`, 14, y);
    doc.text(`Time: ${timeStr}`, doc.internal.pageSize.getWidth() - 14, y, { align: 'right' });
    y += 8;
    if (bill.department) {
      doc.text(`DEPARTMENT : ${bill.department}`, 14, y);
      y += 8;
    }
    doc.text(`EMP ID : ${employeeId}`, 14, y);
    y += 10;
    
    // Table Header
    doc.setDrawColor(150); // a light grey
    doc.line(14, y, doc.internal.pageSize.getWidth() - 14, y); // top line
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('S.No.', 16, y);
    doc.text('Item', 32, y);
    doc.text('Qty (kg)', 120, y, { align: 'right' });
    doc.text('Rate (Rs.)', 155, y, { align: 'right' });
    doc.text('Amount (Rs.)', 195, y, { align: 'right' });
    y += 2;
    doc.line(14, y, doc.internal.pageSize.getWidth() - 14, y); // bottom line
    y += 8;

    // Table Items - Use editedItems instead of bill.items
    doc.setFont('courier', 'normal');
    editedItems.forEach((item, index) => {
        const vegetable = vegetableMap.get(item.vegetableId);
        const serialNo = (index + 1).toString();
        const name = vegetable?.name || 'Unknown Item';
        const qty = item.quantityKg.toFixed(2);
        const rate = (vegetable?.pricePerKg || 0).toFixed(2);
        const amount = item.subtotal.toFixed(2);

        doc.text(serialNo, 18, y, { align: 'center' });
        doc.text(name, 32, y);
        doc.text(qty, 120, y, { align: 'right' });
        doc.text(rate, 155, y, { align: 'right' });
        doc.text(amount, 195, y, { align: 'right' });
        y += 7;
    });

    // Add bags if any
    if (bagCount > 0) {
        const serialNo = (editedItems.length + 1).toString();
        const bagTotal = (bagCount * BAG_PRICE).toFixed(2);
        
        doc.text(serialNo, 18, y, { align: 'center' });
        doc.text('Shopping Bag', 32, y);
        doc.text(bagCount.toString(), 120, y, { align: 'right' });
        doc.text(BAG_PRICE.toFixed(2), 155, y, { align: 'right' });
        doc.text(bagTotal, 195, y, { align: 'right' });
        y += 7;
    }

    // Total - Use calculatedTotal instead of bill.total
    const totalY = y + 5;
    doc.line(120, totalY, doc.internal.pageSize.getWidth() - 14, totalY);
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('TOTAL:', 122, y);
    doc.text(`Rs. ${roundTotal(calculatedTotal)}`, 195, y, { align: 'right' });
    
    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 20;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('Thank you for your purchase!', centerX, footerY, { align: 'center' });

    // Save the PDF
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
                    <p className="font-mono text-sm text-slate-800">{bill.id}</p>
                </div>
                <div>
                    <p className="text-sm text-slate-500">Customer Number</p>
                    <p className="font-semibold text-slate-800">{bill.customerName}</p>
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
                                const vegetable = vegetableMap.get(item.vegetableId);
                                return (
                                    <tr key={index} className="bg-white border-b last:border-0">
                                        <td className="px-2 py-3 text-center font-medium text-slate-700">
                                            {index + 1}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-900">
                                            {vegetable?.icon} {vegetable?.name || 'N/A'}
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
                                        <td className="px-4 py-3 text-right">₹{vegetable?.pricePerKg.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-primary-600">₹{item.subtotal.toFixed(2)}</td>
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

            {/* Bag Management Section */}
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

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-200">
                <div className="flex gap-3">
                    <Button 
                        onClick={handleSaveChanges} 
                        disabled={!hasUnsavedChanges || isSaving}
                        className={`${hasUnsavedChanges ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-400 cursor-not-allowed'} text-white`}
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button onClick={handleDownload} className="bg-slate-600 hover:bg-slate-700">
                        <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                        Download Bill
                    </Button>
                </div>
                <div className="text-right">
                    <p className="text-sm text-slate-500">Total Amount</p>
                    <p className="text-2xl font-bold text-slate-800">{formatRoundedTotal(calculatedTotal)}</p>
                    {roundTotal(calculatedTotal) !== roundTotal(bill.total) && (
                        <p className="text-xs text-slate-500 mt-1">
                            Original: {formatRoundedTotal(bill.total)}
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
        <span className="text-2xl">{vegetable.icon}</span>
        <div>
          <h5 className="font-medium text-slate-800">{vegetable.name}</h5>
          <p className="text-sm text-slate-600">₹{vegetable.pricePerKg.toFixed(2)}/kg</p>
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