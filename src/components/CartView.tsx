import React from "react";
import type { BillItem } from "../../types/types";
import Button from "./ui/Button.tsx";
import {
  ShoppingCartIcon,
  XMarkIcon,
  MinusIcon,
  PlusIcon,
  CheckCircleIcon,
} from "./ui/Icon.tsx";
import { formatRoundedTotal } from "../utils/roundUtils";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";



type CartItemDetails = BillItem & { name: string; icon: string; pricePerKg: number; stockKg: number; unitType: 'KG' | 'COUNT'; };

interface CartViewProps {
  isOpen?: boolean;
  isDesktop?: boolean;
  onClose?: () => void;
  onPlaceOrder: () => void;
  cartItems: CartItemDetails[];
  total: number;
  bagCount?: number;
  onBagCountChange?: (increment: boolean) => void;
  onUpdateCart: (vegId: string, quantity: number) => void;
  isPlacingOrder?: boolean;
}

const CartContent: React.FC<Omit<CartViewProps, "isOpen">> = ({
  cartItems,
  total,
  bagCount = 0,
  onBagCountChange,
  onUpdateCart,
  onPlaceOrder,
  isDesktop,
  onClose,
  isPlacingOrder = false,
}) => {
  const BAG_PRICE = 10; // ₹10 per bag

  const handlePlaceOrder = async () => {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        alert("Please login again.");
        return;
      }

      const userId = currentUser.uid;
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        alert("User not found in Firestore.");
        return;
      }

      const userData = userSnap.data();

      // Order object
      const order = {
        userId: userId,
        employee_id: userData.employee_id || "",
        items: cartItems.map((item) => ({
          id: item.vegetableId,
          name: item.name,
          quantity: item.quantityKg,
          pricePerKg: item.pricePerKg,
          subtotal: item.subtotal,
        })),
        totalAmount: total + bagCount * BAG_PRICE,
        bagCount,
        createdAt: new Date(),
      };

      // Save order in Firestore
      await addDoc(collection(db, "orders"), order);

      // ✅ Update stock only if user is admin
      if (userData.role === "admin") {
        const stockUpdates = cartItems.map((item) => {
          const vegRef = doc(db, "vegetables", item.vegetableId);
          return updateDoc(vegRef, {
            stockKg: item.stockKg - item.quantityKg,
          });
        });

        await Promise.all(stockUpdates);
      }

      alert("Order placed successfully!");
      onPlaceOrder(); // callback to clear cart

    } catch (error) {
      console.error("Error placing order:", error);
      alert("Failed to place order. Check console for details.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div
        className={`flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 ${
          isDesktop ? "" : "bg-slate-50"
        }`}
      >
        <h2 className="text-xl font-bold text-slate-800">Your Order</h2>
        {!isDesktop && (
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-500 hover:bg-slate-200"
            aria-label="Close cart"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
            <ShoppingCartIcon className="h-16 w-16 text-slate-300" />
            <p className="mt-4">Your cart is empty.</p>
            <p className="text-sm text-slate-400">Add items to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cartItems.map((item) => (
              <div
                key={item.vegetableId}
                className="py-2 border-b border-slate-100 last:border-b-0"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">{item.icon}</span>
                    <div>
                      <p className="font-semibold text-slate-800">{item.name}</p>
                      {isDesktop ? (
                        <p className="text-sm text-slate-500">
                          {item.quantityKg} kg × ₹{item.pricePerKg.toFixed(2)}/kg
                        </p>
                      ) : (
                        <p className="text-sm text-slate-500">
                          ₹{item.pricePerKg.toFixed(2)} / kg
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="font-semibold text-slate-800">
                    ₹{item.subtotal.toFixed(2)}
                  </p>
                </div>

                {/* Quantity controls (mobile only) */}
                {!isDesktop && (
                  <div className="flex justify-end items-center mt-2">
                    <div className="flex items-center border border-slate-300 rounded-md overflow-hidden h-9">
                      <button
                        onClick={() =>
                          onUpdateCart(item.vegetableId, item.quantityKg - 0.25)
                        }
                        className="px-3 h-full flex items-center justify-center bg-slate-50 hover:bg-slate-200 text-slate-700 disabled:opacity-50"
                        disabled={item.quantityKg <= 0}
                      >
                        <MinusIcon className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        value={item.quantityKg}
                        onChange={(e) =>
                          onUpdateCart(
                            item.vegetableId,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-16 h-full text-center font-bold text-primary-700 focus:outline-none bg-white border-x border-slate-300"
                        min="0"
                        max={item.stockKg}
                        step="0.25"
                        aria-label={`${item.name} quantity in kg`}
                      />
                      <button
                        onClick={() =>
                          onUpdateCart(item.vegetableId, item.quantityKg + 0.25)
                        }
                        className="px-3 h-full flex items-center justify-center bg-slate-50 hover:bg-slate-200 text-slate-700 disabled:opacity-50"
                        disabled={item.quantityKg >= item.stockKg}
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>
                ) : (
                  <div className="space-y-3">
                    {cartItems.map(item => (
                      <div key={item.vegetableId} className="py-2 border-b border-slate-100 last:border-b-0">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <span className="text-2xl mr-3">{item.icon}</span>
                            <div>
                              <p className="font-semibold text-slate-800">{item.name}</p>
                              {isDesktop ? (
                                <p className="text-sm text-slate-500">
                                  {item.unitType === 'COUNT' ? item.quantityKg.toFixed(0) : item.quantityKg} {item.unitType === 'KG' ? 'kg' : 'pieces'} &times; ₹{item.pricePerKg.toFixed(2)}/{item.unitType === 'KG' ? 'kg' : 'piece'}
                                </p>
                              ) : (
                                <p className="text-sm text-slate-500">₹{item.pricePerKg.toFixed(2)} / {item.unitType === 'KG' ? 'kg' : 'piece'}</p>
                              )}
                            </div>
                          </div>
                          <p className="font-semibold text-slate-800">₹{item.subtotal.toFixed(2)}</p>
                        </div>
                        {!isDesktop && (
                            <div className="flex justify-end items-center mt-2">
                                <div className="flex items-center border border-slate-300 rounded-md overflow-hidden h-9">
                                    <button 
                                        onClick={() => {
                                            const decrement = item.unitType === 'COUNT' ? 1 : 0.25;
                                            onUpdateCart(item.vegetableId, item.quantityKg - decrement);
                                        }} 
                                        className="px-3 h-full flex items-center justify-center bg-slate-50 hover:bg-slate-200 text-slate-700 disabled:opacity-50" 
                                        disabled={item.quantityKg <= 0}
                                    >
                                        <MinusIcon className="h-4 w-4"/>
                                    </button>
                                    <input
                                        type="number"
                                        value={item.unitType === 'COUNT' ? item.quantityKg.toFixed(0) : item.quantityKg}
                                        onChange={(e) => onUpdateCart(item.vegetableId, parseFloat(e.target.value) || 0)}
                                        className="w-16 h-full text-center font-bold text-primary-700 focus:outline-none bg-white border-x border-slate-300"
                                        min="0"
                                        max={item.stockKg}
                                        step={item.unitType === 'COUNT' ? "1" : "0.25"}
                                        aria-label={`${item.name} quantity in ${item.unitType === 'KG' ? 'kg' : 'pieces'}`}
                                    />
                                    <button 
                                        onClick={() => {
                                            const increment = item.unitType === 'COUNT' ? 1 : 0.25;
                                            onUpdateCart(item.vegetableId, item.quantityKg + increment);
                                        }} 
                                        className="px-3 h-full flex items-center justify-center bg-slate-50 hover:bg-slate-200 text-slate-700 disabled:opacity-50" 
                                        disabled={item.quantityKg >= item.stockKg}
                                    >
                                        <PlusIcon className="h-4 w-4"/>
                                    </button>
                                </div>
                            </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 sm:p-6 border-t border-slate-200 bg-white">
        {/* Shopping Bags */}
        {onBagCountChange && (
          <div className="mb-4 pb-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">
                  Shopping Bags
                </h4>
                <p className="text-xs text-slate-500">₹{BAG_PRICE} per bag</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onBagCountChange(false)}
                  disabled={bagCount <= 0}
                  className="w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white flex items-center justify-center text-sm font-semibold"
                >
                  -
                </button>
                <span className="text-lg font-semibold text-slate-800 min-w-[1.5rem] text-center">
                  {bagCount}
                </span>
                <button
                  onClick={() => onBagCountChange(true)}
                  className="w-6 h-6 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center text-sm font-semibold"
                >
                  +
                </button>
                <div className="ml-2 text-right">
                  <p className="text-xs text-slate-500">Bag Total</p>
                  <p className="text-sm font-semibold text-slate-800">
                    ₹{bagCount * BAG_PRICE}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Total */}
        <div className="flex justify-between text-xl font-bold mb-4">
          <span>Total</span>
          <span>{formatRoundedTotal(total + bagCount * BAG_PRICE)}</span>
        </div>

        {/* Place Order Button */}
        <Button
          size="lg"
          className={`w-full ${
            isPlacingOrder
              ? "bg-green-500 hover:bg-green-600"
              : cartItems.length === 0
              ? ""
              : ""
          }`}
          disabled={cartItems.length === 0 || isPlacingOrder}
          onClick={handlePlaceOrder}
        >
          <div className="flex items-center justify-center">
            {isPlacingOrder ? (
              <>
                <div className="w-5 h-5 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                <span>Placing Order...</span>
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-5 h-5 mr-2" />
                <span>Place Order</span>
              </>
            )}
          </div>
        </Button>
      </div>
    </div>
  );
};

const CartView: React.FC<CartViewProps> = ({
  isOpen = false,
  isDesktop = false,
  onClose = () => {},
  ...props
}) => {
  if (isDesktop) {
    return <CartContent isDesktop={true} onClose={onClose} {...props} />;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-40 transform transition-transform duration-300 ease-in-out ${
        isOpen ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="relative w-full h-full">
        <CartContent onClose={onClose} {...props} />
      </div>
    </div>
  );
};

export default CartView;
