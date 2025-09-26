import React, { useState, useMemo } from 'react';
import type { Vegetable, Bill } from '../../types/types';
import Button from './ui/Button.tsx';
import { PlusIcon, PencilSquareIcon, TrashIcon, MagnifyingGlassIcon } from './ui/Icon.tsx';
import VegetableFormModal from './VegetableFormModal.tsx';
import Toast from './ui/Toast.tsx';
import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';

interface InventoryProps {
  vegetables: Vegetable[];
  bills: Bill[]; // Add bills to calculate available stock
  addVegetable: (newVegetable: Omit<Vegetable, 'id'>) => void;
  updateVegetable: (updatedVegetable: Vegetable) => void;
  deleteVegetable: (vegId: string) => void;
}

type ToastState = {
    message: string;
    type: 'success' | 'error';
} | null;

const Inventory: React.FC<InventoryProps> = ({
  vegetables,
  bills,
  addVegetable,
  updateVegetable,
  deleteVegetable,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVegetable, setEditingVegetable] = useState<Vegetable | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  // Calculate available stock for each vegetable
  const getAvailableStock = (vegetable: Vegetable) => {
    const used = usedStock.get(vegetable.id) || 0;
    return Math.max(0, vegetable.totalStockKg - used);
  };

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
    const userId = window.localStorage.getItem('userId') || '';
    if ('id' in data) {
      updateVegetable(data);
      showToast(`${data.name} updated successfully!`);
      // Update stock in Firestore
      const stockRef = doc(db, 'stocks', data.id);
      await updateDoc(stockRef, {
        name: data.name,
        category: data.category,
        pricePerKg: data.pricePerKg,
        totalStockKg: data.totalStockKg,
        updatedAt: new Date(),
        updatedBy: userId,
        role: "admin"
      });
    } else {
      addVegetable(data);
      showToast(`${data.name} added successfully!`);
      // Add stock to Firestore
      await addDoc(collection(db, 'stocks'), {
        name: data.name,
        category: data.category,
        pricePerKg: data.pricePerKg,
        totalStockKg: data.totalStockKg,
        createdAt: new Date(),
        createdBy: userId,
        role: "admin"
      });
    }
  };

  const handleDelete = (veg: Vegetable) => {
    if (window.confirm(`Are you sure you want to delete ${veg.name}? This action cannot be undone.`)) {
      deleteVegetable(veg.id);
      showToast(`${veg.name} deleted.`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-800">Inventory Management</h1>
        <Button onClick={() => handleOpenModal()}>
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Stock
        </Button>
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
                    ₹{veg.pricePerKg.toFixed(2)}/{veg.unitType === 'KG' ? 'kg' : 'piece'}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold">
                    {veg.totalStockKg.toFixed(veg.unitType === 'KG' ? 1 : 0)} {veg.unitType === 'KG' ? 'kg' : 'pieces'}
                  </td>
                  <td className={`px-6 py-4 text-right font-semibold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                    {availableStock.toFixed(veg.unitType === 'KG' ? 1 : 0)} {veg.unitType === 'KG' ? 'kg' : 'pieces'}
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
