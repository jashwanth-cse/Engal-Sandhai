import React from 'react';
import Statistics from './Statistics.tsx';
import RecentTransactions from './RecentTransactions.tsx';
import type { Bill, Vegetable } from '../../types/types';

interface DashboardProps {
    bills: Bill[];
    vegetables: Vegetable[];
    onViewOrder: (billId: string) => void;
    onUpdateBillStatus?: (billId: string, status: 'pending' | 'completed') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ bills, vegetables, onViewOrder, onUpdateBillStatus }) => {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
            <Statistics bills={bills} vegetables={vegetables} />
            <RecentTransactions 
                bills={bills.slice(0, 7)} 
                vegetables={vegetables}
                title="Recent Transactions"
                onViewOrder={onViewOrder}
                onUpdateBillStatus={onUpdateBillStatus}
            />
        </div>
    );
};

export default Dashboard;