import React, { useState, useMemo } from 'react';
import type { Vegetable, Bill } from '../../types/types';
import Button from './ui/Button.tsx';
import { PlusIcon, PencilSquareIcon, TrashIcon } from './ui/Icon.tsx';
import VegetableFormModal from './VegetableFormModal.tsx';
import Toast from './ui/Toast.tsx';

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

  const handleSubmit = (data: Omit<Vegetable, 'id'> | Vegetable) => {
    if ('id' in data) {
      updateVegetable(data);
      showToast(`${data.name} updated successfully!`);
    } else {
      addVegetable(data);
      showToast(`${data.name} added successfully!`);
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
            Add Vegetable
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-500">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3">Serial No</th>
                <th scope="col" className="px-6 py-3">Item Name</th>
                <th scope="col" className="px-6 py-3">Category</th>
                <th scope="col" className="px-6 py-3 text-right">Price</th>
                <th scope="col" className="px-6 py-3 text-right">Total Stock</th>
                <th scope="col" className="px-6 py-3 text-right">Available Stock</th>
                <th scope="col" className="px-6 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {vegetables.map((veg, index) => {
                const availableStock = getAvailableStock(veg);
                const isLowStock = availableStock <= (veg.totalStockKg * 0.2); // Low stock warning at 20%
                
                return (
                <tr key={veg.id} className="bg-white border-b hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {index + 1}
                  </td>
                  <th scope="row" className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                    <div className="flex items-center">
                        <span className="text-2xl mr-3">{veg.icon}</span>
                        {veg.name}
                    </div>
                  </th>
                  <td className="px-6 py-4">{veg.category}</td>
                  <td className="px-6 py-4 text-right">₹{veg.pricePerKg.toFixed(2)}/kg</td>
                  <td className="px-6 py-4 text-right font-semibold">{veg.totalStockKg.toFixed(1)} kg</td>
                  <td className={`px-6 py-4 text-right font-semibold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                    {availableStock.toFixed(1)} kg
                    {isLowStock && availableStock > 0 && <span className="ml-1 text-xs">⚠️</span>}
                    {availableStock === 0 && <span className="ml-1 text-xs">❌</span>}
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
              })}
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
