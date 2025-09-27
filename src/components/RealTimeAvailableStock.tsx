import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { AvailableStock } from '../types/firestore';

const RealTimeAvailableStock: React.FC = () => {
  const [availableStocks, setAvailableStocks] = useState<(AvailableStock & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const availableStockRef = collection(db, 'availableStock');
    const q = query(availableStockRef, orderBy('lastUpdated', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const stocks = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as AvailableStock & { id: string }));
        
        setAvailableStocks(stocks);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('Error listening to available stock:', error);
        setError('Failed to load available stock data');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Real-time Available Stock</h2>
        <div className="text-sm text-slate-500">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {availableStocks.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-lg">
          <p className="text-slate-500">No available stock data found.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {availableStocks.map((stock) => {
            const stockPercentage = (stock.availableStockKg / stock.totalStockKg) * 100;
            const isLowStock = stockPercentage < 20;
            const isOutOfStock = stock.availableStockKg <= 0;
            
            return (
              <div
                key={stock.id}
                className={`p-4 rounded-lg border transition-all duration-200 ${
                  isOutOfStock
                    ? 'border-red-300 bg-red-50'
                    : isLowStock 
                      ? 'border-yellow-300 bg-yellow-50' 
                      : 'border-slate-200 bg-white hover:shadow-md'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-slate-900">{stock.productName}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        stock.unitType === 'KG' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {stock.unitType}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                        {stock.category}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">ID: {stock.productId}</p>
                    <p className="text-sm text-slate-600">₹{stock.pricePerKg.toFixed(2)}/{stock.unitType === 'KG' ? 'kg' : 'piece'}</p>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${
                      isOutOfStock 
                        ? 'text-red-600' 
                        : isLowStock 
                          ? 'text-yellow-600' 
                          : 'text-slate-900'
                    }`}>
                      {stock.availableStockKg.toFixed(stock.unitType === 'KG' ? 1 : 0)}
                    </div>
                    <div className="text-sm text-slate-600">
                      of {stock.totalStockKg.toFixed(stock.unitType === 'KG' ? 1 : 0)} total
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
                        isOutOfStock
                          ? 'bg-red-500'
                          : isLowStock 
                            ? 'bg-yellow-500' 
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, stockPercentage)}%` }}
                    />
                  </div>
                </div>
                
                {/* Status messages */}
                {isOutOfStock && (
                  <div className="mt-2 text-sm text-red-600 font-medium">
                    🚫 Out of stock
                  </div>
                )}
                {!isOutOfStock && isLowStock && (
                  <div className="mt-2 text-sm text-yellow-600 font-medium">
                    ⚠️ Low stock warning
                  </div>
                )}
                
                {/* Last updated info */}
                <div className="mt-2 text-xs text-slate-500">
                  Updated: {stock.lastUpdated.toLocaleString()} by {stock.updatedBy}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RealTimeAvailableStock;
