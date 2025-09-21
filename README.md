Engal Sandhai is a web-based, intranet-only billing and realtime stock management system built for a college campus vegetable store.
It connects faculty buyers (≈300 daily active users) with admin faculty (5 users) who manage daily stock and prices. The system generates bills, accepts static-QR-based payments (faculty upload payment screenshot), decrements stock atomically, and provides realtime stock updates across connected clients.
Quick summary

Single-server, intranet-only web app for campus vegetable billing.

Two roles: admin (10 faculty) and faculty (all other faculty).

Admins update daily stock (name, quantity, rate, photo). Faculty can place orders, upload payment screenshot, and receive bills.

Payment is handled offline via static QR; the app only stores screenshot proof and verifies it via admin.

Stock is decremented only when payment screenshot is uploaded and processed atomically.

Realtime stock and order updates via WebSockets.
Key features

Role-based auth (employee_id + password) with forced password change option.

Admin panel: add/update vegetables (photo, qty, rate), view & filter orders, verify payments, revert stock.

Buying panel: browse, add to cart, place order, bill page (includes admin QR), upload payment screenshot.

Automatic logout after successful payment upload (per-order session rule).

Realtime updates: stock & order notifications (WebSockets).

Atomic multi-item order processing to prevent oversells.

Local file storage for images (vegetable photos & payment screenshots).

Lightweight, self-hosted stack — no paid cloud required.
Tech stack & architecture

Frontend

React (Vite) + TypeScript

Tailwind CSS

React Router, Axios, WebSocket client

Backend

Node JS
Firebase Authentication
Firestore DB
