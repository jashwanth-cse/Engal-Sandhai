# Engal Sandhai  

**Engal Sandhai** is a **web-based, intranet-only billing and realtime stock management system** built for a college campus vegetable store.  
It connects **faculty buyers (~300 daily active users)** with **admin faculty (5 users)** who manage daily stock and prices.  
The system generates bills, accepts static-QR-based payments (faculty upload payment screenshots), decrements stock **atomically**, and provides realtime stock updates across connected clients.  

---

## 📌 Quick Summary  
- **Single-server**, intranet-only web app for campus vegetable billing.  
- **Two roles**:  
  - **Admin (5 faculty)** → manage stock, prices, and orders.  
  - **Faculty (all others)** → place orders, upload payment screenshot, receive bills.  
- **Payment flow**:  
  - Static QR is displayed on the bill.  
  - Faculty uploads payment screenshot.  
  - Admin verifies payment manually.  
- **Stock updates**:  
  - Stock decrements only when payment screenshot is uploaded.  
  - Updates are processed **atomically** to prevent overselling.  
- **Realtime** updates via WebSockets.  

