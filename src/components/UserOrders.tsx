import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Bill, User } from '../../types/types';
import { ArrowLeftIcon, XMarkIcon } from './ui/Icon.tsx';
import UserHeader from './UserHeader.tsx';

interface UserOrdersProps {
  user: User;
  onLogout: () => void;
}

const UserOrders: React.FC<UserOrdersProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Bill | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const handleBack = () => {
    if (user.role === 'admin') {
      navigate('/admin-choice');
    } else {
      navigate('/dashboard');
    }
  };

  useEffect(() => {
    fetchUserOrders();
  }, [user.id]);

  const fetchUserOrders = async () => {
    try {
      setLoading(true);
      // TODO: Implement Firebase query later
      // Query bills where customerId === user.id
      
      // Mock data for design purposes
      const mockOrders: Bill[] = [
        {
          id: 'ORD001',
          date: new Date().toISOString(), // Today's order
          customerName: user.name,
          customerId: user.id,
          items: [
            { vegetableId: 'v1', name: 'Tomato', quantityKg: 2, pricePerKg: 40, subtotal: 80 },
            { vegetableId: 'v2', name: 'Onion', quantityKg: 3, pricePerKg: 30, subtotal: 90 },
            { vegetableId: 'v3', name: 'Potato', quantityKg: 5, pricePerKg: 25, subtotal: 125 },
            { vegetableId: 'v4', name: 'Carrot', quantityKg: 2, pricePerKg: 50, subtotal: 100 },
            { vegetableId: 'v5', name: 'Beans', quantityKg: 1.5, pricePerKg: 60, subtotal: 90 },
            { vegetableId: 'v6', name: 'Capsicum', quantityKg: 1, pricePerKg: 80, subtotal: 80 },
            { vegetableId: 'v7', name: 'Cabbage', quantityKg: 2.5, pricePerKg: 35, subtotal: 87.5 },
          ],
          total: 652.5,
          status: 'delivered',
          bags: 1
        },
        {
          id: 'ORD002',
          date: new Date().toISOString(), // Today's order
          customerName: user.name,
          customerId: user.id,
          items: [
            { vegetableId: 'v3', name: 'Potato', quantityKg: 5, pricePerKg: 25, subtotal: 125 },
            { vegetableId: 'v4', name: 'Carrot', quantityKg: 2, pricePerKg: 50, subtotal: 100 },
          ],
          total: 225,
          status: 'packed'
        },
        {
          id: 'ORD003',
          date: new Date().toISOString(), // Today's order
          customerName: user.name,
          customerId: user.id,
          items: [
            { vegetableId: 'v4', name: 'Carrot', quantityKg: 1.5, pricePerKg: 50, subtotal: 75 },
            { vegetableId: 'v5', name: 'Beans', quantityKg: 1, pricePerKg: 60, subtotal: 60 },
            { vegetableId: 'v6', name: 'Capsicum', quantityKg: 0.5, pricePerKg: 80, subtotal: 40 },
          ],
          total: 175,
          status: 'inprogress'
        },
        {
          id: 'ORD004',
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Yesterday
          customerName: user.name,
          customerId: user.id,
          items: [
            { vegetableId: 'v7', name: 'Cabbage', quantityKg: 2, pricePerKg: 35, subtotal: 70 },
            { vegetableId: 'v1', name: 'Tomato', quantityKg: 1, pricePerKg: 40, subtotal: 40 },
          ],
          total: 110,
          status: 'pending'
        },
        {
          id: 'ORD005',
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
          customerName: user.name,
          customerId: user.id,
          items: [
            { vegetableId: 'v7', name: 'Cabbage', quantityKg: 2, pricePerKg: 35, subtotal: 70 },
            { vegetableId: 'v1', name: 'Tomato', quantityKg: 1, pricePerKg: 40, subtotal: 40 },
          ],
          total: 110,
          status: 'pending'
        },
        {
          id: 'ORD006',
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
          customerName: user.name,
          customerId: user.id,
          items: [
            { vegetableId: 'v2', name: 'Onion', quantityKg: 4, pricePerKg: 30, subtotal: 120 },
            { vegetableId: 'v8', name: 'Brinjal', quantityKg: 1.5, pricePerKg: 45, subtotal: 67.5 },
          ],
          total: 187.5,
          status: 'delivered'
        },
      ];
      setOrders(mockOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };



  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  // Filter orders by selected date
  // If no date is selected, show empty array (no orders)
  const filteredOrders = selectedDate
    ? orders.filter(order => {
        const orderDate = new Date(order.date);
        const filterDate = new Date(selectedDate);
        return (
          orderDate.getFullYear() === filterDate.getFullYear() &&
          orderDate.getMonth() === filterDate.getMonth() &&
          orderDate.getDate() === filterDate.getDate()
        );
      })
    : [];

  return (
    <div className="min-h-screen bg-slate-100">
      <UserHeader 
        user={user} 
        onLogout={onLogout}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header matching Dashboard style */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Your Orders</h1>
            <p className="text-slate-600 mt-1">View all your order history</p>
          </div>
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            <span className="font-medium">Back</span>
          </button>
        </div>

        {/* Date Filter */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Filter by Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            {selectedDate && (
              <>
                <button
                  onClick={() => setSelectedDate('')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium transition-colors"
                >
                  Clear Filter
                </button>
                <div className="text-sm text-slate-600">
                  Showing <span className="font-semibold">{filteredOrders.length}</span> orders
                </div>
              </>
            )}
          </div>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : !selectedDate ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-slate-500 text-lg font-semibold mb-2">No orders placed today</p>
            <p className="text-slate-400 text-sm">Please select a date to view your order history</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-slate-500 text-lg font-semibold mb-2">No orders found for the selected date</p>
            <p className="text-slate-400 text-sm mb-4">Try selecting a different date</p>
            <button
              onClick={() => setSelectedDate('')}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium transition-colors"
            >
              Clear Filter
            </button>
          </div>
        ) : (
          <>
            {/* Desktop View - Cards (hidden on mobile) */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => order.items.length > 3 && setSelectedOrder(order)}
                  className={`bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-slate-200 flex flex-col ${
                    order.items.length > 3 ? 'cursor-pointer' : ''
                  }`}
                >
                  {/* Order Header */}
                  <div className="bg-primary-600 px-6 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-white">
                        Order #{order.id}
                      </h3>
                      <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                        <p className="text-xs font-semibold text-white">
                          {order.items.length} Items
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-primary-100">
                      {formatDate(order.date)}
                    </p>
                  </div>

                  {/* Order Items - Show only first 3 */}
                  <div className="px-6 py-4 flex-1 flex flex-col">
                    <div className="space-y-3 flex-1">
                      {order.items.slice(0, 3).map((item, index) => (
                        <div
                          key={index}
                          className="bg-slate-50 rounded-lg px-4 py-3"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <p className="font-semibold text-slate-800 text-base">
                              {item.name}
                            </p>
                            <p className="font-bold text-primary-600 text-base ml-2">
                              ₹{Math.round(item.subtotal)}
                            </p>
                          </div>
                          <p className="text-sm text-slate-500">
                            {item.quantityKg} kg × ₹{item.pricePerKg}/kg
                          </p>
                        </div>
                      ))}
                      
                      {/* View More Indicator */}
                      {order.items.length > 3 && (
                        <div className="w-full bg-primary-50 text-primary-700 font-semibold py-3 px-4 rounded-lg text-center">
                          Click to view +{order.items.length - 3} more items
                        </div>
                      )}
                    </div>

                    {/* Total Amount - Always at bottom */}
                    <div className="border-t-2 border-slate-200 pt-4 mt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-bold text-slate-700">Total Amount</span>
                        <span className="text-2xl font-bold text-primary-600">
                          ₹{Math.round(order.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile View - List (only on mobile) */}
            <div className="md:hidden space-y-4">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="bg-white rounded-lg shadow-sm border border-slate-200 cursor-pointer active:scale-[0.99] transition-transform"
                >
                  {/* Order Header */}
                  <div className="bg-primary-600 px-4 py-3 flex justify-between items-center">
                    <div>
                      <h3 className="text-base font-bold text-white">
                        Order #{order.id}
                      </h3>
                      <p className="text-xs text-primary-100 mt-1">
                        {formatDate(order.date)}
                      </p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full">
                      <p className="text-xs font-semibold text-white">
                        {order.items.length} Items
                      </p>
                    </div>
                  </div>

                  {/* Order Summary */}
                  <div className="px-4 py-3">
                    {/* Total Amount */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-700">Total Amount</span>
                      <span className="text-xl font-bold text-primary-600">
                        ₹{Math.round(order.total)}
                      </span>
                    </div>
                    
                    {/* Tap to view message */}
                    <div className="bg-primary-50 text-primary-700 font-medium py-2 px-3 rounded text-center text-xs mt-3">
                      Tap to view all items
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal for Full Order Details */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-primary-600 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Order #{selectedOrder.id}
                </h2>
                <p className="text-sm text-primary-100 mt-1">
                  {formatDate(selectedOrder.date)}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Body - Desktop Card Style / Mobile List Style */}
            <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="px-6 py-4">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Order Items</h3>
                
                {/* Desktop - Card Style */}
                <div className="hidden md:block space-y-3">
                  {selectedOrder.items.map((item, index) => (
                    <div
                      key={index}
                      className="bg-slate-50 rounded-lg px-4 py-3 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-semibold text-slate-800 text-base">
                          {item.name}
                        </p>
                        <p className="font-bold text-primary-600 text-base ml-2">
                          ₹{Math.round(item.subtotal)}
                        </p>
                      </div>
                      <p className="text-sm text-slate-500">
                        {item.quantityKg} kg × ₹{item.pricePerKg}/kg
                      </p>
                    </div>
                  ))}
                </div>

                {/* Mobile - List Style */}
                <div className="md:hidden">
                  <div className="divide-y divide-slate-200">
                    {selectedOrder.items.map((item, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center py-3"
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-slate-800 text-sm">
                            {item.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {item.quantityKg} kg × ₹{item.pricePerKg}/kg
                          </p>
                        </div>
                        <p className="font-bold text-primary-600 text-base ml-3">
                          ₹{Math.round(item.subtotal)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-bold text-slate-700">Total Amount</span>
                <span className="text-3xl font-bold text-primary-600">
                  ₹{Math.round(selectedOrder.total)}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserOrders;
