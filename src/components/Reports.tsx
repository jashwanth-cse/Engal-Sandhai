import React, { useEffect, useMemo, useState } from 'react';
import Button from './ui/Button.tsx';
import MetricCard from './ui/MetricCard.tsx';
import { db } from '../firebase';
import { collection, getDocs, orderBy, query as fsQuery, Timestamp, where, doc, getDoc } from 'firebase/firestore';

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
    userId: string;
    totalAmount: number;
    orderItems: any[];
    createdAt: Date;
  }>>([]);
  const [loading, setLoading] = useState(false);

  // Fetch orders for the selected date from Firestore
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const sel = new Date(reportDate);
        const start = new Date(sel.getFullYear(), sel.getMonth(), sel.getDate(), 0, 0, 0, 0);
        const end = new Date(sel.getFullYear(), sel.getMonth(), sel.getDate(), 23, 59, 59, 999);
        const col = collection(db, 'orders');
        const q = fsQuery(
          col,
          where('createdAt', '>=', Timestamp.fromDate(start)),
          where('createdAt', '<=', Timestamp.fromDate(end)),
          orderBy('createdAt', 'asc')
        );
        const snap = await getDocs(q);
        const rows = snap.docs.map(d => {
          const data: any = d.data();
          const createdAtTs = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
          const itemsArr: any[] = Array.isArray(data.orderItems) ? data.orderItems : (Array.isArray(data.items) ? data.items : []);
          return {
            id: String(data.orderId || d.id),
            userId: String(data.userId || data.employee_id || ''),
            totalAmount: Number(data.totalAmount) || 0,
            orderItems: itemsArr,
            createdAt: createdAtTs,
          };
        });
        setOrders(rows);
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
        const uid = String(b.userId || '').trim();
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
      const items = Array.isArray(order.orderItems) ? order.orderItems : [];
      return sum + items.reduce((itemSum, item: any) => itemSum + Math.floor(Number(item.quantity) || 0), 0);
    }, 0);
  }, [orders]);

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
      const JsPDF = await ensureJsPdf();
      // Access UMD as window.jspdf.jsPDF if available
      const DocCtor = (window as any)?.jspdf?.jsPDF || JsPDF;
      const doc = new DocCtor({ orientation: 'portrait', unit: 'pt', format: 'a4' });

      const pageWidth = (doc as any).internal.pageSize.getWidth();
      const pageHeight = (doc as any).internal.pageSize.getHeight();
      let currentY = 40;

      // Helper function to add a new page if needed
      const checkPageBreak = (requiredSpace: number) => {
        if (currentY + requiredSpace > pageHeight - 40) {
          doc.addPage();
          currentY = 40;
          return true;
        }
        return false;
      };

      // Helper function to add bill header
      const addBillHeader = (order: any, index: number) => {
        const empName = userInfoMap[order.userId]?.name || 'Unknown';
        const empId = userInfoMap[order.userId]?.employeeId || order.userId;
        const customerName = userInfoMap[order.userId]?.name || 'Unknown Customer';
        const orderDate = order.createdAt.toLocaleDateString();
        const orderTime = order.createdAt.toLocaleTimeString();

        // Company name and tagline
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('Engal Sandhai', 40, currentY);
        currentY += 15;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text('Your Fresh Vegetable Partner', 40, currentY);
        currentY += 20;

        // Invoice title
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('INVOICE', 40, currentY);
        currentY += 20;

        // Bill details
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`BILL NUMBER: ${order.id}`, 40, currentY);
        currentY += 12;

        doc.text(`CUSTOMER NAME: ${customerName}`, 40, currentY);
        currentY += 12;

        doc.text(`EMP ID: ${empId}`, 40, currentY);
        currentY += 12;

        doc.text(`Date: ${orderDate}`, 40, currentY);
        doc.text(`Time: ${orderTime}`, 200, currentY);
        currentY += 20;
      };

      // Helper function to add items list (no table)
      const addItemsList = (order: any) => {
        const items = Array.isArray(order.orderItems) ? order.orderItems : [];
        
        if (items.length === 0) {
          doc.setFontSize(10);
          doc.text('No items in this order', 40, currentY);
          currentY += 15;
          return;
        }

        // Items list without table format
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        
        items.forEach((item: any, index: number) => {
          const quantity = Math.floor(Number(item.quantity) || 1);
          const price = Number(item.price) || 0;
          const total = quantity * price;
          
          // Item number and name
          doc.text(`${index + 1}. ${item.name || 'Unknown Item'}`, 40, currentY);
          currentY += 12;
          
          // Quantity and rate
          doc.text(`   Qty: ${quantity} kg`, 60, currentY);
          doc.text(`Rate: ₹${price.toFixed(2)}`, 200, currentY);
          currentY += 12;
          
          // Amount
          doc.text(`   Amount: ₹${total.toFixed(2)}`, 60, currentY);
          currentY += 15;
        });

        currentY += 10;
      };

      // Helper function to add bill total
      const addBillTotal = (order: any) => {
        const totalAmount = Number(order.totalAmount) || 0;
        
        // Total section
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`TOTAL: ₹${totalAmount.toFixed(2)}`, 40, currentY);
        currentY += 30;

        // Payment section
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text('Pay using UPI:', 40, currentY);
        currentY += 12;
        doc.text('UPI ID: qualitykannan1962-1@okhdfcbank', 40, currentY);
        currentY += 20;
      };

      // Generate individual bills
      orders.forEach((order, index) => {
        // Check if we need a new page
        checkPageBreak(150); // Approximate space needed for a bill

        // Add bill header
        addBillHeader(order, index);
        
        // Add items list (no table)
        addItemsList(order);
        
        // Add bill total
        addBillTotal(order);

        // Add some space between bills
        currentY += 20;
      });

      // Add summary at the end
      if (currentY + 50 > pageHeight - 40) {
        doc.addPage();
        currentY = 40;
      }

      // Summary section
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Daily Summary', 40, currentY);
      currentY += 20;

      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      doc.text(`Total Orders: ${totalOrders}`, 40, currentY);
      currentY += 15;
      doc.text(`Total Items: ${totalItems}`, 40, currentY);
      currentY += 15;
      doc.text(`Total Sales: ₹${totalSales.toFixed(2)}`, 40, currentY);

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
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Loading...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No orders for the selected date.</td></tr>
              ) : (
                orders.map((b, idx) => {
                  const itemsCount = (Array.isArray(b.orderItems) ? b.orderItems : []).reduce((sum, it: any) => sum + Math.floor(Number(it.quantity) || 1), 0);
                  const empName = userInfoMap[b.userId]?.name || 'Unknown';
                  const empId = userInfoMap[b.userId]?.employeeId || b.userId;
                  return (
                    <tr key={b.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2">{idx + 1}</td>
                      <td className="px-4 py-2 font-medium text-slate-900">{empName}</td>
                      <td className="px-4 py-2 font-medium text-slate-900">{empId}</td>
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


