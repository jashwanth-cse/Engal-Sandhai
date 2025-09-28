import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Stock } from '../types/firestore';

interface AvailableStockDisplayProps {
  productId?: string; // Optional: show specific product or all products
}

const AvailableStockDisplay: React.FC<AvailableStockDisplayProps> = ({ productId }) => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        if (productId) {
          // Listen to specific product
          const stockRef = doc(db, 'stocks', productId);
          const unsubscribe = onSnapshot(stockRef, (doc) => {
            if (doc.exists()) {
              setStocks([doc.data() as Stock]);
            }
            setLoading(false);
          });
          return unsubscribe;
        } else {
          // Listen to all stocks
          const stocksRef = collection(db, 'stocks');
          const unsubscribe = onSnapshot(stocksRef, (snapshot) => {
            const stocksData = snapshot.docs.map(doc => doc.data() as Stock);
            setStocks(stocksData);
            setLoading(false);
          });
          return unsubscribe;
        }
      } catch (error) {
        console.error('Error fetching stocks:', error);
        setLoading(false);
      }
    };

    let unsubscribe: (() => void) | undefined;
    
    fetchStocks().then((unsub) => {
      unsubscribe = unsub;
    });
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [productId]);

  if (loading) {
    return <div className="p-4">Loading stock information...</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-800">
        {productId ? 'Product Stock' : 'Available Stock Overview'}
      </h3>
      
      <div className="grid gap-4">
        {stocks.map((stock) => {
          const stockPercentage = (stock.availableStock / stock.quantity) * 100;
          const isLowStock = stockPercentage < 20;
          
          return (
            <div
              key={stock.productId}
              className={`p-4 rounded-lg border ${
                isLowStock 
                  ? 'border-red-200 bg-red-50' 
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-slate-900">{stock.productName}</h4>
                  <p className="text-sm text-slate-600">ID: {stock.productId}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-900">
                    {stock.availableStock.toFixed(1)}
                  </div>
                  <div className="text-sm text-slate-600">
                    of {stock.quantity} total
                  </div>
                </div>
              </div>
              
              {/* Stock level indicator */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Stock Level</span>
                  <span>{stockPercentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      isLowStock 
                        ? 'bg-red-500' 
                        : stockPercentage < 50 
                          ? 'bg-yellow-500' 
                          : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, stockPercentage)}%` }}
                  />
                </div>
              </div>
              
              {isLowStock && (
                <div className="mt-2 text-sm text-red-600 font-medium">
                  ⚠️ Low stock warning
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AvailableStockDisplay;
