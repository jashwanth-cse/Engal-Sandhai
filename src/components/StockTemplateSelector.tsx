import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { getDateKey } from '../services/dbService';
import type { Vegetable } from '../../types/types';
import { CalendarIcon, MagnifyingGlassIcon, ArrowRightIcon } from './ui/Icon.tsx';
import Button from './ui/Button.tsx';

interface StockTemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (vegetable: Vegetable) => void;
  currentDate: Date;
  onUseTemplate?: (vegetables: Vegetable[]) => void; // optional bulk apply handler
}

const StockTemplateSelector: React.FC<StockTemplateSelectorProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  currentDate,
  onUseTemplate,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [templateVegetables, setTemplateVegetables] = useState<Vegetable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasFetched, setHasFetched] = useState(false);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Prompt the user to choose a date, do not select a default or auto-fetch
      setSelectedDate('');
      setTemplateVegetables([]);
      setError(null);
      setHasFetched(false);
    }
  }, [isOpen, currentDate]);

  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplayShort = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const fetchTemplateStock = async (dateToFetch?: Date) => {
    setHasFetched(true);
    const targetDate = dateToFetch ? formatDateForInput(dateToFetch) : selectedDate;
    
    if (!targetDate) {
      setError('Please select a date');
      return;
    }

    setLoading(true);
    setError(null);
    setSearchTerm('');

    try {
      const dateKey = getDateKey(new Date(targetDate));
      const vegetablesCol = collection(db, 'vegetables', dateKey, 'items');
      const snapshot = await getDocs(vegetablesCol);

      if (snapshot.empty) {
        setError('No stock data found for this date');
        setTemplateVegetables([]);
      } else {
        const vegetables: Vegetable[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Vegetable));
        setTemplateVegetables(vegetables);
      }
    } catch (err) {
      console.error('Error fetching template stock:', err);
      setError('Failed to load stock data');
      setTemplateVegetables([]);
    } finally {
      setLoading(false);
    }
  };

  const formatQty = (num: number, unitType: string) => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    if (unitType === 'KG') {
      // If integer, show without decimals, otherwise show 1 decimal place
      return (Number(num) % 1 === 0) ? Number(num).toFixed(0) : Number(Math.round(Number(num) * 10) / 10).toFixed(1);
    }
    // For count units, show integer
    return `${Math.floor(Number(num))}`;
  };

  const handleTemplateSelect = (vegetable: Vegetable) => {
    onSelectTemplate(vegetable);
    onClose();
  };

  const handleUseTemplate = () => {
    if (typeof onUseTemplate === 'function') {
      onUseTemplate(templateVegetables);
      onClose();
    }
  };

  // Filter vegetables based on search term
  const filteredVegetables = templateVegetables.filter(veg =>
    veg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    veg.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-down" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (Green) */}
        <div className="relative bg-gradient-to-r from-primary-600 to-primary-500 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* left side - no back button (removed) */}
              <div>
                <h2 className="text-lg sm:text-2xl font-bold text-white">Stock Templates</h2>
                <p className="text-primary-100 text-sm mt-0.5 text-white/90">Select a previous day's stock</p>
              </div>
            </div>
            <button onClick={onClose} title="Close" aria-label="Close stock templates" className="p-2 rounded-full hover:bg-white/20 transition-all">
              <ArrowRightIcon className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        {/* Search and Date Selector - Compact */}
        <div className="p-4 bg-white border-b border-slate-200">
          <div className="flex items-center space-x-3">
            {/* Search Bar */}
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search items..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
              />
            </div>
            
            <div className="flex items-center">
              {/* label that triggers the hidden input; also has fallback onClick to programmatically open */}
              <label
                htmlFor="date_picker_input"
                onClick={() => dateInputRef.current?.click()}
                className="relative flex items-center gap-3 px-3 py-2 bg-white border border-slate-300 rounded-full cursor-pointer hover:shadow-sm"
              >
                <span className="text-sm text-slate-700 pointer-events-none flex-1 text-left">{formatDateForDisplayShort(selectedDate || '') || 'Select date'}</span>
                <CalendarIcon className="h-5 w-5 text-slate-600 ml-2 pointer-events-none" />
                <input
                  id="date_picker_input"
                  ref={dateInputRef}
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    const newVal = e.target.value;
                    setSelectedDate(newVal);
                    // Parse into date to avoid race conditions with setState
                    if (newVal) {
                      try { fetchTemplateStock(new Date(newVal)); } catch (_) { /* ignore */ }
                    }
                  }}
                  max={formatDateForInput(new Date(currentDate.getTime() - 86400000))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  title="Select date"
                  aria-label="Select template date"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Content - List View with Better Design */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {error && hasFetched && (
            <div className="m-4 bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-red-500 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium">{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
                <CalendarIcon className="absolute inset-0 m-auto h-6 w-6 text-primary-600" />
              </div>
              <p className="text-slate-600 font-medium mt-4">Loading templates...</p>
            </div>
          )}

          {!loading && filteredVegetables.length === 0 && templateVegetables.length > 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="p-4 bg-white rounded-full shadow-md mb-4">
                <MagnifyingGlassIcon className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">No items match your search</p>
              <p className="text-slate-400 text-sm mt-1">Try different keywords</p>
            </div>
          )}

          {!loading && templateVegetables.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="p-4 bg-gradient-to-br from-primary-100 to-primary-50 rounded-2xl shadow-lg mb-4">
                <CalendarIcon className="h-10 w-10 text-primary-600" />
              </div>
              <p className="text-slate-700 font-semibold text-lg">Select date to load stock</p>
              <p className="text-slate-500 text-sm mt-1">Choose a date above to view stock templates.</p>
            </div>
          )}

          {!loading && filteredVegetables.length > 0 && (
            <div className="p-4 space-y-2">
              {filteredVegetables.map((veg, index) => (
                <button
                  key={veg.id}
                  onClick={() => handleTemplateSelect(veg)}
                  className="w-full text-left p-4 bg-white hover:bg-gradient-to-r hover:from-primary-50 hover:to-white border-2 border-transparent hover:border-primary-300 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md group"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center space-x-4 flex-1">
                      {/* Serial Number Badge */}
                      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-primary-100 to-primary-50 rounded-lg flex items-center justify-center group-hover:from-primary-200 group-hover:to-primary-100 transition-all">
                        <span className="text-sm font-bold text-primary-700">{index + 1}</span>
                      </div>
                      
                      {/* Item Details */}
                      <div className="flex-1 min-w-0">
                        <div className="mb-1">
                          <h4 className="font-bold text-slate-900 group-hover:text-primary-700 transition-colors truncate text-base sm:text-lg">
                            { veg.localName || veg.name }
                          </h4>
                          { veg.localName && (
                            <div className="text-slate-600 text-sm">{veg.name}</div>
                          )}
                        </div>
                        {/* bottom meta */}
                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                          <div className="text-slate-600">Category: <span className="font-medium text-slate-800">{veg.category}</span></div>
                          <div className="text-slate-600">Stock: <span className="font-medium text-slate-800">{formatQty(veg.totalStockKg, veg.unitType)} {veg.unitType === 'KG' ? 'kg' : 'pcs'}</span></div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Price (green text aligned right) */}
                    <div className="flex-shrink-0 ml-4 text-right flex flex-col items-end justify-center">
                      <div className="text-lg font-bold text-green-600">₹{veg.pricePerKg.toFixed(2)}</div>
                      <div className="text-xs text-slate-500">per {veg.unitType === 'KG' ? 'kg' : 'pc'}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Count and Use Template Button */}
        {templateVegetables.length > 0 && (
          <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between gap-4">
            <div className="text-sm text-slate-600">
              Template from <span className="font-semibold text-slate-900">{selectedDate ? new Date(selectedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span> has <span className="font-bold text-slate-900">{templateVegetables.length}</span> items
            </div>
            <div className="flex items-center gap-3">
              <Button className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-xl shadow-lg" onClick={handleUseTemplate}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 inline" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5v6a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-6" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 12.75 12 16.5l3.75-3.75" />
                </svg>
                Use This Template
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockTemplateSelector;
