import React, { useState } from 'react';
import type { User, Bill, Vegetable } from '../../types/types';
import Sidebar from './Sidebar.tsx';
import AdminHeader from './AdminHeader.tsx';
import Dashboard from './Dashboard.tsx';
import Inventory from './Inventory.tsx';
import Orders from './Orders.tsx';
import Settings from './Settings.tsx';
import CreateBill from './CreateBill.tsx';
import { updateUserNameInDb } from '../services/dbService';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
  vegetables: Vegetable[];
  addVegetable: (newVegetable: Omit<Vegetable, 'id'>) => void;
  updateVegetable: (updatedVegetable: Vegetable) => void;
  deleteVegetable: (vegId: string) => void;
  bills: Bill[];
  updateBill: (billId: string, updates: Partial<Bill>) => void;
  addBill: (newBill: Omit<Bill, 'id' | 'date'>) => Promise<Bill>;
  onUpdateUser: (updatedUser: User) => void;
}

type AdminPage = 'dashboard' | 'inventory' | 'orders' | 'settings' | 'create-bill';

const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
  const [currentPage, setCurrentPage] = useState<AdminPage>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [initialBillId, setInitialBillId] = useState<string | null>(null);

  const handleViewOrder = (billId: string) => {
    setInitialBillId(billId);
    setCurrentPage('orders');
  };

  const handleUpdateProfile = async (profile: { name: string; email: string }) => {
    try {
      // Update the name in the database
      await updateUserNameInDb(props.user.id, profile.name);
      
      // Update the current user state
      const updatedUser: User = {
        ...props.user,
        name: profile.name,
        email: profile.email
      };
      
      props.onUpdateUser(updatedUser);
      console.log('Profile updated successfully:', profile);
    } catch (error) {
      console.error('Error updating profile:', error);
      // You can add toast notification here for error handling
    }
  };

  const handleChangePassword = (passwords: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
    // Convert all passwords to uppercase before processing
    const uppercasePasswords = {
      currentPassword: passwords.currentPassword.toUpperCase(),
      newPassword: passwords.newPassword.toUpperCase(),
      confirmPassword: passwords.confirmPassword.toUpperCase()
    };
    
    // Handle password change logic here
    console.log('Password change requested');
    // You can add API calls or validation here with uppercasePasswords
  };

  const handleUpdateBillStatus = async (billId: string, status: 'pending' | 'packed' | 'delivered') => {
    props.updateBill(billId, { status });
    // Map bill to order in Firestore
    if (status === 'packed' || status === 'delivered') {
      // Find corresponding order by billId
      const orderRef = doc(db, 'orders', billId);
      await updateDoc(orderRef, {
        bill: {
          billId,
          employeeId: props.user.id,
          status,
          updatedAt: new Date(),
        }
      });
    }
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard bills={props.bills} vegetables={props.vegetables} onViewOrder={handleViewOrder} onUpdateBillStatus={handleUpdateBillStatus} onUpdateBill={props.updateBill} />;
      case 'inventory':
        return <Inventory 
                  vegetables={props.vegetables} 
                  bills={props.bills}
                  addVegetable={props.addVegetable} 
                  updateVegetable={props.updateVegetable}
                  deleteVegetable={props.deleteVegetable}
               />;
      case 'orders':
        return <Orders 
                  bills={props.bills} 
                  vegetables={props.vegetables} 
                  initialBillId={initialBillId} 
                  onClearInitialBill={() => setInitialBillId(null)}
                  onUpdateBillStatus={handleUpdateBillStatus}
                  onUpdateBill={props.updateBill}
                  currentUser={props.user}
               />;
      case 'settings':
        return <Settings 
                  user={props.user}
                  onUpdateProfile={handleUpdateProfile}
                  onChangePassword={handleChangePassword}
               />;
      case 'create-bill':
        return <CreateBill 
                  user={props.user}
                  vegetables={props.vegetables}
                  bills={props.bills}
                  addBill={props.addBill}
               />;
      default:
        return <Dashboard bills={props.bills} vegetables={props.vegetables} onViewOrder={handleViewOrder} onUpdateBillStatus={handleUpdateBillStatus} onUpdateBill={props.updateBill} />;
    }
  };

  const pageTitles: Record<AdminPage, string> = {
      dashboard: 'Dashboard',
      inventory: 'Inventory',
      orders: 'Order History',
      settings: 'Settings',
      'create-bill': 'Create Bill',
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans">
      <Sidebar 
        user={props.user} 
        onLogout={props.onLogout} 
        currentPage={currentPage}
        setCurrentPage={(page) => {
            setCurrentPage(page);
            setSidebarOpen(false);
        }}
        isOpen={isSidebarOpen}
        setIsOpen={setSidebarOpen}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader onMenuClick={() => setSidebarOpen(true)} title={pageTitles[currentPage]} user={props.user} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-100 p-4 sm:p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;