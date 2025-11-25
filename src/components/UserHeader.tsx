
import React, { useState } from 'react';
import type { User } from '../../types/types';
import { UserCircleIcon } from './ui/Icon.tsx';
import MobileMenu from './MobileMenu.tsx';

interface UserHeaderProps {
  user: User;
  onLogout: () => void;
  onOpenSettings?: () => void;
  onShowOrders?: () => void;
}

const UserHeader: React.FC<UserHeaderProps> = ({ user, onLogout, onOpenSettings, onShowOrders }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <header className="bg-primary-900 text-white shadow-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Engal Santhai
            </h1>
            <div className="flex items-center space-x-3">
              <span className="text-primary-100 font-medium hidden sm:block">
                {user.employee_name || user.name}
              </span>
              <button
                onClick={() => setIsMenuOpen(true)}
                className="p-2 rounded-full text-primary-200 hover:text-white hover:bg-primary-800 transition-colors"
                aria-label="Open user menu"
              >
                <UserCircleIcon className="h-7 w-7" />
              </button>
            </div>
          </div>
        </div>
      </header>
      <MobileMenu 
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        user={user}
        onLogout={onLogout}
        onOpenSettings={onOpenSettings}
        onShowOrders={onShowOrders}
      />
    </>
  );
};

export default UserHeader;