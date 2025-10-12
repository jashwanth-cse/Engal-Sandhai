import React, { useState, useMemo, useEffect } from 'react';
import type { Bill, Vegetable, BillItem } from '../../types/types';
import Button from './ui/Button.tsx';
import FilterBar, { FilterState } from './FilterBar.tsx';
import { formatRoundedTotal } from '../utils/roundUtils';
import { db } from '../firebase';
import { doc, getDoc, collection, query as fsQuery, where, getDocs } from 'firebase/firestore';

interface RecentTransactionsProps {
  bills: Bill[];
  vegetables: Vegetable[];
  title?: string;
  onViewOrder: (billId: string) => void;
  onUpdateBillStatus?: (billId: string, status: 'pending' | 'packed' | 'delivered' | 'inprogress' | 'bill_sent') => void;
  onUpdateBill?: (billId: string, updates: Partial<Bill>) => void;
  onDateSelectionChange?: (date: Date | null) => void; // Add date selection handler
}

const RecentTransactions: React.FC<RecentTransactionsProps> = ({ bills, vegetables, title = "All Transactions", onViewOrder, onUpdateBillStatus, onUpdateBill, onDateSelectionChange }) => {
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    date: ''
  });
  const [sortConfig, setSortConfig] = useState<{
    key: 'date' | 'total' | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  const vegetableMap = new Map(vegetables.map(v => [v.id, v]));
  const [userInfoMap, setUserInfoMap] = useState<Record<string, { name: string; department?: string }>>({});

  useEffect(() => {
    const loadUserInfos = async () => {
      const missing = new Set<string>();
      (bills || []).forEach(b => {
        const uid = String((b as any).customerId || b.customerName || '').trim();
        if (uid && !userInfoMap[uid]) missing.add(uid);
      });
      if (missing.size === 0) return;
      const entries: [string, { name: string; department?: string }][] = [];
      await Promise.all(Array.from(missing).map(async (uid) => {
        try {
          const ref = doc(db, 'users', uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const data = snap.data() as any;
            const emp = data.employee || {};
            const name = emp.name || data['employee name'] || data.employee_name || data.name || 'Unknown';
            const department = emp.department || data['employee department'] || data.department;
            entries.push([uid, { name: String(name), department: department ? String(department) : undefined }]);
          } else {
            // Fallback: search by employee_id
            const usersCol = collection(db, 'users');
            const byEmpId = fsQuery(usersCol, where('employee_id', '==', uid));
            const byNestedEmpId = fsQuery(usersCol, where('employee.employee_id', '==', uid));
            let foundDoc: any | null = null;
            const [snap1, snap2] = await Promise.all([getDocs(byEmpId), getDocs(byNestedEmpId)]);
            if (!snap1.empty) foundDoc = snap1.docs[0].data();
            else if (!snap2.empty) foundDoc = snap2.docs[0].data();
            if (foundDoc) {
              const emp2 = foundDoc.employee || {};
              const name2 = emp2.name || foundDoc['employee name'] || foundDoc.employee_name || foundDoc.name || 'Unknown';
              const department2 = emp2.department || foundDoc['employee department'] || foundDoc.department;
              entries.push([uid, { name: String(name2), department: department2 ? String(department2) : undefined }]);
            } else {
              entries.push([uid, { name: 'Unknown' }]);
            }
          }
        } catch {
          entries.push([uid, { name: 'Unknown' }]);
        }
      }));
      if (entries.length > 0) setUserInfoMap(prev => ({ ...prev, ...Object.fromEntries(entries) }));
    };
    loadUserInfos();
  }, [bills, userInfoMap]);

  const formatItems = (items: BillItem[], bags?: number) => {
    const itemText = items && items.length > 0 
      ? items.map(item => {
          const vegetable = vegetableMap.get(item.vegetableId);
          if (vegetable) {
            return `${vegetable.name} (${item.quantityKg}kg)`;
          } else {
            // Try to get the name from the item data itself (if preserved from historical data)
            const itemName = (item as any).name || item.vegetableId.replace('veg_', '').replace(/_/g, ' ').toUpperCase();
            return `${itemName} (${item.quantityKg}kg)`;
          }
        }).join(', ')
      : 'No items';
    
    if (bags && bags > 0) {
      return `${itemText}, Bags (${bags})`;
    }
    return itemText;
  };

  const getStatusStyles = (status: 'pending' | 'packed' | 'delivered' | 'inprogress' | 'bill_sent') => {
    switch (status) {
      case 'pending':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'inprogress':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'packed':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'bill_sent':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
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

  const handleStatusChange = (billId: string, newStatus: 'pending' | 'packed' | 'delivered' | 'inprogress' | 'bill_sent') => {
    if (onUpdateBillStatus) {
      onUpdateBillStatus(billId, newStatus);
    }
  };

  // Filter bills based on current filters
  const filteredBills = useMemo(() => {
    let filtered = bills || [];

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
  }, [bills, filters, sortConfig]);

  // Calculate counts for filter tabs
  const statusCounts = useMemo(() => {
    const pending = bills.filter(bill => (bill.status || 'pending') === 'pending').length;
    const inprogress = bills.filter(bill => (bill.status || 'pending') === 'inprogress').length;
    const packed = bills.filter(bill => (bill.status || 'pending') === 'packed').length;
    const bill_sent = bills.filter(bill => (bill.status || 'pending') === 'bill_sent').length;
    const delivered = bills.filter(bill => (bill.status || 'pending') === 'delivered').length;
    return { pending, inprogress, packed, bill_sent, delivered };
  }, [bills]);
  return (
    <div className="space-y-4">
      <FilterBar 
        filters={filters}
        onFiltersChange={setFilters}
        onDateSelectionChange={onDateSelectionChange}
        pendingCount={statusCounts.pending}
        inprogressCount={statusCounts.inprogress}
        packedCount={statusCounts.packed}
        billSentCount={statusCounts.bill_sent}
        deliveredCount={statusCounts.delivered}
      />
      
      <div className="bg-white rounded-xl shadow-lg">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-500">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3">S.No</th>
                <th scope="col" className="px-6 py-3">Employee Name</th>
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
                <th scope="col" className="px-6 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length === 0 ? (
                  <tr>
                      <td colSpan={9} className="text-center py-10 text-slate-500">No transactions found.</td>
                  </tr>
              ) : (
                  filteredBills.map((bill, idx) => (
                <tr key={bill.id} className="bg-white border-b hover:bg-slate-50">
                    <td className="px-6 py-4 text-slate-700">{idx + 1}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{userInfoMap[String((bill as any).customerId || bill.customerName || '')]?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-700">{String((bill as any).customerId || bill.customerName)}</td>
                    <td className="px-6 py-4 text-slate-600">{userInfoMap[String((bill as any).customerId || bill.customerName || '')]?.department || bill.department || 'N/A'}</td>
                    <td className="px-6 py-4">{new Date(bill.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm" title={formatItems(bill.items || [], bill.bags)}>
                      {(bill.items || []).length} {(bill.items || []).length === 1 ? 'item' : 'items'}{bill.bags && bill.bags > 0 ? ` + ${bill.bags} bag${bill.bags === 1 ? '' : 's'}` : ''}
                    </td>
                    <td className="px-6 py-4">
                      <div className="status-dropdown">
                        <select
                          value={bill.status || 'pending'}
                          onChange={(e) => handleStatusChange(bill.id, e.target.value as 'pending' | 'packed' | 'delivered' | 'inprogress' | 'bill_sent')}
                          className={`text-sm rounded-md border focus:ring-2 focus:ring-opacity-50 font-medium px-3 py-1.5 ${getStatusStyles(bill.status || 'pending')}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="inprogress">In Progress</option>
                          <option value="packed">Packed</option>
                          <option value="bill_sent">Bill Sent</option>
                          <option value="delivered">Delivered</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-800">
                        {formatRoundedTotal(bill.total)}
                    </td>
                    <td className="px-6 py-4 text-center">
                        <Button onClick={() => onViewOrder(bill.id)} className="px-3 py-1 text-xs">
                        View
                        </Button>
                    </td>
                </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
};

export default RecentTransactions;