import React, { useState, useEffect, FormEvent } from 'react';
import type { Vegetable } from '../../types/types';
import Button from './ui/Button.tsx';
import { XMarkIcon } from './ui/Icon.tsx';

interface VegetableFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (vegetable: Omit<Vegetable, 'id'> | Vegetable) => void;
  vegetableToEdit?: Vegetable | null;
}

const VegetableFormModal: React.FC<VegetableFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  vegetableToEdit,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    unitType: 'KG' as 'KG' | 'COUNT',
    pricePerKg: '',
    totalStockKg: '',
    stockKg: '',
    category: '',
  });

  useEffect(() => {
    if (vegetableToEdit) {
      setFormData({
        name: vegetableToEdit.name,
        unitType: vegetableToEdit.unitType || 'KG', // Default to KG for existing items
        pricePerKg: String(vegetableToEdit.pricePerKg),
        totalStockKg: String(vegetableToEdit.totalStockKg || vegetableToEdit.stockKg), // Fallback for existing data
        stockKg: String(vegetableToEdit.stockKg),
        category: vegetableToEdit.category,
      });
    } else {
      setFormData({ name: '', unitType: 'KG', pricePerKg: '', totalStockKg: '', stockKg: '', category: '' });
    }
  }, [vegetableToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const processedData = {
      name: formData.name,
      unitType: formData.unitType as 'KG' | 'COUNT',
      pricePerKg: parseFloat(formData.pricePerKg),
      totalStockKg: parseFloat(formData.totalStockKg),
      stockKg: parseFloat(formData.totalStockKg), // Set stockKg to totalStockKg initially
      category: formData.category,
    };

    if (vegetableToEdit) {
      onSubmit({ ...processedData, id: vegetableToEdit.id });
    } else {
      onSubmit(processedData);
    }
    onClose();
  };
  
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in-down"
    >
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b bg-slate-50 rounded-t-lg">
            <h2 className="text-xl font-bold text-slate-800">{vegetableToEdit ? 'Edit Stock' : 'Add New Stock'}</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200">
                <XMarkIcon className="h-6 w-6 text-slate-600" />
            </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="block w-full rounded-md border border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white text-slate-900 placeholder-slate-400 px-3 py-2" placeholder="e.g., Cherry Tomato" />
          </div>
          
          <div>
            <label htmlFor="unitType" className="block text-sm font-medium text-slate-700 mb-1">Unit Type</label>
            <select name="unitType" id="unitType" value={formData.unitType} onChange={handleChange} required className="block w-full rounded-md border border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white text-slate-900 px-3 py-2">
              <option value="KG">KG (Kilogram)</option>
              <option value="COUNT">COUNT (Pieces)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pricePerKg" className="block text-sm font-medium text-slate-700">
                Price per {formData.unitType === 'KG' ? 'kg' : 'piece'} (₹)
              </label>
              <input type="number" name="pricePerKg" id="pricePerKg" value={formData.pricePerKg} onChange={handleChange} required min="0" step="0.01" className="mt-1 block w-full rounded-md border border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white text-slate-900 placeholder-slate-400 px-3 py-2" placeholder="e.g., 150.50" />
            </div>
            <div>
              <label htmlFor="totalStockKg" className="block text-sm font-medium text-slate-700">
                Total Stock ({formData.unitType === 'KG' ? 'kg' : 'pieces'})
              </label>
              <input type="number" name="totalStockKg" id="totalStockKg" value={formData.totalStockKg} onChange={handleChange} required min="0" step={formData.unitType === 'KG' ? '0.1' : '1'} className="mt-1 block w-full rounded-md border border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white text-slate-900 placeholder-slate-400 px-3 py-2" placeholder={formData.unitType === 'KG' ? 'e.g., 25.5' : 'e.g., 100'} />
              <p className="text-xs text-slate-500 mt-1">Total inventory stock for this item</p>
            </div>
          </div>
          
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-slate-700">Category</label>
            <select name="category" id="category" value={formData.category} onChange={handleChange} required className="mt-1 block w-full rounded-md border border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white text-slate-900 px-3 py-2">
              <option value="">Select a category</option>
              <option value="Fruits">Fruits</option>
              <option value="Vegetables">Vegetables</option>
              <option value="Greens">Greens</option>
            </select>
          </div>
          
          <div className="flex justify-end pt-4 space-x-3 border-t mt-6">
            <Button type="button" onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300">Cancel</Button>
            <Button type="submit">{vegetableToEdit ? 'Save Changes' : 'Add Stock'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VegetableFormModal;