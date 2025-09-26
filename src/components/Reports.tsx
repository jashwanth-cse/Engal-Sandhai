import React, { useEffect, useMemo, useState } from 'react';
import Button from './ui/Button.tsx';
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

  const [userInfoMap, setUserInfoMap] = useState<Record<string, { name: string; department?: string }>>({});
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
      const entries: [string, { name: string; department?: string }][] = [];
      await Promise.all(Array.from(missing).map(async (uid) => {
        try {
          const ref = doc(db, 'users', uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const data = snap.data() as any;
            const emp = data.employee || {};
            const name = emp.name || data['employee name'] || data.employee_name || data.name || 'Unknown';
            const department = emp.department || data['employee department'] || data.department;
            entries.push([uid, { name: String(name), department: department ? String(department) : undefined }]);
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
              entries.push([uid, { name: String(name2), department: department2 ? String(department2) : undefined }]);
            } else {
              entries.push([uid, { name: 'Unknown' }]);
            }
          }
        } catch {
          entries.push([uid, { name: 'Unknown' }]);
        }
      }));
      if (entries.length > 0) setUserInfoMap((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    };
    loadUserInfos();
  }, [orders, userInfoMap]);

  const totalSales = useMemo(() => orders.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0), [orders]);

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

      const title = `Daily Report - ${new Date(reportDate).toLocaleDateString()}`;
      // Header: Brand + Title
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('Engal Sandhai', 40, 28);
      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      doc.text(title, 40, 44);

      const head = [[ 'S.No', 'Employee Name', 'Customer', 'Total Items', 'Total Amount' ]];

      // Leave room for per-page total line; 17 rows per page avoids overflow
      const pageSize = 25;
      const chunks: typeof orders[] = [] as any;
      for (let i = 0; i < orders.length; i += pageSize) {
        chunks.push(orders.slice(i, i + pageSize));
      }

      let currentY = 64;
      chunks.forEach((chunk, pageIdx) => {
        const rows = chunk.map((b, idx) => {
          const items = Array.isArray(b.orderItems) ? b.orderItems : [];
          const itemsCount = items.reduce((sum, it: any) => sum + (Number(it.quantity) || 1), 0);
          const empName = userInfoMap[b.userId]?.name || 'Unknown';
          return [ String(pageIdx * pageSize + idx + 1), String(empName), String(b.userId || ''), String(itemsCount), `Rs ${(Number(b.totalAmount) || 0).toFixed(2)}` ];
        });
        const pageWidth = (doc as any).internal.pageSize.getWidth();
        const pageHeight = (doc as any).internal.pageSize.getHeight();
        (doc as any).autoTable({
          head,
          body: rows,
          startY: currentY,
          styles: { fontSize: 10, cellPadding: 6, overflow: 'linebreak' },
          headStyles: { fillColor: [30, 64, 175], textColor: 255 },
          theme: 'striped',
          margin: { top: 56, bottom: 40, left: 40, right: 40 },
          columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 170 },
            2: { cellWidth: 160 },
            3: { cellWidth: 80, halign: 'right' },
            4: { cellWidth: 90, halign: 'right' },
          },
        });
        const finalY = (doc as any).lastAutoTable?.finalY || currentY;
        // Page total for this chunk
        const pageTotal = chunk.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        const pageLabel = `Page Total: Rs ${pageTotal.toFixed(2)}`;
        const footerY = Math.min(finalY + 16, pageHeight - 24);
        doc.text(pageLabel, pageWidth - 40 - doc.getTextWidth(pageLabel), footerY);
        doc.setFont(undefined, 'normal');
        if (pageIdx < chunks.length - 1) {
          doc.addPage();
          // Repeat header on each page
          doc.setFontSize(16);
          doc.setFont(undefined, 'bold');
          doc.text('Engal Sandhai', 40, 28);
          doc.setFontSize(12);
          doc.setFont(undefined, 'normal');
          doc.text(title, 40, 44);
          currentY = 64;
        } else {
          // Entire total at end of last page
          doc.setFontSize(12);
          doc.setFont(undefined, 'bold');
          const entireLabel = `Total Sales: Rs ${totalSales.toFixed(2)}`;
          const entireY = Math.min(finalY + 34, pageHeight - 24);
          doc.text(entireLabel, pageWidth - 40 - doc.getTextWidth(entireLabel), entireY);
          doc.setFont(undefined, 'normal');
        }
      });

      doc.save(`Daily_Report_${reportDate}.pdf`);
    } catch (e) {
      console.error('Failed to generate PDF:', e);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-800">Reports</h1>
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
                <th className="px-4 py-2">Customer</th>
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
                  const itemsCount = (Array.isArray(b.orderItems) ? b.orderItems : []).reduce((sum, it: any) => sum + (Number(it.quantity) || 1), 0);
                  const empName = userInfoMap[b.userId]?.name || 'Unknown';
                  return (
                    <tr key={b.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2">{idx + 1}</td>
                      <td className="px-4 py-2 font-medium text-slate-900">{empName}</td>
                      <td className="px-4 py-2 font-mono text-xs text-slate-700">{b.userId}</td>
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


