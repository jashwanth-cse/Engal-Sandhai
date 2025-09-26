import React, { useEffect, useMemo, useState } from 'react';
import type { Bill, Vegetable } from '../../types/types';
import Button from './ui/Button.tsx';
import { db } from '../firebase';
import { doc, getDoc, collection, query as fsQuery, where, getDocs } from 'firebase/firestore';

interface ReportsProps {
  bills: Bill[];
  vegetables: Vegetable[];
}

const Reports: React.FC<ReportsProps> = ({ bills }) => {
  const [reportDate, setReportDate] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [userInfoMap, setUserInfoMap] = useState<Record<string, { name: string; department?: string }>>({});

  const dayBills = useMemo(() => {
    if (!reportDate) return [] as Bill[];
    const selected = new Date(reportDate);
    return (bills || []).filter((b) => {
      const d = new Date(b.date);
      return d.toDateString() === selected.toDateString();
    });
  }, [bills, reportDate]);

  // Ensure we have user info for all bills shown
  useEffect(() => {
    const loadUserInfos = async () => {
      const missing = new Set<string>();
      dayBills.forEach((b) => {
        const uid = String((b as any).customerId || b.customerName || '').trim();
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
  }, [dayBills, userInfoMap]);

  const totalSales = useMemo(() => dayBills.reduce((sum, b) => sum + (Number(b.total) || 0), 0), [dayBills]);

  // Lazy-load jsPDF and autoTable from CDN
  const ensureJsPdf = async (): Promise<any> => {
    if (typeof window !== 'undefined' && (window as any).jspdf?.jsPDF) {
      return (window as any).jspdf.jsPDF;
    }
    await new Promise<void>((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
      s.onload = () => resolve();
      document.body.appendChild(s);
    });
    await new Promise<void>((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js';
      s.onload = () => resolve();
      document.body.appendChild(s);
    });
    return (window as any).jspdf.jsPDF;
  };

  const generatePdf = async () => {
    try {
      const JsPDF = await ensureJsPdf();
      const doc = new JsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

      const title = `Daily Report - ${new Date(reportDate).toLocaleDateString()}`;
      doc.setFontSize(14);
      doc.text(title, 40, 40);

      const head = [[ 'S.No', 'Employee Name', 'Customer', 'Total Items', 'Total Amount' ]];
      const rows: any[] = dayBills.map((b, idx) => {
        const uid = String((b as any).customerId || b.customerName || '');
        const empName = userInfoMap[uid]?.name || 'Unknown';
        const itemsCount = (b.items || []).reduce((c, _it) => c + 1, 0);
        return [ String(idx + 1), empName, String(b.customerName || ''), String(itemsCount), `₹${(Number(b.total) || 0).toFixed(2)}` ];
      });

      const autoTable = (doc as any).autoTable as (opts: any) => void;
      autoTable(doc, {
        head,
        body: rows,
        startY: 60,
        styles: { fontSize: 10, cellPadding: 6 },
        headStyles: { fillColor: [30, 64, 175] },
        theme: 'striped',
        bodyStyles: {},
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 180 },
          2: { cellWidth: 120 },
          3: { cellWidth: 100, halign: 'right' },
          4: { cellWidth: 100, halign: 'right' },
        },
        // 18 rows per page handled automatically by autotable with page breaks; enforce with rowPageBreak
        rowPageBreak: 'auto',
        didDrawPage(data: any) {
          const pageSize = doc.internal.pageSize;
          const pageHeight = pageSize.getHeight();
          doc.setFontSize(9);
          doc.text(`Page ${doc.getNumberOfPages()}`, pageSize.getWidth() - 60, pageHeight - 20);
        },
      });

      // Summary footer
      const finalY = (doc as any).lastAutoTable?.finalY || 60;
      doc.setFontSize(12);
      doc.text(`Total Sales: ₹${totalSales.toFixed(2)}`, 40, finalY + 24);

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
              {dayBills.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No orders for the selected date.</td></tr>
              ) : (
                dayBills.map((b, idx) => {
                  const uid = String((b as any).customerId || b.customerName || '');
                  const empName = userInfoMap[uid]?.name || 'Unknown';
                  const itemsCount = (b.items || []).length;
                  return (
                    <tr key={b.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2">{idx + 1}</td>
                      <td className="px-4 py-2 font-medium text-slate-900">{empName}</td>
                      <td className="px-4 py-2 font-mono text-xs text-slate-700">{String(b.customerName || '')}</td>
                      <td className="px-4 py-2">{itemsCount}</td>
                      <td className="px-4 py-2 text-right font-semibold">₹{(Number(b.total) || 0).toFixed(2)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {dayBills.length > 0 && (
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


