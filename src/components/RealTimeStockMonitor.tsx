import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

interface StockItem {
  id: string;
  name: string;
  stockKg: number;
  pricePerKg: number;
  category: string;
  unitType: string;
}

const RealTimeStockMonitor: React.FC = () => {
  const [vegetables, setVegetables] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const vegetablesRef = collection(db, 'vegetables');
    const q = query(vegetablesRef, orderBy('name'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const vegs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as StockItem));
        
        setVegetables(vegs);
        setLastUpdate(new Date());
        setLoading(false);
        console.log('Stock updated in real-time:', vegs.length, 'items');
      },
      (error) => {
        console.error('Error listening to vegetables:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-4 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-800">Real-time Stock Monitor</h3>
        <div className="text-sm text-slate-500">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>
      
      <div className="bg-slate-50 p-3 rounded-lg">
        <div className="text-sm text-slate-600">
          Total items: {vegetables.length} | 
          Low stock items: {vegetables.filter(v => v.stockKg < 10).length}
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-2">
        {vegetables.slice(0, 10).map((veg) => (
          <div
            key={veg.id}
            className={`p-3 rounded-lg border ${
              veg.stockKg < 10 
                ? 'border-red-200 bg-red-50' 
                : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium text-slate-900">{veg.name}</div>
                <div className="text-sm text-slate-600">{veg.category}</div>
              </div>
              <div className="text-right">
                <div className={`font-bold ${
                  veg.stockKg < 10 ? 'text-red-600' : 'text-slate-900'
                }`}>
                  {veg.stockKg.toFixed(veg.unitType === 'KG' ? 1 : 0)} {veg.unitType}
                </div>
                <div className="text-sm text-slate-600">
                  ₹{veg.pricePerKg.toFixed(2)}/{veg.unitType === 'KG' ? 'kg' : 'piece'}
                </div>
              </div>
            </div>
            {veg.stockKg < 10 && (
              <div className="mt-2 text-xs text-red-600 font-medium">
                ⚠️ Low stock warning
              </div>
            )}
          </div>
        ))}
      </div>
      
      {vegetables.length > 10 && (
        <div className="text-sm text-slate-500 text-center">
          Showing first 10 items. Total: {vegetables.length}
        </div>
      )}
    </div>
  );
};

export default RealTimeStockMonitor;
