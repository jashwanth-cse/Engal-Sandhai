import React, { useState, useMemo, useEffect } from 'react';
import type { Bill, Vegetable, BillItem } from '../../types/types';
import { MagnifyingGlassIcon, DocumentMagnifyingGlassIcon } from './ui/Icon.tsx';
import BillDetailModal from './BillDetailModal.tsx';
import FilterBar, { FilterState } from './FilterBar.tsx';
import { formatRoundedTotal } from '../utils/roundUtils';

interface OrdersProps {
  bills: Bill[];
  vegetables: Vegetable[];
  initialBillId?: string | null;
  onClearInitialBill: () => void;
  onUpdateBillStatus?: (billId: string, status: 'pending' | 'packed' | 'delivered') => void;
  onUpdateBill?: (billId: string, updates: Partial<Bill>) => void;
  currentUser?: { id: string; name: string; role: string; email?: string };
}

const Orders: React.FC<OrdersProps> = ({ bills, vegetables, initialBillId, onClearInitialBill, onUpdateBillStatus, onUpdateBill, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingBill, setViewingBill] = useState<Bill | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    date: ''
  });
  const [sortConfig, setSortConfig] = useState<{
    key: 'date' | 'total' | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });
  
  const vegetableMap = useMemo(() => new Map(vegetables.map(v => [v.id, v])), [vegetables]);

  const formatItems = (items: BillItem[]) => {
    if (!items || items.length === 0) return 'No items';
    return items.map(item => {
      const vegetable = vegetableMap.get(item.vegetableId);
      return vegetable ? `${vegetable.name} (${item.quantityKg}kg)` : `Unknown (${item.quantityKg}kg)`;
    }).join(', ');
  };

  const getStatusStyles = (status: 'pending' | 'packed' | 'delivered') => {
    switch (status) {
      case 'pending':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'packed':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'delivered':
        return 'bg-green-50 text-green-700 border-green-200';
      default:
        return 'bg-orange-50 text-orange-700 border-orange-200';
    }
  };

  const handleSort = (key: 'date' | 'total') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey: 'date' | 'total') => {
    if (sortConfig.key !== columnKey) {
      return (
        <span className="inline-flex ml-1 text-slate-400">
          ▲
        </span>
      );
    }
    return (
      <span className="inline-flex ml-1 text-slate-700">
        {sortConfig.direction === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  const handleStatusChange = (billId: string, newStatus: 'pending' | 'packed' | 'delivered') => {
    if (onUpdateBillStatus) {
      onUpdateBillStatus(billId, newStatus);
    }
  };

  const filteredBills = useMemo(() => {
    let filtered = bills || [];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(bill =>
        (bill.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bill.id || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(bill => (bill.status || 'pending') === filters.status);
    }

    // Apply date filter
    if (filters.date) {
      const selectedDate = new Date(filters.date);
      filtered = filtered.filter(bill => {
        const billDate = new Date(bill.date);
        return billDate.toDateString() === selectedDate.toDateString();
      });
    }

    // Apply sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'date') {
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
        } else if (sortConfig.key === 'total') {
          aValue = a.total;
          bValue = b.total;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [bills, searchTerm, filters, sortConfig]);

  // Calculate counts for filter tabs
  const statusCounts = useMemo(() => {
    const pending = bills.filter(bill => (bill.status || 'pending') === 'pending').length;
    const packed = bills.filter(bill => (bill.status || 'pending') === 'packed').length;
    const delivered = bills.filter(bill => (bill.status || 'pending') === 'delivered').length;
    return { pending, packed, delivered };
  }, [bills]);

  useEffect(() => {
    if (initialBillId) {
      const billToView = bills.find(b => b.id === initialBillId);
      if (billToView) {
        setViewingBill(billToView);
      }
      onClearInitialBill();
    }
  }, [initialBillId, bills, onClearInitialBill]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-slate-800">Order History</h1>
        <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <input
            type="text"
            placeholder="Search by customer or Bill Number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full sm:w-64 rounded-md border-slate-300 bg-white pl-10 py-2 text-slate-900 focus:ring-primary-500 focus:border-primary-500"
            />
        </div>
      </div>

      <FilterBar 
        filters={filters}
        onFiltersChange={setFilters}
        pendingCount={statusCounts.pending}
        packedCount={statusCounts.packed}
        deliveredCount={statusCounts.delivered}
      />

      <div className="bg-white rounded-xl shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-500">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3">Bill Number</th>
                <th scope="col" className="px-6 py-3">Customer</th>
                <th scope="col" className="px-6 py-3">Department</th>
                <th scope="col" className="px-6 py-3">
                  <button
                    onClick={() => handleSort('date')}
                    className="flex items-center hover:text-slate-900 transition-colors"
                  >
                    Date
                    {getSortIcon('date')}
                  </button>
                </th>
                <th scope="col" className="px-6 py-3">Items</th>
                <th scope="col" className="px-6 py-3">Status</th>
                <th scope="col" className="px-6 py-3 text-right">
                  <button
                    onClick={() => handleSort('total')}
                    className="flex items-center justify-end hover:text-slate-900 transition-colors ml-auto"
                  >
                    Total
                    {getSortIcon('total')}
                  </button>
                </th>
                <th scope="col" className="px-6 py-3 text-center">View Bill</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length === 0 ? (
                  <tr>
                      <td colSpan={8} className="text-center py-10 text-slate-500">No transactions found.</td>
                  </tr>
              ) : (
                  filteredBills.map((bill) => (
                  <tr key={bill.id} className="bg-white border-b hover:bg-slate-50">
                      <td className="px-6 py-4 font-mono text-xs text-slate-700">{bill.id}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{bill.customerName}</td>
                      <td className="px-6 py-4 text-slate-600">{bill.department || 'N/A'}</td>
                      <td className="px-6 py-4">{new Date(bill.date).toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm" title={formatItems(bill.items || [])}>
                        {(bill.items || []).length} {(bill.items || []).length === 1 ? 'item' : 'items'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="status-dropdown">
                          <select
                            value={bill.status || 'pending'}
                            onChange={(e) => handleStatusChange(bill.id, e.target.value as 'pending' | 'packed' | 'delivered')}
                            className={`text-sm rounded-md border focus:ring-2 focus:ring-opacity-50 font-medium px-3 py-1.5 ${getStatusStyles(bill.status || 'pending')}`}
                          >
                            <option value="pending">🟠 Pending</option>
                            <option value="packed">🔵 Packed</option>
                            <option value="delivered">🟢 Delivered</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-800">
                          {formatRoundedTotal(bill.total)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button 
                            onClick={() => setViewingBill(bill)}
                            className="p-2 text-slate-500 hover:text-primary-600 rounded-full hover:bg-slate-100"
                        >
                            <DocumentMagnifyingGlassIcon className="h-5 w-5" />
                        </button>
                      </td>
                  </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <BillDetailModal 
        isOpen={!!viewingBill} 
        onClose={() => setViewingBill(null)} 
        bill={viewingBill}
        vegetableMap={vegetableMap}
        onUpdateBill={onUpdateBill}
        currentUser={currentUser}
      />
    </div>
  );
};

export default Orders;