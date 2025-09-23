import React, { useState, useMemo, useCallback } from 'react';
import type { Vegetable, BillItem, Bill, User } from '../../types/types';
import Button from './ui/Button.tsx';
import { PlusIcon, MinusIcon, MagnifyingGlassIcon, CheckCircleIcon } from './ui/Icon.tsx';
import CartView from './CartView.tsx';
import BillPreviewPage from './BillPreviewPage.tsx';
import { roundTotal, formatRoundedTotal } from '../utils/roundUtils';

interface CreateBillProps {
  user: User;
  vegetables: Vegetable[];
  bills: Bill[]; // Add bills to calculate available stock
  addBill: (newBill: Omit<Bill, 'id' | 'date'>) => Promise<Bill>;
}

type CreateBillStage = 'ordering' | 'success';

type CartItemDetails = BillItem & { name: string; icon: string; pricePerKg: number; stockKg: number; };

const CreateBill: React.FC<CreateBillProps> = ({ user, vegetables, bills, addBill }) => {
  const [stage, setStage] = useState<CreateBillStage>('ordering');
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('All');
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [finalBill, setFinalBill] = useState<Bill | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [customerName, setCustomerName] = useState('');
  // const [department, setDepartment] = useState(''); // Commented out for future use
  const [bagCount, setBagCount] = useState(0);
  
  const BAG_PRICE = 10; // ₹10 per bag

  const vegetableMap = useMemo(() => new Map(vegetables.map(v => [v.id, v])), [vegetables]);

  // Calculate used stock for each vegetable from bills
  const usedStock = useMemo(() => {
    const used = new Map<string, number>();
    
    bills.forEach(bill => {
      bill.items?.forEach(item => {
        const currentUsed = used.get(item.vegetableId) || 0;
        used.set(item.vegetableId, currentUsed + item.quantityKg);
      });
    });
    
    return used;
  }, [bills]);

  // Calculate available stock for each vegetable
  const getAvailableStock = useCallback((vegetable: Vegetable) => {
    const used = usedStock.get(vegetable.id) || 0;
    return Math.max(0, vegetable.totalStockKg - used);
  }, [usedStock]);

  const categories = useMemo(() => {
    const cats = ['All', ...new Set(vegetables.map(v => v.category))];
    return cats;
  }, [vegetables]);

  const filteredVegetables = useMemo(() => {
    let filtered = vegetables.filter(veg => 
      veg.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (category === 'All' || veg.category === category)
    );
    
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    return filtered;
  }, [vegetables, searchTerm, category]);

  const updateCart = useCallback((vegId: string, quantity: number) => {
    setCart(prev => {
      const newCart = new Map(prev);
      if (quantity <= 0) {
        newCart.delete(vegId);
      } else {
        const vegetable = vegetableMap.get(vegId);
        if (vegetable) {
          const availableStock = getAvailableStock(vegetable);
          newCart.set(vegId, Math.min(quantity, availableStock));
        }
      }
      return newCart;
    });
  }, [vegetableMap, getAvailableStock]);

  const { cartItems, total, totalItems } = useMemo(() => {
    const items: CartItemDetails[] = [];
    let currentTotal = 0;
    let itemCount = 0;

    cart.forEach((quantity, vegId) => {
      const vegetable = vegetableMap.get(vegId);
      if (vegetable && quantity > 0) {
        const subtotal = quantity * vegetable.pricePerKg;
        items.push({
          vegetableId: vegId,
          quantityKg: quantity,
          subtotal,
          name: vegetable.name,
          icon: vegetable.icon,
          pricePerKg: vegetable.pricePerKg,
          stockKg: vegetable.stockKg
        });
        currentTotal += subtotal;
        itemCount++;
      }
    });

    // Add bag cost to total
    const bagsTotal = bagCount * BAG_PRICE;
    const finalTotal = currentTotal + bagsTotal;

    items.sort((a, b) => a.name.localeCompare(b.name));
    return { cartItems: items, total: roundTotal(finalTotal), totalItems: itemCount };
  }, [cart, vegetableMap, bagCount, BAG_PRICE]);

  const handleBagCountChange = (increment: boolean) => {
    setBagCount(prev => {
      const newCount = increment ? prev + 1 : Math.max(0, prev - 1);
      return newCount;
    });
  };

  const handleConfirmOrder = useCallback(async () => {
    if (!customerName.trim()) {
      alert('Please enter customer name');
      return;
    }
    
    const createdBill = await addBill({
      items: cartItems.map(({name, icon, pricePerKg, stockKg, ...item}) => item),
      total,
      customerName: customerName.trim(),
      // department: department.trim() || undefined, // Commented out for future use
      status: 'pending',
      bags: bagCount, // Include the bag count from state
    });
    setFinalBill(createdBill);
    setStage('success');
    setCart(new Map());
    setBagCount(0); // Reset bag count after order creation
    setCustomerName('');
    // setDepartment(''); // Commented out for future use
  }, [cartItems, total, addBill, customerName, bagCount]); // Added bagCount dependency

  const handlePlaceOrder = async () => {
      setIsCartVisible(false);
      setIsPlacingOrder(true);
      
      // Add a small delay for better UX
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      await handleConfirmOrder();
      setIsPlacingOrder(false);
  };

  const handleBackToOrdering = () => {
    setStage('ordering');
    setFinalBill(null);
  };

  if (stage === 'success' && finalBill) {
    return (
      <BillPreviewPage 
        bill={finalBill} 
        vegetables={vegetables}
        onLogout={handleBackToOrdering}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans relative">
      {/* Loading Overlay */}
      {isPlacingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 text-center shadow-2xl transform animate-pulse">
            <div className="w-16 h-16 mx-auto mb-4 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Creating Bill</h3>
            <p className="text-slate-600">Please wait while we prepare the bill...</p>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 px-4 sm:px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Create Bill</h1>
              <p className="text-slate-600 mt-1">Select items and create a new bill for customer</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex flex-col sm:w-60">
                <label className="text-sm font-medium text-slate-700 mb-2">Customer Name *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 shadow-sm"
                  required
                />
              </div>
              {/* Department field - commented out for future use */}
              {/* 
              <div className="flex flex-col sm:w-60">
                <label className="text-sm font-medium text-slate-700 mb-2">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Enter department (optional)"
                  className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 shadow-sm"
                />
              </div>
              */}
              {/* Employee Name Display - commented out for future use */}
              {/*
              <div className="flex flex-col items-end">
                <p className="text-sm font-medium text-slate-500 mb-1">Employee</p>
                <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg">
                  <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </span>
                  </div>
                  <span className="text-primary-700 font-medium text-sm">
                    {user.name || 'Loading...'}
                  </span>
                </div>
              </div>
              */}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex lg:flex-row overflow-hidden">
        {/* Product List */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 max-w-4xl mx-auto">
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
                </div>
                <input
                  type="text"
                  placeholder="Search for vegetables..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full rounded-lg border-slate-300 bg-white pl-10 py-3 text-slate-900 focus:ring-primary-500 focus:border-primary-500 shadow-sm"
                />
              </div>
              <div className="sm:w-48">
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="block w-full rounded-lg border-slate-300 bg-white py-3 px-3 text-slate-900 focus:ring-primary-500 focus:border-primary-500 shadow-sm"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Product List */}
          <div className="space-y-3">
            {filteredVegetables.length > 0 ? filteredVegetables.map(veg => {
              const quantity = cart.get(veg.id) || 0;
              const availableStock = getAvailableStock(veg);
              const isOutOfStock = availableStock <= 0;
              
              return (
                <div key={veg.id} className={`bg-white rounded-lg border p-4 transition-colors flex items-center justify-between ${isOutOfStock ? 'bg-slate-50 opacity-60' : 'hover:shadow-md border-slate-200'}`}>
                  <div className="flex items-center space-x-4">
                    <div className="text-3xl">{veg.icon}</div>
                    <div>
                      <h3 className="font-semibold text-slate-800 text-lg">{veg.name}</h3>
                      <p className="text-slate-600">₹{veg.pricePerKg.toFixed(2)}/kg</p>
                      {availableStock <= 0 && (
                        <p className="text-sm text-red-500 font-medium">Out of Stock</p>
                      )}
                      {availableStock > 0 && availableStock <= 5 && (
                        <p className="text-sm text-amber-600">Low Stock: {availableStock.toFixed(1)}kg available</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    {isOutOfStock ? (
                      <span className="text-sm font-medium text-red-500 px-4 py-2">Unavailable</span>
                    ) : quantity > 0 ? (
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => updateCart(veg.id, quantity - 0.25)} 
                          className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50 flex items-center justify-center" 
                          disabled={quantity <= 0}
                        >
                          <MinusIcon className="h-4 w-4"/>
                        </button>
                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => updateCart(veg.id, parseFloat(e.target.value) || 0)}
                          className="w-16 text-center font-bold text-slate-800 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                          min="0"
                          max={veg.stockKg}
                          step="0.25"
                          aria-label={`${veg.name} quantity in kg`}
                        />
                        <button 
                          onClick={() => updateCart(veg.id, quantity + 0.25)} 
                          className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50 flex items-center justify-center" 
                          disabled={quantity >= veg.stockKg}
                        >
                          <PlusIcon className="h-4 w-4"/>
                        </button>
                      </div>
                    ) : (
                      <Button 
                        onClick={() => {
                          const defaultQuantity = veg.category === 'Greens' ? 0.25 : 1;
                          updateCart(veg.id, defaultQuantity);
                        }} 
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium flex items-center"
                      >
                        <PlusIcon className="h-4 w-4 mr-2"/> Add
                      </Button>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div className="text-center text-slate-500 py-10">
                <p className="text-lg">No vegetables found.</p>
                <p className="text-sm mt-2">Try adjusting your search or category filter.</p>
              </div>
            )}
          </div>
        </main>

        {/* Desktop Cart Summary */}
        <aside className="hidden lg:flex lg:w-2/5 xl:w-1/3 bg-white border-l border-slate-200 flex-col">
            <CartView
                isDesktop={true}
                cartItems={cartItems}
                total={total}
                bagCount={bagCount}
                onBagCountChange={handleBagCountChange}
                onUpdateCart={updateCart}
                onPlaceOrder={handlePlaceOrder}
                isPlacingOrder={isPlacingOrder}
            />
        </aside>
      </div>

      {/* Mobile Sticky Footer */}
      <footer className={`lg:hidden fixed bottom-0 left-0 right-0 bg-white p-3 border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] transform transition-transform duration-300 ease-in-out ${cartItems.length > 0 ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">{totalItems} {totalItems > 1 ? 'ITEMS' : 'ITEM'}</span>
            <p className="text-xl font-bold text-slate-800">{formatRoundedTotal(total)}</p>
          </div>
          <Button 
            onClick={() => setIsCartVisible(true)} 
            size="md"
            className="relative overflow-hidden transition-all duration-300 transform hover:scale-105 hover:shadow-lg animate-bounce"
          >
            <span>View Order</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 hover:opacity-20 transform -skew-x-12 transition-all duration-1000 hover:translate-x-full"></div>
          </Button>
        </div>
      </footer>

      {/* Mobile Cart Sheet */}
      <CartView
        isOpen={isCartVisible}
        onClose={() => setIsCartVisible(false)}
        cartItems={cartItems}
        total={total}
        bagCount={bagCount}
        onBagCountChange={handleBagCountChange}
        onUpdateCart={updateCart}
        onPlaceOrder={handlePlaceOrder}
        isPlacingOrder={isPlacingOrder}
      />
    </div>
  );
};

export default CreateBill;