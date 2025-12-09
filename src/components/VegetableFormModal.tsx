import React, { useState, useEffect, FormEvent } from 'react';
import type { Vegetable } from '../../types/types';
import Button from './ui/Button.tsx';
import { XMarkIcon, PlusIcon, CheckCircleIcon } from './ui/Icon.tsx';

interface VegetableFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (vegetable: Omit<Vegetable, 'id'> | Vegetable, isAddMode?: boolean) => void;
  vegetableToEdit?: Vegetable | null;
  templateData?: Vegetable | null;
}

const VegetableFormModal: React.FC<VegetableFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  vegetableToEdit,
  templateData,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stockUpdateMode, setStockUpdateMode] = useState<'SET' | 'ADD'>('SET');
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
      setStockUpdateMode('SET'); // Reset to SET when editing
    } else if (templateData) {
      // Pre-fill with template data
      setFormData({
        name: templateData.name,
        unitType: templateData.unitType || 'KG',
        pricePerKg: String(templateData.pricePerKg),
        totalStockKg: String(templateData.totalStockKg || templateData.stockKg),
        stockKg: String(templateData.stockKg),
        category: templateData.category,
      });
      setStockUpdateMode('SET');
    } else {
      setFormData({ name: '', unitType: 'KG', pricePerKg: '', totalStockKg: '', stockKg: '', category: '' });
      setStockUpdateMode('SET');
    }
  }, [vegetableToEdit, templateData, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Clear prior error when user edits
    setErrorMessage(null);

    // If changing unit type to COUNT, sanitize totalStockKg to remove decimal part
    if (name === 'unitType') {
      const newUnit = value as 'KG' | 'COUNT';
      if (newUnit === 'COUNT') {
        // Remove any decimal portion from totalStockKg and stockKg
        setFormData(prev => ({
          ...prev,
          unitType: newUnit,
          totalStockKg: prev.totalStockKg ? String(Math.floor(Number(prev.totalStockKg) || 0)) : prev.totalStockKg,
          stockKg: prev.stockKg ? String(Math.floor(Number(prev.stockKg) || 0)) : prev.stockKg,
        }));
        return;
      }
    }

    // If editing totalStockKg while unitType is COUNT, coerce to integer immediately
    if (name === 'totalStockKg') {
      // When COUNT, disallow decimal part by flooring the numeric value
      if (formData.unitType === 'COUNT') {
        // Allow empty input
        if (value === '') {
          setFormData(prev => ({ ...prev, [name]: '' }));
          return;
        }

        // Parse and floor; if non-numeric, keep original input so user can correct
        const num = Number(value);
        if (!isNaN(num)) {
          const floored = Math.floor(num < 0 ? 0 : num);
          setFormData(prev => ({ ...prev, [name]: String(floored) }));
          return;
        }
      }
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Validate COUNT type must be whole number (no decimals)
    if (formData.unitType === 'COUNT') {
      const val = formData.totalStockKg;
      if (val === '' || isNaN(Number(val))) {
        setErrorMessage('Please enter a valid integer for total pieces.');
        return;
      }
      if (Number(val) % 1 !== 0) {
        setErrorMessage('Count must be a whole number (no decimals).');
        return;
      }
    }

    let totalStockValue = formData.unitType === 'COUNT' ? parseInt(formData.totalStockKg || '0', 10) : parseFloat(formData.totalStockKg || '0');
    let stockKgValue = totalStockValue;

    // If editing and ADD mode is selected, add to existing stock
    if (vegetableToEdit && stockUpdateMode === 'ADD') {
      const addAmount = totalStockValue;
      totalStockValue = vegetableToEdit.totalStockKg + addAmount;
      // For availableStockKg calculation: add the full amount (no 85% restriction on ADD)
      // The available stock in DB is current available, we add the full amount to it
      stockKgValue = totalStockValue; // This will be used to calculate diff in dbService
    }

    const processedData = {
      name: formData.name,
      unitType: formData.unitType as 'KG' | 'COUNT',
      pricePerKg: parseFloat(formData.pricePerKg),
      totalStockKg: totalStockValue,
      stockKg: stockKgValue,
      category: formData.category,
    };

    if (vegetableToEdit) {
      onSubmit({ ...processedData, id: vegetableToEdit.id }, stockUpdateMode === 'ADD');
    } else {
      onSubmit(processedData, false);
    }
    onClose();
  };
  
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-auto my-8 overflow-hidden animate-fade-in-down" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-primary-600 to-primary-500 text-white">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-white/10 p-2">
                <PlusIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{vegetableToEdit ? 'Edit Stock' : templateData ? 'Add Stock from Template' : 'Add New Stock'}</h2>
                <p className="text-primary-100 text-xs mt-0.5">Add or update inventory items for the selected date</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20">
                <XMarkIcon className="h-5 w-5 text-white" />
            </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 bg-white max-h-[calc(100vh-200px)] overflow-y-auto">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="block w-full rounded-lg border border-slate-200 shadow-sm focus:border-primary-500 focus:ring-primary-200 bg-white text-slate-900 placeholder-slate-400 px-4 py-3" placeholder="e.g., Cherry Tomato" />
            <p className="text-xs text-slate-500 mt-1">Enter the item name used in billing and inventory</p>
          </div>
          
          <div>
            <label htmlFor="unitType" className="block text-sm font-medium text-slate-700 mb-1">Unit Type</label>
            <select name="unitType" id="unitType" value={formData.unitType} onChange={handleChange} required className="block w-full rounded-lg border border-slate-200 shadow-sm focus:border-primary-500 focus:ring-primary-200 bg-white text-slate-900 px-4 py-3">
              <option value="KG">KG</option>
              <option value="COUNT">COUNT</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">KG for weights, COUNT for pieces</p>
          </div>

          {vegetableToEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Stock Update Mode</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStockUpdateMode('SET')}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all ${
                    stockUpdateMode === 'SET'
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  SET
                </button>
                <button
                  type="button"
                  onClick={() => setStockUpdateMode('ADD')}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all ${
                    stockUpdateMode === 'ADD'
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ADD
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {stockUpdateMode === 'SET' 
                  ? 'SET: Replace current stock with new value' 
                  : 'ADD: Add to existing stock (Total: ' + (vegetableToEdit.totalStockKg || 0) + ' ' + (vegetableToEdit.unitType === 'KG' ? 'kg' : 'pcs') + ')'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              

              <label htmlFor="pricePerKg" className="block text-sm font-medium text-slate-700">
                Price per {formData.unitType === 'KG' ? 'kg' : 'piece'} (₹)
              </label>
              <div className="mt-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                <input type="number" name="pricePerKg" id="pricePerKg" value={formData.pricePerKg} onChange={handleChange} required min="0" step="0.01" className="block w-full pl-9 rounded-lg border border-slate-200 shadow-sm focus:border-primary-500 focus:ring-primary-200 bg-white text-slate-900 placeholder-slate-400 px-3 py-3" placeholder="e.g., 150.50" />
              </div>
            </div>
            <div>

              <label htmlFor="totalStockKg" className="block text-sm font-medium text-slate-700">
                {vegetableToEdit && stockUpdateMode === 'ADD' ? `Add Stock (${formData.unitType === 'KG' ? 'kg' : 'pieces'})` : `Total Stock (${formData.unitType === 'KG' ? 'kg' : 'pieces'})`}
              </label>
              <input type="number" name="totalStockKg" id="totalStockKg" value={formData.totalStockKg} onChange={handleChange} required min="0" step={formData.unitType === 'KG' ? '0.1' : '1'} className="mt-1 block w-full rounded-lg border border-slate-200 shadow-sm focus:border-primary-500 focus:ring-primary-200 bg-white text-slate-900 placeholder-slate-400 px-4 py-3" placeholder={formData.unitType === 'KG' ? 'e.g., 25.5' : 'e.g., 100'} />
              <p className="text-xs text-slate-500 mt-1">
                {vegetableToEdit && stockUpdateMode === 'ADD' 
                  ? 'Amount to add to current stock' 
                  : 'Enter total stock available for this item'}
              </p>
            </div>
          </div>
          
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-slate-700">Category</label>
            <select name="category" id="category" value={formData.category} onChange={handleChange} required className="mt-1 block w-full rounded-md border border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white text-slate-900 px-3 py-2">
              <option value="">Select a category</option>
              <option value="Fruits">Fruits</option>
              <option value="Vegetables">Vegetables</option>
              <option value="Greens">Greens</option>
              <option value="Others">Others</option>
            </select>
          </div>

          {templateData && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5" />
                <p className="text-sm font-medium text-green-700">Template loaded</p>
                <p className="text-xs text-green-600 mt-0.5">Values are pre-filled. Update any field before saving.</p>
              </p>
            </div>
          )}
          
          <div className="flex justify-end pt-3 space-x-3 border-t mt-4 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200"
            >
              Cancel
            </button>
            <Button type="submit" className="bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:from-primary-700 hover:to-primary-600">{vegetableToEdit ? 'Save Changes' : 'Add Stock'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VegetableFormModal;