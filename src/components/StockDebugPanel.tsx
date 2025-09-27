import React, { useState } from 'react';
import { forcePopulateAvailableStock, checkAvailableStockStatus } from '../utils/populateAvailableStockNow';
import { testFirebaseConnection } from '../utils/testFirebaseConnection';

const StockDebugPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);

  const handlePopulateStock = async () => {
    setLoading(true);
    try {
      console.log('🔧 Starting force population...');
      const result = await forcePopulateAvailableStock();
      setResults(result);
      console.log('Population completed:', result);
    } catch (error) {
      console.error('Population failed:', error);
      setResults({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    setLoading(true);
    try {
      const status = await checkAvailableStockStatus();
      setStatus(status);
      console.log('Status checked:', status);
    } catch (error) {
      console.error('Status check failed:', error);
      setStatus({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setLoading(true);
    try {
      const result = await testFirebaseConnection();
      console.log('Connection test result:', result);
      setResults({ connectionTest: result });
    } catch (error) {
      console.error('Connection test failed:', error);
      setResults({ connectionTest: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Stock Debug Panel</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={handleTestConnection}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Firebase Connection'}
        </button>
        
        <button
          onClick={handleCheckStatus}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Check Available Stock Status'}
        </button>
        
        <button
          onClick={handlePopulateStock}
          disabled={loading}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? 'Populating...' : 'Force Populate Available Stock'}
        </button>
      </div>

      {status && (
        <div className="bg-slate-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Available Stock Status:</h3>
          <div className="text-sm">
            <p>Collection exists: {status.exists ? '✅ Yes' : '❌ No'}</p>
            <p>Total entries: {status.count || 0}</p>
            {status.docs && status.docs.length > 0 && (
              <div className="mt-2">
                <p className="font-medium">Sample entries:</p>
                <div className="max-h-32 overflow-y-auto">
                  {status.docs.slice(0, 5).map((doc: any, index: number) => (
                    <div key={index} className="text-xs text-slate-600">
                      {doc.id}: {doc.name} (Stock: {doc.availableStock})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {results && (
        <div className="bg-slate-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Results:</h3>
          <pre className="text-xs text-slate-600 whitespace-pre-wrap">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}

      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
        <h3 className="font-semibold text-yellow-800 mb-2">Instructions:</h3>
        <ol className="text-sm text-yellow-700 space-y-1">
          <li>1. First, click "Test Firebase Connection" to ensure Firebase is working</li>
          <li>2. Click "Check Available Stock Status" to see current state</li>
          <li>3. Click "Force Populate Available Stock" to create missing entries</li>
          <li>4. Check the results and try deleting items from inventory again</li>
        </ol>
      </div>
    </div>
  );
};

export default StockDebugPanel;
