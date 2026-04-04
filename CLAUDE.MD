# PROJECT: Internal Accounting Software (Full Build Plan)

## ROLE

You are a senior software architect, backend engineer, and product manager.

Your mission is to:
- Plan
- Design
- Generate code

for a **practical internal accounting system** for a small business.

The system must be:
- simple
- efficient
- production-ready
- optimized for real-world usage (not over-engineered)

---

## CONTEXT

Target:
- Small business (services + products)

Core needs:
- cash flow tracking
- debt management
- invoicing
- inventory
- reporting

Deployment target:
- Raspberry Pi 5 (local server)
- Web-based system
- Future: Windows desktop app (via Tauri)

---

## DEVELOPMENT STRATEGY

Follow this EXACT order:

```

Database → Backend API → Business Logic → Frontend → Deployment → Optimization

```

DO NOT skip steps.

---

## PHASE BREAKDOWN

### PHASE 0 – Scope Definition

Build ONLY MVP features:

- Cashflow (income/expense)
- Customers
- Invoices
- Debt tracking
- Inventory (basic)
- Reports (basic)

DO NOT include:
- complex UI
- unnecessary enterprise features

---

### PHASE 1 – Project Setup

Stack:
- Node.js (TypeScript)
- Express.js
- Prisma ORM
- SQLite (default)
- React (Vite)

Tasks:
- Initialize backend project
- Initialize frontend project
- Setup Prisma

---

### PHASE 2 – Database Design

Design full Prisma schema with:

Tables:
- users
- customers
- suppliers
- products
- invoices
- invoice_items
- payments
- cashflow
- inventory_logs

Requirements:
- include relations
- include timestamps
- keep schema simple and efficient

---

### PHASE 3 – Backend API

Structure:

```

src/
modules/
cashflow/
invoice/
customer/
inventory/
payment/
report/

```

Each module must include:
- controller
- service
- route

---

### REQUIRED APIs

Cashflow:
- POST /cashflow
- GET /cashflow

Customer:
- POST /customer
- GET /customer

Invoice:
- POST /invoice
- GET /invoice

Payment:
- POST /payment

Report:
- GET /report/cashflow
- GET /report/profit-loss

---

### PHASE 4 – Business Logic (CRITICAL)

Implement automatic logic:

1. When invoice is created:
- reduce inventory stock
- increase customer debt
- record revenue

2. When payment is made:
- reduce debt
- update invoice status
- create cashflow entry

3. When purchase is created:
- increase stock
- increase supplier debt

---

### PHASE 5 – Frontend (Basic UI)

Create simple UI with:

Pages:
- Dashboard
- Invoice creation
- Cashflow
- Customer list
- Reports

Requirements:
- simple forms
- tables
- no complex design

---

### PHASE 6 – Deployment (Raspberry Pi 5)

Requirements:
- must run locally
- accessible via LAN (IP address)

Tasks:
- build backend
- run with PM2
- ensure auto-start

---

### PHASE 7 – Testing

Test full flows:

- purchase → stock increase
- invoice → stock decrease
- payment → debt decrease
- reports → correct values

---

### PHASE 8 – Windows App (Optional)

Wrap web app using:
- Tauri (preferred)

Goal:
- generate .exe desktop app

---

### PHASE 9 – Backup & Optimization

Requirements:
- daily database backup
- support SQLite → PostgreSQL upgrade
- ensure data safety

---

## BUSINESS LOGIC RULES

System must behave like:

Invoice created:
→ reduce stock
→ increase receivable

Payment received:
→ reduce receivable
→ increase cash

Purchase created:
→ increase stock
→ increase payable

---

## OUTPUT INSTRUCTIONS

You MUST respond in structured steps:

### STEP 1 – Project Structure

### STEP 2 – Prisma Schema

### STEP 3 – Backend Code

### STEP 4 – Business Logic Implementation

### STEP 5 – Frontend Suggestion

### STEP 6 – Deployment Guide

---

## CODE RULES

- Use TypeScript
- Use async/await
- Keep code clean and readable
- Do not overcomplicate
- Focus on working system

---

## CONSTRAINTS

- Avoid unnecessary complexity
- Avoid enterprise-level over-design
- Prioritize working MVP

---

## FINAL GOAL

Deliver a system that:
- runs locally on Raspberry Pi 5
- supports multiple users via LAN
- can be extended to desktop app
- is simple but powerful enough for real business usage

---

## EXECUTION

Start with:

"Generate STEP 1 – Project Structure"

Then continue step by step.
```

---

# 🔥 Cách dùng chuẩn (rất quan trọng)

Bạn dùng kiểu này để ép Claude làm đúng:

### 👉 Bắt đầu

```
Read CLAUDE.md and generate STEP 1
```

### 👉 Sau đó

```
Continue STEP 2
Continue STEP 3 (cashflow module)
Continue STEP 3 (invoice module)
```

---

# ⚡ Tip cho bạn (rất đáng giá)

👉 Đừng để nó generate 1 lần toàn bộ
→ sẽ lỗi / thiếu / khó debug

👉 Luôn:

* chia nhỏ step
* test từng phần

