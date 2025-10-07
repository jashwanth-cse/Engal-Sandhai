import React, { useState, useMemo } from 'react';
import type { Vegetable, Bill } from '../../types/types';
import Button from './ui/Button.tsx';
import MetricCard from './ui/MetricCard.tsx';
import { PlusIcon, PencilSquareIcon, TrashIcon, MagnifyingGlassIcon, CalendarDaysIcon } from './ui/Icon.tsx';
import VegetableFormModal from './VegetableFormModal.tsx';
import Toast from './ui/Toast.tsx';

interface InventoryProps {
  vegetables: Vegetable[];
  bills: Bill[]; // Add bills to calculate available stock
  availableStock: Map<string, number>; // Real-time available stock from database
  addVegetable: (newVegetable: Omit<Vegetable, 'id'>, date?: Date) => void;
  updateVegetable: (updatedVegetable: Vegetable, date?: Date) => void;
  deleteVegetable: (vegId: string, date?: Date) => void;
  selectedDate?: Date; // Currently selected date from parent component
  onDateChange?: (date: Date) => void; // Callback to change date in parent
}

type ToastState = {
    message: string;
    type: 'success' | 'error';
} | null;

const Inventory: React.FC<InventoryProps> = ({
  vegetables,
  bills,
  availableStock,
  addVegetable,
  updateVegetable,
  deleteVegetable,
  selectedDate,
  onDateChange,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVegetable, setEditingVegetable] = useState<Vegetable | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [localSelectedDate, setLocalSelectedDate] = useState<Date>(selectedDate || new Date());

  // Use selectedDate from props or local state
  const currentDate = selectedDate || localSelectedDate;
  
  // Handle date change
  const handleDateChange = (newDate: Date) => {
    if (onDateChange) {
      onDateChange(newDate);
    } else {
      setLocalSelectedDate(newDate);
    }
  };

  // Format date for display
  const formatDateForDisplay = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long', 
      day: 'numeric'
    });
  };

  // Format date for input (YYYY-MM-DD)
  const formatDateForInput = (date: Date) => {
    // Use local date parts to avoid timezone shifts introduced by toISOString()
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Calculate used stock for each vegetable from bills
  const usedStock = useMemo(() => {
    const used = new Map<string, number>();
    
    bills.forEach(bill => {
      bill.items?.forEach(item => {
        const currentUsed = used.get(item.vegetableId) || 0;
        used.set(item.vegetableId, currentUsed + item.quantityKg);
      });
    });
    
    return used;
  }, [bills]);

  // Get available stock for each vegetable from real-time database data
  const getAvailableStock = (vegetable: Vegetable) => {
    // Use real-time available stock from database if available
    const realTimeStock = availableStock.get(vegetable.id);
    if (realTimeStock !== undefined) {
      return realTimeStock;
    }
    
    // Fallback: calculate from bills as before (for backward compatibility)
    const used = usedStock.get(vegetable.id) || 0;
    return Math.max(0, vegetable.totalStockKg - used);
  };

  // Calculate selling statistics for each vegetable
  const sellingStats = useMemo(() => {
    const stats = new Map<string, { vegetable: Vegetable; totalSold: number; totalRevenue: number }>();
    
    // Initialize all vegetables with 0 sales
    vegetables.forEach(veg => {
      stats.set(veg.id, {
        vegetable: veg,
        totalSold: 0,
        totalRevenue: 0
      });
    });
    
    // Calculate sales from bills
    bills.forEach(bill => {
      bill.items?.forEach(item => {
        const current = stats.get(item.vegetableId);
        if (current) {
          current.totalSold += item.quantityKg;
          current.totalRevenue += item.subtotal; // Use subtotal from bill item
        }
      });
    });
    
    return Array.from(stats.values());
  }, [vegetables, bills]);

  // Get max selling item
  const maxSellingItem = useMemo(() => {
    return sellingStats.reduce((max, current) => 
      current.totalSold > max.totalSold ? current : max, 
      sellingStats[0] || { vegetable: null, totalSold: 0, totalRevenue: 0 }
    );
  }, [sellingStats]);

  // Get lowest selling item (excluding items with 0 sales)
  const lowestSellingItem = useMemo(() => {
    const itemsWithSales = sellingStats.filter(item => item.totalSold > 0);
    if (itemsWithSales.length === 0) return { vegetable: null, totalSold: 0, totalRevenue: 0 };
    
    return itemsWithSales.reduce((min, current) => 
      current.totalSold < min.totalSold ? current : min, 
      itemsWithSales[0]
    );
  }, [sellingStats]);

  // Filter vegetables based on search term
  const filteredVegetables = useMemo(() => {
    if (!searchTerm.trim()) {
      return vegetables;
    }
    return vegetables.filter(veg => 
      veg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      veg.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [vegetables, searchTerm]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const handleOpenModal = (vegetable: Vegetable | null = null) => {
    setEditingVegetable(vegetable);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingVegetable(null);
  };

  const handleSubmit = async (data: Omit<Vegetable, 'id'> | Vegetable) => {
    try {
      if ('id' in data) {
        // Update existing vegetable
        await updateVegetable(data, currentDate); // Pass the selected date
        showToast(`${data.name} updated for ${formatDateForDisplay(currentDate)}!`);
      } else {
        // Add new vegetable
        await addVegetable(data, currentDate); // Pass the selected date
        showToast(`${data.name} added for ${formatDateForDisplay(currentDate)}!`);
      }
    } catch (error) {
      console.error('Error saving vegetable:', error);
      showToast('Failed to save vegetable. Please try again.', 'error');
    }
  };

  const handleDelete = async (veg: Vegetable) => {
    if (window.confirm(`Are you sure you want to delete ${veg.name} from ${formatDateForDisplay(currentDate)}? This action cannot be undone.`)) {
      try {
        await deleteVegetable(veg.id, currentDate); // Pass the selected date
        showToast(`${veg.name} deleted from ${formatDateForDisplay(currentDate)}!`);
      } catch (error) {
        console.error('Error deleting vegetable:', error);
        showToast('Failed to delete vegetable. Please try again.', 'error');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold text-slate-800">Inventory Management</h1>
          <p className="text-slate-600 mt-1">Managing stock for {formatDateForDisplay(currentDate)}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Date Selector */}
          <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2 shadow-sm">
            <CalendarDaysIcon className="h-5 w-5 text-slate-400" />
            <input
              type="date"
              value={formatDateForInput(currentDate)}
              onChange={(e) => {
                // Parse YYYY-MM-DD into a local Date to avoid timezone offset issues
                const val = e.target.value;
                if (!val) return;
                const [yearStr, monthStr, dayStr] = val.split('-');
                const year = Number(yearStr);
                const month = Number(monthStr) - 1; // monthIndex
                const day = Number(dayStr);
                const newDate = new Date(year, month, day);
                handleDateChange(newDate);
              }}
              className="border-0 bg-transparent focus:outline-none focus:ring-0 text-sm font-medium text-slate-700"
            />
          </div>
          <Button onClick={() => handleOpenModal()}>
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Stock
          </Button>
        </div>
      </div>

      {/* Selling Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MetricCard
          title="Max Selling Item"
          value={maxSellingItem.vegetable ? `${maxSellingItem.vegetable.name} (${maxSellingItem.totalSold} ${maxSellingItem.vegetable.unitType === 'KG' ? 'kg' : 'pieces'})` : 'No sales data'}
          icon={
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
        <MetricCard
          title="Lowest Selling Item"
          value={lowestSellingItem.vegetable ? `${lowestSellingItem.vegetable.name} (${lowestSellingItem.totalSold} ${lowestSellingItem.vegetable.unitType === 'KG' ? 'kg' : 'pieces'})` : 'No sales data'}
          icon={
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
          }
        />
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:placeholder-slate-500 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Search vegetables by name or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {searchTerm && (
          <div className="mt-2 text-sm text-slate-600">
            Found {filteredVegetables.length} of {vegetables.length} vegetables
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-500">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3">Serial No</th>
                <th scope="col" className="px-6 py-3">Item Name</th>
                <th scope="col" className="px-6 py-3">Unit Type</th>
                <th scope="col" className="px-6 py-3">Category</th>
                <th scope="col" className="px-6 py-3 text-right">Price</th>
                <th scope="col" className="px-6 py-3 text-right">Total Stock</th>
                <th scope="col" className="px-6 py-3 text-right">Available Stock</th>
                <th scope="col" className="px-6 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredVegetables.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                    {searchTerm ? 'No vegetables found matching your search.' : 'No vegetables in inventory.'}
                  </td>
                </tr>
              ) : (
                filteredVegetables.map((veg, index) => {
                  const availableStock = getAvailableStock(veg);
                  const isLowStock = availableStock <= (veg.totalStockKg * 0.2); // Low stock warning at 20%
                  
                  return (
                  <tr key={veg.id} className="bg-white border-b hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {index + 1}
                  </td>
                  <th scope="row" className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                    <div className="flex items-center">
                        {veg.name}
                    </div>
                  </th>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      veg.unitType === 'KG' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {veg.unitType}
                    </span>
                  </td>
                  <td className="px-6 py-4">{veg.category}</td>
                  <td className="px-6 py-4 text-right">
                    ₹{veg.pricePerKg}/{veg.unitType === 'KG' ? 'kg' : 'piece'}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold">
                    {veg.unitType === 'KG' ? veg.totalStockKg : Math.floor(veg.totalStockKg)} {veg.unitType === 'KG' ? 'kg' : 'pieces'}
                  </td>
                  <td className={`px-6 py-4 text-right font-semibold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                    {veg.unitType === 'KG' ? availableStock : Math.floor(availableStock)} {veg.unitType === 'KG' ? 'kg' : 'pieces'}
                    {isLowStock && availableStock > 0 && <span className="ml-1 text-xs text-red-600">(Low)</span>}
                    {availableStock === 0 && <span className="ml-1 text-xs text-red-600">(Out)</span>}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center space-x-2">
                      <button onClick={() => handleOpenModal(veg)} className="p-2 text-slate-500 hover:text-primary-600 rounded-full hover:bg-slate-100">
                        <PencilSquareIcon className="h-5 w-5" />
                      </button>
                      <button onClick={() => handleDelete(veg)} className="p-2 text-slate-500 hover:text-red-600 rounded-full hover:bg-slate-100">
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <VegetableFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        vegetableToEdit={editingVegetable}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Inventory;
