import React, { useEffect, useMemo, useState } from 'react';
import Button from './ui/Button.tsx';
import MetricCard from './ui/MetricCard.tsx';
import { db } from '../firebase';
import { collection, getDocs, getDoc, orderBy, query as fsQuery, Timestamp, where, doc } from 'firebase/firestore';
import { getOrdersCol, getDateKey } from '../services/dbService';

const Reports: React.FC = () => {
  const [reportDate, setReportDate] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [userInfoMap, setUserInfoMap] = useState<Record<string, { name: string; department?: string; employeeId?: string }>>({});
  const [orders, setOrders] = useState<Array<{
    id: string;
    customerId: string;
    customerName: string;
    totalAmount: number;
    items: any[];
    createdAt: Date;
  }>>([]);
  const [loading, setLoading] = useState(false);

  // Fetch orders for the selected date from Firestore using our database architecture
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const sel = new Date(reportDate);
        const dateStr = reportDate; // Already in YYYY-MM-DD format
        
        console.log(`📊 Fetching orders for Reports on: ${reportDate}`);
        
        // Check if this is September 24th or 25th, 2025 - use legacy collection only
        const isLegacyDate = dateStr === '2025-09-24' || dateStr === '2025-09-25';
        
        let allOrders: Array<{
          id: string;
          customerId: string;
          customerName: string;
          totalAmount: number;
          items: any[];
          createdAt: Date;
        }> = [];
        
        if (isLegacyDate) {
          // Fetch only from legacy orders collection for Sept 24-25
          try {
            console.log(`📊 Fetching from legacy collection for: ${reportDate}`);
            const legacyOrdersCol = collection(db, 'orders');
            const legacyQuery = fsQuery(
              legacyOrdersCol, 
              where('createdAt', '>=', new Date(dateStr + 'T00:00:00')),
              where('createdAt', '<', new Date(dateStr + 'T23:59:59')),
              orderBy('createdAt', 'desc')
            );
            
            const legacySnap = await getDocs(legacyQuery);
            console.log(`📦 Found ${legacySnap.size} legacy orders for ${reportDate}`);
            
            const legacyOrders = legacySnap.docs.map((docSnap) => {
              const orderData = docSnap.data();
              const createdAtTs = orderData.createdAt?.toDate ? orderData.createdAt.toDate() : new Date();
              // Handle different possible field names for legacy orders
              const itemsArr: any[] = Array.isArray(orderData.items) 
                ? orderData.items 
                : Array.isArray(orderData.orderItems) 
                  ? orderData.orderItems 
                  : [];
              
              return {
                id: String(orderData.orderId || orderData.billNumber || docSnap.id),
                customerId: String(orderData.userId || orderData.employee_id || orderData.customerId || ''),
                customerName: String(orderData.customerName || orderData.name || orderData.userId || ''),
                totalAmount: Number(orderData.totalAmount) || 0,
                items: itemsArr,
                createdAt: createdAtTs,
              };
            });
            
            allOrders = legacyOrders;
          } catch (legacyError) {
            console.warn('No legacy orders found for', reportDate, legacyError);
          }
        } else {
          // Fetch only from date-based collection for all other dates
          try {
            console.log(`📊 Fetching from date-based collection for: ${reportDate}`);
            const ordersCollectionRef = getOrdersCol(sel);
            
            const ordersSnap = await getDocs(ordersCollectionRef);
            console.log(`📦 Found ${ordersSnap.size} date-based orders for ${reportDate}`);
            
            const dateBasedOrders = ordersSnap.docs.map((docSnap) => {
              const orderData = docSnap.data();
              const createdAtTs = orderData.createdAt?.toDate ? orderData.createdAt.toDate() : new Date();
              // Handle different possible field names for new orders
              const itemsArr: any[] = Array.isArray(orderData.items) 
                ? orderData.items 
                : Array.isArray(orderData.orderItems) 
                  ? orderData.orderItems 
                  : [];
              
              return {
                id: String(orderData.orderId || orderData.billNumber || docSnap.id),
                customerId: String(orderData.userId || orderData.employee_id || orderData.customerId || ''),
                customerName: String(orderData.customerName || orderData.name || orderData.userId || ''),
                totalAmount: Number(orderData.totalAmount) || 0,
                items: itemsArr,
                createdAt: createdAtTs,
              };
            });
            
            allOrders = dateBasedOrders;
          } catch (dateError) {
            console.warn('No date-based orders found for', reportDate, dateError);
          }
        }
        
        // Sort by createdAt descending (most recent first)
        allOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        console.log(`📊 Reports Summary for ${reportDate}:`, {
          isLegacyDate,
          totalOrders: allOrders.length,
          totalRevenue: allOrders.reduce((sum, order) => sum + order.totalAmount, 0),
          collectionType: isLegacyDate ? 'Legacy (orders/)' : 'Date-based (orders/YYYY-MM-DD/items/)'
        });
        
        setOrders(allOrders);
      } catch (e) {
        console.error('Failed to fetch orders for report:', e);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    if (reportDate) fetchOrders();
  }, [reportDate]);

  // Ensure we have user info for all bills shown
  useEffect(() => {
    const loadUserInfos = async () => {
      const missing = new Set<string>();
      (orders || []).forEach((b) => {
        const uid = String(b.customerId || '').trim();
        if (uid && !userInfoMap[uid]) missing.add(uid);
      });
      if (missing.size === 0) return;
      const entries: [string, { name: string; department?: string; employeeId?: string }][] = [];
      await Promise.all(Array.from(missing).map(async (uid) => {
        try {
          const ref = doc(db, 'users', uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const data = snap.data() as any;
            const emp = data.employee || {};
            const name = emp.name || data['employee name'] || data.employee_name || data.name || 'Unknown';
            const department = emp.department || data['employee department'] || data.department;
            const employeeId = emp.employee_id || data.employee_id || uid;
            entries.push([uid, { name: String(name), department: department ? String(department) : undefined, employeeId: String(employeeId) }]);
          } else {
            const usersCol = collection(db, 'users');
            const byEmpId = fsQuery(usersCol, where('employee_id', '==', uid));
            const byNestedEmpId = fsQuery(usersCol, where('employee.employee_id', '==', uid));
            let foundDoc: any | null = null;
            const [snap1, snap2] = await Promise.all([getDocs(byEmpId), getDocs(byNestedEmpId)]);
            if (!snap1.empty) foundDoc = snap1.docs[0].data();
            else if (!snap2.empty) foundDoc = snap2.docs[0].data();
            if (foundDoc) {
              const emp2 = foundDoc.employee || {};
              const name2 = emp2.name || foundDoc['employee name'] || foundDoc.employee_name || foundDoc.name || 'Unknown';
              const department2 = emp2.department || foundDoc['employee department'] || foundDoc.department;
              const employeeId2 = emp2.employee_id || foundDoc.employee_id || uid;
              entries.push([uid, { name: String(name2), department: department2 ? String(department2) : undefined, employeeId: String(employeeId2) }]);
            } else {
              entries.push([uid, { name: 'Unknown', employeeId: uid }]);
            }
          }
        } catch {
          entries.push([uid, { name: 'Unknown', employeeId: uid }]);
        }
      }));
      if (entries.length > 0) setUserInfoMap((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    };
    loadUserInfos();
  }, [orders, userInfoMap]);

  const totalSales = useMemo(() => orders.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0), [orders]);
  
  const totalOrders = useMemo(() => orders.length, [orders]);
  
  const totalItems = useMemo(() => {
    return orders.reduce((sum, order) => {
      const items = Array.isArray(order.items) ? order.items : [];
      return sum + items.reduce((itemSum, item) => itemSum + Math.floor(Number(item.quantity) || 1), 0);
    }, 0);
  }, [orders]);

  // Ensure we have user info for all orders shown
  useEffect(() => {
    const loadUserInfos = async () => {
      const missing = new Set<string>();
      (orders || []).forEach((b) => {
        const uid = String(b.customerId || '').trim();
        if (uid && !userInfoMap[uid]) missing.add(uid);
      });
      if (missing.size === 0) return;
      const entries: [string, { name: string; department?: string; employeeId?: string }][] = [];
      await Promise.all(Array.from(missing).map(async (uid) => {
        try {
          const ref = doc(db, 'users', uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const data = snap.data() as any;
            const emp = data.employee || {};
            const name = emp.name || data['employee name'] || data.employee_name || data.name || 'Unknown';
            const department = emp.department || data['employee department'] || data.department;
            const employeeId = emp.employee_id || data.employee_id || uid;
            entries.push([uid, { name: String(name), department: department ? String(department) : undefined, employeeId: String(employeeId) }]);
          } else {
            const usersCol = collection(db, 'users');
            const byEmpId = fsQuery(usersCol, where('employee_id', '==', uid));
            const byNestedEmpId = fsQuery(usersCol, where('employee.employee_id', '==', uid));
            let foundDoc: any | null = null;
            const [snap1, snap2] = await Promise.all([getDocs(byEmpId), getDocs(byNestedEmpId)]);
            if (!snap1.empty) foundDoc = snap1.docs[0].data();
            else if (!snap2.empty) foundDoc = snap2.docs[0].data();
            if (foundDoc) {
              const emp2 = foundDoc.employee || {};
              const name2 = emp2.name || foundDoc['employee name'] || foundDoc.employee_name || foundDoc.name || 'Unknown';
              const department2 = emp2.department || foundDoc['employee department'] || foundDoc.department;
              const employeeId2 = emp2.employee_id || foundDoc.employee_id || uid;
              entries.push([uid, { name: String(name2), department: department2 ? String(department2) : undefined, employeeId: String(employeeId2) }]);
            } else {
              entries.push([uid, { name: 'Unknown', employeeId: uid }]);
            }
          }
        } catch {
          entries.push([uid, { name: 'Unknown', employeeId: uid }]);
        }
      }));
      if (entries.length > 0) setUserInfoMap((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    };
    loadUserInfos();
  }, [orders, userInfoMap]);

  // Lazy-load jsPDF and autoTable from CDN
  const ensureJsPdf = async (): Promise<any> => {
    const getCtor = () => (window as any)?.jspdf?.jsPDF || (window as any)?.jsPDF || null;
    const hasAutoTable = () => {
      const ctor = getCtor();
      if (!ctor) return false;
      try {
        const test = new ctor({ unit: 'pt' });
        return typeof (test as any).autoTable === 'function';
      } catch {
        return false;
      }
    };

    if (getCtor() && hasAutoTable()) return getCtor();

    // Load jsPDF UMD
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load jsPDF'));
      document.body.appendChild(s);
    });

    // Load AutoTable plugin
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load jsPDF AutoTable'));
      document.body.appendChild(s);
    });

    const ctor = getCtor();
    if (!ctor) throw new Error('jsPDF not available after load');
    const testDoc = new ctor({ unit: 'pt' });
    if (typeof (testDoc as any).autoTable !== 'function') throw new Error('jsPDF AutoTable not registered');
    return ctor;
  };

  const generatePdf = async () => {
    try {
      if (orders.length === 0) {
        alert('No data available for the selected date to generate PDF.');
        return;
      }

      const JsPDF = await ensureJsPdf();
      const DocCtor = (window as any)?.jspdf?.jsPDF || JsPDF;
      const doc = new DocCtor({ orientation: 'portrait', unit: 'pt', format: 'a4' });

      const pageWidth = (doc as any).internal.pageSize.getWidth();
      const pageHeight = (doc as any).internal.pageSize.getHeight();
      
      let pageNumber = 1;
      let currentY = 40;
      const pageBreakMargin = 60; // Space needed for page totals
      const rowHeight = 20;
      const headerHeight = 60;
      
      // Track page totals
      let currentPageTotal = 0;
      const pageTotals: number[] = [];
      let currentPageOrders: any[] = [];

      // Helper function to add header
      const addHeader = () => {
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.text('Engal Sandhai', 40, currentY);
        currentY += 25;
        
        doc.setFontSize(14);
        doc.text(`Daily Report - ${reportDate}`, 40, currentY);
        currentY += 30;
        
        // Table header
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('S.No', 40, currentY);
        doc.text('Employee Name', 80, currentY);
        doc.text('Customer', 250, currentY);
        doc.text('Total Items', 350, currentY);
        doc.text('Total Amount', 450, currentY);
        currentY += 5;
        
        // Header line
        doc.setLineWidth(1);
        doc.line(40, currentY, pageWidth - 40, currentY);
        currentY += 15;
      };

      // Helper function to add page total and break
      const addPageBreak = () => {
        // Add page total
        currentY += 10;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(12);
        doc.text(`Page ${pageNumber} total - Rs ${currentPageTotal.toFixed(2)}`, 40, currentY);
        
        pageTotals.push(currentPageTotal);
        currentPageTotal = 0;
        currentPageOrders = [];
        
        doc.addPage();
        pageNumber++;
        currentY = 40;
        addHeader();
      };

      // Add initial header
      addHeader();

      // Process each order
      orders.forEach((order, index) => {
        const userInfo = userInfoMap[order.customerId];
        const employeeName = userInfo?.name || order.customerName || 'Unknown';
        const employeeId = userInfo?.employeeId || order.customerId || 'Unknown';
        const itemsCount = (Array.isArray(order.items) ? order.items : []).reduce((sum, it: any) => sum + Math.floor(Number(it.quantity) || 1), 0);
        const amount = Number(order.totalAmount) || 0;
        
        // Check if we need a page break
        if (currentY + rowHeight + pageBreakMargin > pageHeight - 40) {
          addPageBreak();
        }
        
        // Add order data
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        doc.text(String(index + 1), 40, currentY);
        doc.text(employeeName.substring(0, 25), 80, currentY); // Limit name length
        doc.text(employeeId, 250, currentY);
        doc.text(String(itemsCount), 350, currentY);
        doc.text(`Rs. ${amount.toFixed(2)}`, 450, currentY);
        
        currentPageTotal += amount;
        currentPageOrders.push(order);
        currentY += rowHeight;
      });

      // Add final page total
      if (currentPageOrders.length > 0) {
        currentY += 10;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(12);
        doc.text(`Page ${pageNumber} total - Rs ${currentPageTotal.toFixed(2)}`, 40, currentY);
        pageTotals.push(currentPageTotal);
      }

      // Add summary page if we have multiple pages
      if (pageTotals.length > 1) {
        doc.addPage();
        currentY = 40;
        
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('Report Summary', 40, currentY);
        currentY += 30;
        
        // Show all page totals
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        pageTotals.forEach((pageTotal, idx) => {
          doc.text(`Page ${idx + 1} total - Rs ${pageTotal.toFixed(2)}`, 40, currentY);
          currentY += 20;
        });
        
        currentY += 10;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(14);
        doc.text(`Total Sales - Rs ${totalSales.toFixed(2)}`, 40, currentY);
      } else {
        // Single page - add total sales at the end
        currentY += 20;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(14);
        doc.text(`Total Sales - Rs ${totalSales.toFixed(2)}`, 40, currentY);
      }

      // Additional summary info
      currentY += 30;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(11);
      doc.text(`Total Orders: ${totalOrders}`, 40, currentY);
      currentY += 15;
      doc.text(`Total Items: ${totalItems}`, 40, currentY);
      currentY += 15;
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, currentY);

      doc.save(`Daily_Report_${reportDate}.pdf`);
      
    } catch (e) {
      console.error('Failed to generate PDF:', e);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-800">Reports</h1>
      
      {/* Daily Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Total Revenue"
          value={`₹${totalSales.toFixed(2)}`}
          icon={
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <MetricCard
          title="Total Orders"
          value={totalOrders}
          icon={
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          }
        />
        <MetricCard
          title="Total Items"
          value={totalItems}
          icon={
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
      </div>

      <div className="bg-white rounded-xl shadow p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Select Date</label>
          <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="border rounded-md px-3 py-2" />
        </div>
        <div className="sm:ml-auto">
          <Button onClick={generatePdf}>Generate Report (PDF)</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Preview</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs uppercase bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-2">S.No</th>
                <th className="px-4 py-2">Employee Name</th>
                <th className="px-4 py-2">Employee ID</th>
                <th className="px-4 py-2">Total Items</th>
                <th className="px-4 py-2 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Loading...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No orders for the selected date.</td></tr>
              ) : (
                orders.map((b, idx) => {
                  const itemsCount = (Array.isArray(b.items) ? b.items : []).reduce((sum, it: any) => sum + Math.floor(Number(it.quantity) || 1), 0);
                  const userInfo = userInfoMap[b.customerId];
                  const employeeName = userInfo?.name || b.customerName || 'Unknown';
                  const employeeId = userInfo?.employeeId || b.customerId || 'Unknown';
                  
                  return (
                    <tr key={b.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2">{idx + 1}</td>
                      <td className="px-4 py-2 font-medium text-slate-900">{employeeName}</td>
                      <td className="px-4 py-2 font-medium text-slate-900">{employeeId}</td>
                      <td className="px-4 py-2">{itemsCount}</td>
                      <td className="px-4 py-2 text-right font-semibold">₹{(Number(b.totalAmount) || 0).toFixed(2)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {orders.length > 0 && !loading && (
              <tfoot>
                <tr>
                  <td className="px-4 py-3" colSpan={4}><span className="font-semibold">Total Sales</span></td>
                  <td className="px-4 py-3 text-right font-bold">₹{totalSales.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;