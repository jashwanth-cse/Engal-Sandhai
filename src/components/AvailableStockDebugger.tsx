import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { AvailableStock } from '../types/firestore';
import { testFirebaseConnection, testAvailableStockOperations } from '../utils/testFirebaseConnection';
import { getAllAvailableStock, reduceAvailableStock, deleteAvailableStock } from '../utils/availableStockUtils';

const AvailableStockDebugger: React.FC = () => {
  const [availableStocks, setAvailableStocks] = useState<(AvailableStock & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<string[]>([]);

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

  const runTests = async () => {
    setTestResults([]);
    setTestResults(prev => [...prev, 'Starting Firebase connection tests...']);
    
    try {
      // Test Firebase connection
      const connectionTest = await testFirebaseConnection();
      if (connectionTest) {
        setTestResults(prev => [...prev, '✅ Firebase connection test passed']);
      } else {
        setTestResults(prev => [...prev, '❌ Firebase connection test failed']);
      }

      // Test available stock operations
      const stockTest = await testAvailableStockOperations();
      if (stockTest) {
        setTestResults(prev => [...prev, '✅ Available stock operations test passed']);
      } else {
        setTestResults(prev => [...prev, '❌ Available stock operations test failed']);
      }

      // Test fetching all available stock
      const allStocks = await getAllAvailableStock();
      setTestResults(prev => [...prev, `✅ Fetched ${allStocks.length} available stock entries`]);

    } catch (error) {
      setTestResults(prev => [...prev, `❌ Test error: ${error}`]);
    }
  };

  const testReduceStock = async (productId: string) => {
    try {
      setTestResults(prev => [...prev, `Testing stock reduction for ${productId}...`]);
      await reduceAvailableStock(productId, 1, 'debug-test');
      setTestResults(prev => [...prev, `✅ Stock reduced for ${productId}`]);
    } catch (error) {
      setTestResults(prev => [...prev, `❌ Failed to reduce stock for ${productId}: ${error}`]);
    }
  };

  const testDeleteStock = async (productId: string) => {
    try {
      setTestResults(prev => [...prev, `Testing stock deletion for ${productId}...`]);
      await deleteAvailableStock(productId);
      setTestResults(prev => [...prev, `✅ Stock deleted for ${productId}`]);
    } catch (error) {
      setTestResults(prev => [...prev, `❌ Failed to delete stock for ${productId}: ${error}`]);
    }
  };

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Available Stock Debugger</h2>
        <button
          onClick={runTests}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Run Tests
        </button>
      </div>

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="bg-slate-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Test Results:</h3>
          <div className="space-y-1">
            {testResults.map((result, index) => (
              <div key={index} className="text-sm font-mono">{result}</div>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Available Stock List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Available Stock Entries ({availableStocks.length})</h3>
        </div>
        
        {availableStocks.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No available stock entries found. Try adding some vegetables to inventory first.
          </div>
        ) : (
          <div className="divide-y">
            {availableStocks.map((stock) => (
              <div key={stock.id} className="p-4 hover:bg-slate-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-slate-900">{stock.productName}</h4>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                        {stock.category}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {stock.unitType}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">ID: {stock.productId}</p>
                    <p className="text-sm text-slate-600">₹{stock.pricePerKg.toFixed(2)}/{stock.unitType === 'KG' ? 'kg' : 'piece'}</p>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-slate-900">
                      {stock.availableStockKg.toFixed(stock.unitType === 'KG' ? 1 : 0)}
                    </div>
                    <div className="text-sm text-slate-600">
                      of {stock.totalStockKg.toFixed(stock.unitType === 'KG' ? 1 : 0)} total
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => testReduceStock(stock.productId)}
                    className="px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
                  >
                    Test Reduce Stock
                  </button>
                  <button
                    onClick={() => testDeleteStock(stock.productId)}
                    className="px-3 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200"
                  >
                    Test Delete
                  </button>
                </div>
                
                <div className="mt-2 text-xs text-slate-500">
                  Last updated: {stock.lastUpdated.toLocaleString()} by {stock.updatedBy}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AvailableStockDebugger;
