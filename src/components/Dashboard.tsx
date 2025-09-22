import React, { useState, useMemo } from 'react';
import Statistics from './Statistics.tsx';
import RecentTransactions from './RecentTransactions.tsx';
import { MagnifyingGlassIcon } from './ui/Icon.tsx';
import type { Bill, Vegetable } from '../../types/types';

interface DashboardProps {
    bills: Bill[];
    vegetables: Vegetable[];
    onViewOrder: (billId: string) => void;
    onUpdateBillStatus?: (billId: string, status: 'pending' | 'packed' | 'delivered') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ bills, vegetables, onViewOrder, onUpdateBillStatus }) => {
    const [searchTerm, setSearchTerm] = useState('');

    // Filter bills based on search term
    const filteredBills = useMemo(() => {
        if (!searchTerm) return bills;
        
        return bills.filter(bill =>
            (bill.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (bill.id || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [bills, searchTerm]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
                
                {/* Search Bar */}
                <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search transactions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full sm:w-64 rounded-md border-slate-300 bg-white pl-10 py-2 text-slate-900 focus:ring-primary-500 focus:border-primary-500"
                    />
                </div>
            </div>
            
            <Statistics bills={filteredBills} vegetables={vegetables} />
            <RecentTransactions 
                bills={filteredBills.slice(0, 7)} 
                vegetables={vegetables}
                title={searchTerm ? `Search Results (${filteredBills.length} found)` : "Recent Transactions"}
                onViewOrder={onViewOrder}
                onUpdateBillStatus={onUpdateBillStatus}
            />
        </div>
    );
};

export default Dashboard;