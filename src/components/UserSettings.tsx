import React, { useState } from 'react';
import type { User } from '../../types/types';
import { UserCircleIcon, CalendarIcon, CogIcon, LockClosedIcon, EyeIcon, EyeSlashIcon } from './ui/Icon.tsx';
import Button from './ui/Button.tsx';
import Toast from './ui/Toast.tsx';

interface UserSettingsProps {
  user: User;
}

const UserSettings: React.FC<UserSettingsProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setToast({ message: 'New passwords do not match', type: 'error' });
      return;
    }

    if (newPassword.length < 6) {
      setToast({ message: 'Password must be at least 6 characters', type: 'error' });
      return;
    }

    try {
      // Here you would call your password change API
      // For now, just show success message
      setToast({ message: 'Password changed successfully', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setToast({ message: 'Failed to change password', type: 'error' });
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-6 px-4 sm:px-6 lg:px-8">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      <div className="max-w-4xl mx-auto">
        {/* Header Card */}
        <div className="bg-white shadow-lg rounded-xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 px-6 py-8">
            <div className="flex items-center space-x-4">
              <div className="bg-white rounded-full p-3 shadow-lg">
                <UserCircleIcon className="h-14 w-14 text-primary-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {user.employee_name || user.name}
                </h2>
                <p className="text-primary-50 capitalize mt-1 text-sm">
                  {user.role} • Dashboard
                </p>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 bg-white">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex-1 py-4 px-6 text-center font-medium text-sm transition-colors ${
                  activeTab === 'profile'
                    ? 'border-b-2 border-primary-600 text-primary-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <UserCircleIcon className="h-5 w-5 inline-block mr-2" />
                Profile Information
              </button>
              <button
                onClick={() => setActiveTab('password')}
                className={`flex-1 py-4 px-6 text-center font-medium text-sm transition-colors ${
                  activeTab === 'password'
                    ? 'border-b-2 border-primary-600 text-primary-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <LockClosedIcon className="h-5 w-5 inline-block mr-2" />
                Change Password
              </button>
            </nav>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          {activeTab === 'profile' ? (
            <div className="px-6 py-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <CogIcon className="h-6 w-6 mr-2 text-primary-600" />
                Your Profile Details
              </h3>
            
              <div className="space-y-4">
                {/* Employee Name */}
                <div className="flex items-start space-x-3 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                  <UserCircleIcon className="h-6 w-6 text-primary-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-500">Employee Name</p>
                    <p className="text-base font-semibold text-gray-900 mt-1">
                      {user.employee_name || 'Not provided'}
                    </p>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-start space-x-3 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                  <CogIcon className="h-6 w-6 text-primary-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-500">Phone Number</p>
                    <p className="text-base font-semibold text-gray-900 mt-1">
                      {user.phone || 'Not provided'}
                    </p>
                  </div>
                </div>

                {/* Department */}
                <div className="flex items-start space-x-3 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                  <CogIcon className="h-6 w-6 text-primary-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-500">Department</p>
                    <p className="text-base font-semibold text-gray-900 mt-1">
                      {user.department || 'Not provided'}
                    </p>
                  </div>
                </div>

                {/* Created At */}
                {user.createdAt && (
                  <div className="flex items-start space-x-3 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                    <CalendarIcon className="h-6 w-6 text-primary-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-500">Account Created</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">
                        {new Date(user.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Note */}
              <div className="mt-6 p-4 bg-blue-50 border-l-4 border-primary-600 rounded-r-lg">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold text-primary-700">Note:</span> To update your profile information, please contact the administrator.
                </p>
              </div>
            </div>
          ) : (
            <div className="px-6 py-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <LockClosedIcon className="h-6 w-6 mr-2 text-primary-600" />
                Change Your Password
              </h3>

              <form onSubmit={handlePasswordChange} className="space-y-6">
                {/* Current Password */}
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      id="currentPassword"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showCurrentPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pr-10"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showNewPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Must be at least 6 characters</p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showConfirmPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-lg transition-colors"
                  >
                    Change Password
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    className="px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 rounded-lg transition-colors"
                  >
                    Clear
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserSettings;
