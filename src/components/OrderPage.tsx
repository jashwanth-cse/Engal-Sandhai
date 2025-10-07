
import React, { useState, useMemo, useCallback } from 'react';
import type { Vegetable, BillItem, Bill, User } from '../../types/types';
import UserHeader from './UserHeader.tsx';
import Button from './ui/Button.tsx';
import { PlusIcon, MinusIcon, MagnifyingGlassIcon } from './ui/Icon.tsx';
// COMMENTED OUT FOR NOW - Payment upload functionality preserved for future use
// import PaymentPage from './PaymentPage.tsx';
import CartView from './CartView.tsx';
import BillPreviewPage from './BillPreviewPage.tsx';
import Settings from './Settings.tsx';
import { updateUserNameInDb } from '../services/dbService';
import { roundTotal, formatRoundedTotal } from '../utils/roundUtils';

interface OrderPageProps {
  user: User;
  vegetables: Vegetable[];
  availableStock: Map<string, number>; // Real-time available stock from database
  addBill: (newBill: Omit<Bill, 'id' | 'date'>) => Promise<Bill>;
  onLogout: () => void;
  onUpdateUser?: (updatedUser: User) => void;
}

type OrderStage = 'ordering' | 'payment' | 'success' | 'settings';

// COMMENTED OUT - Base64 conversion utility preserved for future payment functionality
// Utility to convert file to base64
// const fileToBase64 = (file: File): Promise<string> => {
//     return new Promise((resolve, reject) => {
//         const reader = new FileReader();
//         reader.readAsDataURL(file);
//         reader.onload = () => resolve(reader.result as string);
//         reader.onerror = error => reject(error);
//     });
// };

type CartItemDetails = BillItem & { name: string; pricePerKg: number; stockKg: number; unitType: 'KG' | 'COUNT'; };

const OrderPage: React.FC<OrderPageProps> = ({ user, vegetables, availableStock, addBill, onLogout, onUpdateUser }) => {
  const [stage, setStage] = useState<OrderStage>('ordering');
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('All');
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [finalBill, setFinalBill] = useState<Bill | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [bagCount, setBagCount] = useState(0);
  
  const BAG_PRICE = 10; // ₹10 per bag
  
  const vegetableMap = useMemo(() => new Map(vegetables.map(v => [v.id, v])), [vegetables]);
  const categories = useMemo(() => ['All', ...new Set(vegetables.map(v => v.category))], [vegetables]);

  const filteredVegetables = useMemo(() => {
    return vegetables.filter(v => {
      const matchesCategory = category === 'All' || v.category === category;
      const matchesSearch = v.name.toLowerCase().includes(searchTerm.toLowerCase());
      // Filter out vegetables with 0 stock
      const availableStockAmount = availableStock.get(v.id) || 0;
      const hasStock = availableStockAmount > 0;
      return matchesCategory && matchesSearch && hasStock;
    }).sort((a,b) => a.name.localeCompare(b.name));
  }, [vegetables, searchTerm, category, availableStock]);

  const updateCart = (vegId: string, quantity: number) => {
    console.log(`Updating cart for ${vegId} with quantity ${quantity}`);
    setCart(prev => {
      const newCart = new Map(prev);
      const vegetable = vegetableMap.get(vegId);
      if (!vegetable) {
        console.log(`Vegetable not found for ${vegId}`);
        return prev;
      }

      // Use available stock instead of stockKg
      const maxStock = availableStock.get(vegId) || 0;
      // Clamp quantity between 0 and available stock
      const clampedQuantity = Math.max(0, Math.min(quantity, maxStock));
      console.log(`Clamped quantity: ${clampedQuantity} (original: ${quantity}, max: ${maxStock})`);

      if (clampedQuantity > 0) {
        newCart.set(vegId, parseFloat(clampedQuantity.toFixed(2)));
        console.log(`Added to cart: ${vegId} = ${clampedQuantity}`);
      } else {
        newCart.delete(vegId);
        console.log(`Removed from cart: ${vegId}`);
      }
      return newCart;
    });
  };

  const { cartItems, total, totalItems } = useMemo(() => {
    const items: CartItemDetails[] = [];
    let currentTotal = 0;
    let itemCount = 0;
    cart.forEach((quantity, vegId) => {
      const veg = vegetableMap.get(vegId);
      if (veg) {
        const subtotal = veg.pricePerKg * quantity;
        const availableStockAmount = availableStock.get(vegId) || 0;
        items.push({ 
            vegetableId: vegId, 
            quantityKg: quantity, 
            subtotal,
            name: veg.name,
            pricePerKg: veg.pricePerKg,
            stockKg: availableStockAmount,
            unitType: veg.unitType,
        });
        currentTotal += subtotal;
        itemCount += 1;
      }
    });
    
    // Add bag cost to total
    const bagsTotal = bagCount * BAG_PRICE;
    const finalTotal = currentTotal + bagsTotal;
    
    items.sort((a, b) => a.name.localeCompare(b.name));
    return { cartItems: items, total: roundTotal(finalTotal), totalItems: itemCount };
  }, [cart, vegetableMap, bagCount, BAG_PRICE, availableStock]);

  const handleBagCountChange = (increment: boolean) => {
    setBagCount(prev => {
      const newCount = increment ? prev + 1 : Math.max(0, prev - 1);
      return newCount;
    });
  };

  const handleConfirmOrder = useCallback(async () => {
    // COMMENTED OUT - Payment screenshot functionality preserved for future use
    // const paymentScreenshotBase64 = await fileToBase64(screenshot);
    
    console.log('👤 Creating order for user:', {
      id: user.id,
      name: user.name,
      role: user.role,
      department: (user as any).department,
      email: (user as any).email
    });
    
    const createdBill = await addBill({
      items: cartItems.map(({name, pricePerKg, stockKg, unitType, ...item}) => item),
      total,
      customerName: user.name,
      customerId: user.id, // Add user ID so orders can be properly tracked
      department: (user as any).department, // Add department if available
      status: 'pending', // Default status for new orders
      bags: bagCount, // Include bags count
      // COMMENTED OUT - Payment screenshot field preserved for future use
      // paymentScreenshot: paymentScreenshotBase64,
    });
    
    console.log('✅ Order created successfully:', createdBill);
    setFinalBill(createdBill);
    setStage('success');
    setCart(new Map());
    setBagCount(0); // Reset bag count
  }, [cartItems, total, addBill, user.name, user.id, bagCount]);

  const handlePlaceOrder = async () => {
      setIsCartVisible(false);
      setIsPlacingOrder(true);
      
      // Add a small delay for better UX and animation visibility
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // COMMENTED OUT - Skip payment stage and go directly to success
      // setStage('payment');
      
      // Directly create the bill and go to success page
      await handleConfirmOrder();
      setIsPlacingOrder(false);
  };

  const handleOpenSettings = () => {
    setStage('settings');
  };

  const handleUpdateProfile = async (profile: { name: string; email: string }) => {
    try {
      // Update the name in the database
      await updateUserNameInDb(user.id, profile.name);
      
      // Update the current user state if callback is provided
      if (onUpdateUser) {
        const updatedUser: User = {
          ...user,
          name: profile.name,
          email: profile.email
        };
        onUpdateUser(updatedUser);
      }
      
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

  // COMMENTED OUT - Payment page functionality preserved for future use
  // if (stage === 'payment') {
  //   return <PaymentPage total={total} onConfirmOrder={handleConfirmOrder} onBack={() => setStage('ordering')} />;
  // }
  
  if (stage === 'success' && finalBill) {
    return (
        <BillPreviewPage 
            bill={finalBill}
            vegetables={vegetables}
            onLogout={onLogout}
        />
    );
  }

  if (stage === 'settings') {
    return (
      <div className="min-h-screen bg-slate-100">
        <UserHeader user={user} onLogout={onLogout} />
        <div className="p-4">
          <button 
            onClick={() => setStage('ordering')}
            className="mb-4 text-primary-600 hover:text-primary-700 font-medium"
          >
            ← Back to Shopping
          </button>
          <Settings 
            user={user}
            onUpdateProfile={handleUpdateProfile}
            onChangePassword={handleChangePassword}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans relative">
      {/* Loading Overlay */}
      {isPlacingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 text-center shadow-2xl transform animate-pulse">
            <div className="w-16 h-16 mx-auto mb-4 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Processing Your Order</h3>
            <p className="text-slate-600">Please wait while we prepare your order...</p>
          </div>
        </div>
      )}
      
      <UserHeader user={user} onLogout={onLogout} onOpenSettings={handleOpenSettings} />
      <div className="flex-1 flex lg:flex-row overflow-hidden">{/* Product List */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24">
          <div className="mb-4">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
              </div>
              <input
                type="text"
                placeholder="Search for vegetables..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full rounded-md border-slate-300 bg-white pl-10 py-2.5 text-slate-900 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
            <div className="mt-3">
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="block w-full rounded-md border-slate-300 bg-white py-2.5 text-slate-900 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              >
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-3">
            {filteredVegetables.length > 0 ? filteredVegetables.map((veg, index) => {
              const quantity = cart.get(veg.id) || 0;
              const availableStockAmount = availableStock.get(veg.id) || 0;
              return (
              <div key={veg.id} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm mr-3">{index + 1}</div>
                  <div>
                    <p className="font-semibold text-slate-800">{veg.name}</p>
                    <p className="text-sm text-slate-500">₹{veg.pricePerKg.toFixed(2)}/{veg.unitType === 'KG' ? 'kg' : 'piece'}</p>
                  </div>
                </div>
                {quantity > 0 ? (
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => {
                        const decrement = veg.unitType === 'COUNT' ? 1 : 0.25;
                        updateCart(veg.id, quantity - decrement);
                      }} 
                      className="p-2 rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50" 
                      disabled={quantity <= 0}
                    >
                      <MinusIcon className="h-4 w-4"/>
                    </button>
                    <input
                      type="number"
                      value={veg.unitType === 'COUNT' ? quantity.toFixed(0) : quantity}
                      onChange={(e) => updateCart(veg.id, parseFloat(e.target.value) || 0)}
                      className="w-16 text-center font-bold text-primary-700 border-b-2 border-slate-300 focus:outline-none focus:border-primary-500 transition bg-transparent"
                      min="0"
                      max={availableStockAmount}
                      step={veg.unitType === 'COUNT' ? "1" : "0.25"}
                      aria-label={`${veg.name} quantity in ${veg.unitType === 'KG' ? 'kg' : 'pieces'}`}
                    />
                    <button 
                      onClick={() => {
                        const increment = veg.unitType === 'COUNT' ? 1 : 0.25;
                        updateCart(veg.id, quantity + increment);
                      }} 
                      className="p-2 rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50" 
                      disabled={quantity >= availableStockAmount}
                    >
                      <PlusIcon className="h-4 w-4"/>
                    </button>
                  </div>
                ) : (
                  <Button 
                    onClick={() => {
                      const defaultQuantity = veg.unitType === 'COUNT' ? 1 : (veg.category === 'Greens' ? 0.25 : 1);
                      updateCart(veg.id, defaultQuantity);
                    }} 
                    size="md" 
                    className="px-3 py-1.5 text-sm"
                  >
                    <PlusIcon className="h-4 w-4 mr-1"/> Add
                  </Button>
                )}
              </div>
            )}) : <p className="text-center text-slate-500 py-10">No vegetables found.</p>}
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

export default OrderPage;