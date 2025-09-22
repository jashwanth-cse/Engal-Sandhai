import React from 'react';
import { CalendarIcon } from './ui/Icon.tsx';

export interface FilterState {
  status: 'all' | 'pending' | 'packed' | 'delivered';
  date: string;
}

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  pendingCount?: number;
  packedCount?: number;
  deliveredCount?: number;
}

const FilterBar: React.FC<FilterBarProps> = ({ 
  filters, 
  onFiltersChange, 
  pendingCount = 0, 
  packedCount = 0,
  deliveredCount = 0 
}) => {
  const handleStatusChange = (status: FilterState['status']) => {
    onFiltersChange({ ...filters, status });
  };

  const handleDateChange = (date: string) => {
    onFiltersChange({ ...filters, date });
  };

  const totalCount = pendingCount + packedCount + deliveredCount;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleStatusChange('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filters.status === 'all'
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Current Orders
            {filters.status === 'all' && (
              <span className="ml-2 px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full text-xs">
                {totalCount}
              </span>
            )}
          </button>
          
          <button
            onClick={() => handleStatusChange('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filters.status === 'pending'
                ? 'bg-orange-100 text-orange-700 border border-orange-200'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Pending
            <span className="ml-2 px-2 py-0.5 bg-orange-200 text-orange-800 rounded-full text-xs">
              {pendingCount}
            </span>
          </button>
          
          <button
            onClick={() => handleStatusChange('packed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filters.status === 'packed'
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Packed
            <span className="ml-2 px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full text-xs">
              {packedCount}
            </span>
          </button>
          
          <button
            onClick={() => handleStatusChange('delivered')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filters.status === 'delivered'
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Delivered
            <span className="ml-2 px-2 py-0.5 bg-green-200 text-green-800 rounded-full text-xs">
              {deliveredCount}
            </span>
          </button>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={filters.date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                placeholder="Select date"
              />
            </div>
          </div>
          
          <button className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
            </svg>
            Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;