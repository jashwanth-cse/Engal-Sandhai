// src/utils/billSvgRenderer.ts

export function generateInvoiceSVG({
  items,
  customerName,
  billNumber,
  billDate,
  billTime,
  employeeId,
  total,
  upiBlock,
}: any) {
  const svg = `
  <svg width="595" height="842" xmlns="http://www.w3.org/2000/svg">

    <!-- Header Gradient -->
    <defs>
      <linearGradient id="headerGrad" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0%" stop-color="#d8f5e6"/>
        <stop offset="100%" stop-color="#48bb78"/>
      </linearGradient>
    </defs>

    <rect x="20" y="20" width="555" height="70" rx="10" fill="url(#headerGrad)" />

    <text x="297" y="55" text-anchor="middle"
      font-size="28" font-weight="700" fill="#064e3b">Engal Santhai</text>
    <text x="297" y="78" text-anchor="middle"
      font-size="12" fill="#065f46">Your Fresh Vegetable Partner</text>

    <!-- Bill Meta -->
    <text x="30" y="120" font-size="12" font-weight="600">INVOICE</text>

    <text x="30" y="145" font-size="12">BILL NO: ${billNumber}</text>
    <text x="450" y="145" font-size="12">Date: ${billDate}</text>

    <text x="30" y="165" font-size="12">CUSTOMER NAME: ${customerName}</text>
    <text x="450" y="165" font-size="12">Time: ${billTime}</text>

    <text x="30" y="185" font-size="12">EMP ID: ${employeeId}</text>

    <!-- Table Header -->
    <rect x="30" y="205" width="535" height="30" fill="#f1f5f9"/>
    <text x="40" y="225" font-size="11" font-weight="700">S.No</text>
    <text x="90" y="225" font-size="11" font-weight="700">Item</text>
    <text x="300" y="225" font-size="11" font-weight="700" text-anchor="end">Qty(kg)</text>
    <text x="400" y="225" font-size="11" font-weight="700" text-anchor="end">Rate</text>
    <text x="550" y="225" font-size="11" font-weight="700" text-anchor="end">Amount</text>

    ${items
      .map(
        (it: any, i: number) => `
      <text x="40" y="${260 + i * 24}" font-size="11">${i + 1}</text>
      <text x="90" y="${260 + i * 24}" font-size="11">${it.name}</text>
      <text x="300" y="${260 + i * 24}" font-size="11" text-anchor="end">${it.qty}</text>
      <text x="400" y="${260 + i * 24}" font-size="11" text-anchor="end">₹${it.rate}</text>
      <text x="550" y="${260 + i * 24}" font-size="11" text-anchor="end">₹${it.amount}</text>
    `
      )
      .join("")}

    <!-- Total Box -->
    <rect x="350" y="680" width="215" height="70" fill="#f8fafc" stroke="#dce3ea" rx="8"/>
    <text x="500" y="710" text-anchor="end" font-size="14" font-weight="700">TOTAL</text>
    <text x="550" y="710" text-anchor="end" font-size="14" font-weight="700">₹${total}</text>

    ${upiBlock || ""}

  </svg>
  `;
  return svg;
}
