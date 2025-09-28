import React, { useState, useMemo, useEffect } from 'react';
import type { Bill, Vegetable, BillItem } from '../../types/types';
import { MagnifyingGlassIcon, DocumentMagnifyingGlassIcon } from './ui/Icon.tsx';
import BillDetailModal from './BillDetailModal.tsx';
import FilterBar, { FilterState } from './FilterBar.tsx';
import { formatRoundedTotal } from '../utils/roundUtils';
import { db } from '../firebase';
import { doc, getDoc, collection, query as fsQuery, where, getDocs } from 'firebase/firestore';

interface OrdersProps {
  bills: Bill[];
  vegetables: Vegetable[];
  initialBillId?: string | null;
  onClearInitialBill: () => void;
  onUpdateBillStatus?: (billId: string, status: 'pending' | 'packed' | 'delivered') => void;
  onUpdateBill?: (billId: string, updates: Partial<Bill>) => void;
  currentUser?: { id: string; name: string; role: string; email?: string };
  onDateSelectionChange?: (date: Date | null) => void; // Add date selection handler
}

const Orders: React.FC<OrdersProps> = ({ bills, vegetables, initialBillId, onClearInitialBill, onUpdateBillStatus, onUpdateBill, currentUser, onDateSelectionChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingBill, setViewingBill] = useState<Bill | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    date: ''
  });
  const [sortConfig, setSortConfig] = useState<{
    key: 'date' | 'total' | null;
    direction: 'asc' | 'desc';
  }>({ key: 'date', direction: 'desc' });
  
  const vegetableMap = useMemo(() => new Map(vegetables.map(v => [v.id, v])), [vegetables]);

  // Cache of user info keyed by userId: { name, department }
  const [userInfoMap, setUserInfoMap] = useState<Record<string, { name: string; department?: string }>>({});

  // Fetch missing user infos for visible bills
  useEffect(() => {
    const loadUserInfos = async () => {
      const missingIds = new Set<string>();
      (bills || []).forEach(b => {
        const userId = String((b as any).customerId || b.customerName || '').trim();
        if (userId && !userInfoMap[userId]) missingIds.add(userId);
      });
      if (missingIds.size === 0) return;
      const entries: [string, { name: string; department?: string }][] = [];
      await Promise.all(Array.from(missingIds).map(async (uid) => {
        try {
          const ref = doc(db, 'users', uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const data = snap.data() as any;
            const employeeObj = data.employee || {};
            const resolvedName = employeeObj.name || data['employee name'] || data.employee_name || data.name || 'Unknown';
            const resolvedDept = employeeObj.department || data['employee department'] || data.department;
            entries.push([uid, { name: String(resolvedName), department: resolvedDept ? String(resolvedDept) : undefined }]);
          } else {
            // Fallback: look up by employee_id field
            const usersCol = collection(db, 'users');
            const byEmpId = fsQuery(usersCol, where('employee_id', '==', uid));
            const byNestedEmpId = fsQuery(usersCol, where('employee.employee_id', '==', uid));
            let foundDoc: any | null = null;
            const [snap1, snap2] = await Promise.all([getDocs(byEmpId), getDocs(byNestedEmpId)]);
            if (!snap1.empty) foundDoc = snap1.docs[0].data();
            else if (!snap2.empty) foundDoc = snap2.docs[0].data();
            if (foundDoc) {
              const employeeObj2 = foundDoc.employee || {};
              const resolvedName2 = employeeObj2.name || foundDoc['employee name'] || foundDoc.employee_name || foundDoc.name || 'Unknown';
              const resolvedDept2 = employeeObj2.department || foundDoc['employee department'] || foundDoc.department;
              entries.push([uid, { name: String(resolvedName2), department: resolvedDept2 ? String(resolvedDept2) : undefined }]);
            } else {
              entries.push([uid, { name: 'Unknown' }]);
            }
          }
        } catch {
          entries.push([uid, { name: 'Unknown' }]);
        }
      }));
      if (entries.length > 0) {
        setUserInfoMap(prev => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    };
    loadUserInfos();
  }, [bills, userInfoMap]);

  const formatItems = (items: BillItem[], bags?: number) => {
    const itemText = items && items.length > 0 
      ? items.map(item => {
          const vegetable = vegetableMap.get(item.vegetableId);
          return vegetable ? `${vegetable.name} (${item.quantityKg}kg)` : `Unknown (${item.quantityKg}kg)`;
        }).join(', ')
      : 'No items';
    
    if (bags && bags > 0) {
      return `${itemText}, Bags (${bags})`;
    }
    return itemText;
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
    if (sortConfig.key === key) {
      setSortConfig({ key, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setSortConfig({ key, direction: 'desc' });
    }
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
    // Work on a copy to avoid mutating props during sort
    let filtered = bills ? [...bills] : [];

    // Apply search filter
    if (searchTerm) {
      const needle = searchTerm.trim().toLowerCase();
      if (needle) {
        filtered = filtered.filter(bill => {
          const userKey = String((bill as any).customerId || bill.customerName || '');
          const customer = (bill.customerName || '').toLowerCase();
          const user = userInfoMap[userKey];
          const nameText = (user?.name || '').toLowerCase();
          const deptText = (user?.department || bill.department || '').toLowerCase();
          const idText = (bill.id || '').toLowerCase();
          const dept = (bill.department || '').toLowerCase();
          const itemNames = (bill.items || [])
            .map(it => (vegetableMap.get(it.vegetableId)?.name || '').toLowerCase())
            .join(' ');
          return (
            customer.includes(needle) ||
            nameText.includes(needle) ||
            deptText.includes(needle) ||
            idText.includes(needle) ||
            dept.includes(needle) ||
            itemNames.includes(needle)
          );
        });
      }
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
          const aTime = new Date(a.date).getTime();
          const bTime = new Date(b.date).getTime();
          aValue = isNaN(aTime) ? 0 : aTime;
          bValue = isNaN(bTime) ? 0 : bTime;
        } else if (sortConfig.key === 'total') {
          aValue = Number(a.total) || 0;
          bValue = Number(b.total) || 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        // Stable tie-breaker: by id to keep order deterministic
        const aId = String(a.id || '');
        const bId = String(b.id || '');
        return aId.localeCompare(bId);
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
        onDateSelectionChange={onDateSelectionChange}
        pendingCount={statusCounts.pending}
        packedCount={statusCounts.packed}
        deliveredCount={statusCounts.delivered}
      />

      <div className="bg-white rounded-xl shadow-lg">
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
                <th scope="col" className="px-6 py-3 text-center">View Bill</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length === 0 ? (
                  <tr>
                      <td colSpan={8} className="text-center py-10 text-slate-500">No transactions found.</td>
                  </tr>
              ) : (
                  filteredBills.map((bill, idx) => (
                  <tr key={bill.id} className="bg-white border-b hover:bg-slate-50">
                      <td className="px-6 py-4 text-slate-700">{idx + 1}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{userInfoMap[String((bill as any).customerId || bill.customerName || '')]?.name || 'Unknown'}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-700">{String((bill as any).customerId || bill.customerName)}</td>
                      <td className="px-6 py-4 text-slate-600">{userInfoMap[String((bill as any).customerId || bill.customerName || '')]?.department || bill.department || 'N/A'}</td>
                      <td className="px-6 py-4">{new Date(bill.date).toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm" title={formatItems(bill.items || [], bill.bags)}>
                        {(bill.items || []).length} {(bill.items || []).length === 1 ? 'item' : 'items'}{bill.bags && bill.bags > 0 ? ` + ${bill.bags} bag${bill.bags === 1 ? '' : 's'}` : ''}
                      </td>
                      <td className="px-6 py-4">
                        <div className="status-dropdown">
                          <select
                            value={bill.status || 'pending'}
                            onChange={(e) => handleStatusChange(bill.id, e.target.value as 'pending' | 'packed' | 'delivered')}
                            className={`text-sm rounded-md border focus:ring-2 focus:ring-opacity-50 font-medium px-3 py-1.5 ${getStatusStyles(bill.status || 'pending')}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="packed">Packed</option>
                            <option value="delivered">Delivered</option>
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
        vegetables={vegetables}
        onUpdateBill={onUpdateBill}
        currentUser={currentUser}
      />
    </div>
  );
};

export default Orders;