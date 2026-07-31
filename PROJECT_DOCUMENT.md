# Sales CRM — Project Document

**Version:** Current codebase (as of July 2026)  
**Product:** Sales CRM — lead/call management platform for B2B and B2C sales teams  
**Stack:** React 18 + Tailwind CSS (frontend) · Flask + MySQL (backend)

---

## 1. Overview

Sales CRM is a role-based sales operations platform. Teams upload lead lists (CSV/Excel), assign them to sales executives, work leads through a multi-stage call pipeline, record dispositions, and review performance in dashboards and reports.

There are **two user roles**:

| Role | Code value | Typical use |
|------|------------|-------------|
| **Sales Manager** | `sales_manager` | Admin / team lead — full visibility, employee management, assignment, categories |
| **Sales Executive** | `sales_executive` | Agent — works assigned calls, can upload own databases and assign from them |

---

## 2. Architecture

```
┌─────────────────────┐         JWT Bearer          ┌──────────────────────┐
│  React Frontend     │  ─────────────────────────► │  Flask API (port     │
│  (CRA + Tailwind)   │     /api/*                   │  5001)               │
│  proxy → :5001      │ ◄─────────────────────────  │  Flask-MySQLdb       │
└─────────────────────┘                             └──────────┬───────────┘
                                                               │
                                                               ▼
                                                    ┌──────────────────────┐
                                                    │  MySQL DB            │
                                                    │  salescrm_new        │
                                                    └──────────────────────┘
```

| Layer | Technology |
|-------|------------|
| Frontend | React 18, React Router 6, Axios, Tailwind CSS, Recharts, Lucide / React Icons, react-hot-toast |
| Backend | Flask 2.3, Flask-CORS, Flask-MySQLdb, pandas, openpyxl, PyJWT |
| Database | MySQL (`salescrm_new`) |
| Auth | JWT (HS256), ~10 hour expiry; passwords stored as **MD5** hashes |
| File uploads | Saved under `backend/uploads/` |

**Note:** `PyJWT` is imported in `app.py` but is **not listed** in `requirements.txt` — install it separately (`pip install PyJWT`) if needed.

**Default ports**

- Backend: `http://localhost:5001`
- Frontend: `http://localhost:3000` (CRA; `package.json` proxies API to `:5001`)

---

## 3. How the System Works (End-to-End)

### 3.1 High-level flow

```
1. Login (email + password)
        ↓
2. Upload lead file (B2B corporate / B2C institution)  →  creates `databases` + many `calls` (status = fresh, unassigned)
        ↓
3. Assign calls to sales executives (equal round-robin distribution)
        ↓
4. Executive works Fresh Calls → sets disposition
        ↓
5. Lead moves through pipeline stages (follow_up → demo → proposal → negotiation → closure)
        ↓
6. History logged in `call_history`; managers monitor via Calls / Dashboard / Reports
```

### 3.2 Lead upload & call creation

1. User opens **Databases** and uploads a CSV or Excel file.
2. Chooses:
   - **Type:** `corporate` (B2B) or `institution` (B2C)
   - **Name**, optional **description**, optional **category**
3. Backend saves the file, inserts a row in `databases`, then parses each spreadsheet row into a `calls` record with status `fresh` and `assigned_to = NULL`.

**Required Excel/CSV columns**

| Type | DB type value | Call `type` | Required columns |
|------|---------------|-------------|------------------|
| B2B Corporate | `corporate` | `B2B` | Company Name, Contact Person, Phone Number, Email, Designation |
| B2C Institution | `institution` | `B2C` | Client Name, Phone Number, Email, Department, Company Name, City |

Column names are normalized (trim + lowercase) before validation. Sample files exist in `frontend/build/sample-b2b.xlsx` and `sample-b2c.xlsx`.

### 3.3 Call assignment

- Endpoint: `POST /api/calls/assign` with `{ call_ids: [...], user_ids: [...] }`
- Calls are **distributed equally** (round-robin) across selected employees.
- **Sales Manager:** can assign any calls.
- **Sales Executive:** can assign only calls from databases **they uploaded**.

### 3.4 Sales pipeline (call statuses)

A call has one status at a time:

| Status | Meaning |
|--------|---------|
| `fresh` | Newly created / newly assigned; not yet progressed |
| `follow_up` | Lead showed interest; follow-up scheduled |
| `demo` | Demo stage (mainly B2B path) |
| `proposal` | Proposal stage |
| `negotiation` | Negotiation stage |
| `closure` | Closed — Joined/Converted, Not Interested, or auto-closed after failed connect attempts |
| `converted` | Endpoint exists (`GET /api/calls/converted`), but disposition logic currently sends **Joined / Converted** to **`closure`**, not `converted` — so this bucket may stay empty |

**UI tabs in Call Management:** Fresh → Follow Up → Demo → Proposal → Negotiation → Closure.

### 3.5 Disposition rules (business logic)

Updating disposition: `POST /api/calls/<id>/disposition`.

Each update also writes a row to `call_history`.

#### Stage transitions

| Current status | Disposition | New status |
|----------------|-------------|------------|
| `fresh` | Interested | `follow_up` |
| `fresh` | Joined / Converted **or** Not Interested | `closure` |
| `follow_up` | Interested for Demo | `demo` |
| `follow_up` | Joined / Converted **or** Not Interested | `closure` |
| `demo` | Interested for Proposal | `proposal` |
| `demo` | Joined / Converted **or** Not Interested | `closure` |
| `proposal` | Interested for Negotiation | `negotiation` |
| `proposal` | Joined / Converted **or** Not Interested | `closure` |
| `negotiation` | Joined / Converted **or** Not Interested | `closure` |
| `closure` | *(any)* | **No update allowed** |

#### Ringing / not-connected dispositions

These count as a shared **`ringing_group`** per call (max **6 attempts**):

- Ringing Number But No Response  
- SwitchOff  
- Number Not in Use  
- Line Busy  

After **6** ringing-group attempts at a stage, the call is moved to `closure` with disposition **Not Interested**. Remaining attempts are shown in the UI via `GET /api/calls/<id>/disposition-count`.

#### Date fields

Depending on disposition/stage, users can set:

- `follow_up_date`
- `demo_date`
- `proposal_date`
- `negotiation_date`

`called_date` is set to `NOW()` on each disposition update.

---

## 4. Roles & Access Control

### 4.1 Authentication

1. `POST /api/login` with email + password (MD5 compared to DB).
2. On success: JWT issued; `online_status` set to `online`.
3. Frontend stores `token` + `user` in `localStorage` and sends `Authorization: Bearer <token>` on API calls.
4. Protected APIs use `@jwt_required`.
5. Logout clears token client-side. Backend `POST /api/logout` is **not** `@jwt_required`, so `online_status` may not reliably flip to `offline`.
6. `GET /api/check-auth` revalidates session user data.

**Password reset**

- `POST /api/forgot-password` — generates 6-digit OTP, emails it, stores in `password_reset_otps`
- `POST /api/reset-password` — validates OTP (10 minutes), sets new MD5 password

### 4.2 Frontend route protection

| Route | Who can access |
|-------|----------------|
| `/login`, `/forgot-password` | Public |
| `/dashboard` | Any authenticated user |
| `/calls` | Any authenticated user |
| `/databases` | Any authenticated user |
| `/employees` | Any authenticated user (list visibility differs by role) |
| `/employees/add` | **sales_manager only** |
| `/employees/edit/:id` | **sales_manager only** |
| `/reports` | Any authenticated user (data scoped by role) |
| `/category` | Route is JWT-only (not role-gated); **nav link** is manager-only — executives can still open `/category` by URL |

Unauthorized role on a restricted page → redirect to `/dashboard`.

### 4.3 Permission matrix

| Capability | Sales Manager | Sales Executive |
|------------|---------------|-----------------|
| View all databases | Yes | Only DBs they uploaded **or** that have calls assigned to them |
| Upload database | Yes | Yes |
| Delete database | Yes (any) | Only if they uploaded it |
| View all calls in a database | Yes | Only calls assigned to them |
| Assign calls | Yes (any) | Only from DBs they uploaded |
| View team call lists (`?all=1`) | Yes | No — only own assigned calls |
| Filter Calls by executive | Yes | No |
| Add / edit / soft-delete employees | Yes | No |
| View employee list | All managers + executives | Executives only (filtered in UI) |
| Category nav + manage categories | Yes (nav); API has no role check | No Category link (URL still reachable) |
| Call reports | All calls (filterable) | Own assigned calls only |
| Performance report | Team-level query | Same endpoint (not role-filtered in backend) |
| Update dispositions | JWT only — **no assignee ownership check** on API | Same |
| Dashboard stats | Team-wide (`?all=1`) | Own calls / accessible DBs |

---

## 5. Modules (Screens)

### 5.1 Login & Forgot Password

- Email/password login  
- Forgot password → OTP email → reset password  

### 5.2 Dashboard

- Role-aware stats: employees (manager), databases, fresh / follow-up / demo / proposal / negotiation / closure counts  
- Interest / Joined / Not Interested summaries  
- Charts (Recharts)  
- Quick links to Calls, Databases, Reports, Employees  

### 5.3 Call Management (`/calls`)

- Tabs by pipeline stage  
- Search across name, phone, email, company, etc.  
- Manager: filter by sales executive  
- Disposition modal with stage-specific options and date pickers  
- Closure calls are view-only (no disposition update)  

### 5.4 Database Management (`/databases`)

- List uploaded databases  
- Upload CSV/Excel (B2B/B2C) with category  
- View calls inside a database  
- Select calls and assign to executives  
- Delete database (and related calls) per permission rules  

### 5.5 Employee Management (`/employees`)

- List active sales managers and executives  
- Manager: Add, Edit, soft-delete (`active = inactive`)  
- Fields include empid, name, DOB, phone, DOJ, email, password, user_type, user_role, department, address, salary, status, online_status  

### 5.6 Reports (`/reports`)

- **Call reports** with filters: database name, sales agent, date range, status  
- CSV export from the UI  
- Manager can filter by sales executive; executives see their own call data  
- Performance / communication report **tabs exist in code but are commented out** in the UI; `GET /api/reports/performance` exists; `/api/reports/communication` (mentioned in older README) is **not implemented**

### 5.7 Category (`/category`) — Manager UI

- CRUD for lead/database categories used when uploading databases  
- Nav-gated for managers only; backend category APIs have no role check  

### 5.8 Communication (API present)

- `POST /api/communications/whatsapp` and `/email` log messages to `communications`  
- Actual WhatsApp/email provider integration is stubbed (logged in DB only)  
- Call cards also use `tel:`, `mailto:`, and WhatsApp deep links from the UI  

---

## 6. Database Schema

Tables are created/ensured on backend startup (`create_tables`, `create_password_reset_table`).

### 6.1 `employee` (pre-existing core table)

Key fields used by the app:

- `id`, `empid`, `full_name`, `dob`, `phone_number`, `doj`, `email`, `password`  
- `user_type`, `user_role` (`sales_manager` | `sales_executive`)  
- `department`, `profile_picture`, `address`, `salary`, `status`, `active`  
- `Company_id`, `online_status` (`online` | `offline`)  
- `created_date`  

### 6.2 `databases`

| Column | Notes |
|--------|--------|
| id | PK |
| name | Display name |
| type | `corporate` \| `institution` |
| file_path | Path under uploads |
| description | Optional |
| category | Used with Category module |
| uploaded_by | FK → employee.id |
| created_date | Timestamp |

### 6.3 `calls`

| Column | Notes |
|--------|--------|
| id, call_id | Internal + unique business id |
| type | `B2B` / `B2C` |
| client_name, company_name, contact_person, designation | B2B/B2C fields (usage depends on type) |
| phone_number, email, department, city, institution_name | Contact / org fields |
| database_id | Source upload |
| assigned_to | employee.id or NULL |
| status | Pipeline stage (see §3.4) |
| disposition, notes | Latest outcome |
| called_date, follow_up_date, demo_date, proposal_date, negotiation_date | Dates |
| created_date | Created at upload |

### 6.4 Other tables

| Table | Purpose |
|-------|---------|
| `call_history` | Every disposition change (call_id, user_id, disposition, notes, duration, created_date) |
| `disposition_counts` | Tracks ringing-group attempt counts per call |
| `communications` | WhatsApp / email / call logs |
| `templates` | Message templates (schema present) |
| `category` | Category master for uploads |
| `files` | Legacy/simple files table |
| `password_reset_otps` | OTP for password reset |

---

## 7. API Reference

All endpoints below (except login / forgot / reset) require:

```http
Authorization: Bearer <jwt>
```

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/login` | Login; returns user + token |
| POST | `/api/logout` | Mark offline |
| GET | `/api/check-auth` | Validate token / refresh user |
| POST | `/api/forgot-password` | Send OTP |
| POST | `/api/reset-password` | Reset with OTP |

### Databases & assignment

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/databases` | List databases (role-scoped) |
| POST | `/api/databases` | Upload file + create calls |
| GET | `/api/databases/<id>/calls` | Calls in a database |
| DELETE | `/api/databases/<id>` | Delete DB + related calls |
| POST | `/api/calls/assign` | Assign calls to users |

### Calls by stage

| Method | Path | Query notes |
|--------|------|-------------|
| GET | `/api/calls/fresh` | Manager: `?all=1`, optional `assigned_to=` |
| GET | `/api/calls/follow-up` | Same |
| GET | `/api/calls/demo` | Same |
| GET | `/api/calls/proposal` | Same |
| GET | `/api/calls/negotiation` | Same |
| GET | `/api/calls/closure` | Same |
| GET | `/api/calls/converted` | Same |
| POST | `/api/calls/<id>/disposition` | Update disposition / stage |
| GET | `/api/calls/<id>/disposition-count` | Ringing attempt counts |

### Communication & reports

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/communications/whatsapp` | Log WhatsApp message |
| POST | `/api/communications/email` | Log email |
| GET | `/api/reports/calls` | Filtered call report |
| GET | `/api/reports/performance` | Agent performance |

### Employees & categories

| Method | Path | Access |
|--------|------|--------|
| GET | `/api/employees` | Authenticated |
| POST | `/api/employees` | Manager only |
| PUT | `/api/employees/<id>` | Manager only |
| DELETE | `/api/employees/<id>` | Manager only (soft delete) |
| GET/POST | `/api/category` | JWT |
| PUT/DELETE | `/api/category/<id>` | JWT |

---

## 8. Frontend Structure

```
frontend/src/
  api/axios.js              # Axios instance + auth header interceptor
  contexts/AuthContext.js   # Login, logout, token, checkAuth
  components/
    Login.js
    ForgotPassword.js
    Navbar.js               # Role-aware nav (Category for managers)
    Dashboard.js
    CallManagement.js
    DatabaseManagement.js
    EmployeeList.js
    AddEmployee.js / EditEmployee.js
    Reports.js
    Category.js
  App.js                    # Routes + ProtectedRoute
```

API base: relative `/api/...` via CRA proxy to `http://localhost:5001`.

---

## 9. Setup & Configuration

### Prerequisites

- Python 3.8+
- Node.js 16+
- MySQL Server

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Configured in `backend/app.py` (update for your environment):

| Setting | Current default |
|---------|-----------------|
| MYSQL_HOST | localhost |
| MYSQL_USER | root |
| MYSQL_PASSWORD | *(set in app.py)* |
| MYSQL_DB | salescrm_new |
| Port | 5001 |
| JWT expiry | 36000 seconds (~10 hours) |

Tables are auto-created on startup. The `employee` table is expected to already exist (or be created separately) with seed users.

### Frontend

```bash
cd frontend
npm install
npm start
```

### Demo credentials (from README)

| Role | Email | Password |
|------|-------|----------|
| Sales Manager | sabariraj@mineit.tech | sabari@123 |
| Sales Executive | divya@mineit.tech | sabari@123 |

*(Confirm these still exist in your local DB.)*

---

## 10. Typical Usage by Role

### Sales Manager

1. Log in → Dashboard shows team-wide metrics.  
2. **Category** — maintain upload categories.  
3. **Databases** — upload lead files, open a DB, select unassigned calls, assign to executives.  
4. **Employees** — add/edit sales executives and managers.  
5. **Calls** — monitor all stages; filter by agent.  
6. **Reports** — call + performance analytics, export CSV.  

### Sales Executive

1. Log in → Dashboard shows **own** call stats.  
2. **Calls** — work Fresh → Follow Up → Demo → … → Closure; set dispositions and schedule dates.  
3. Optionally **upload** own databases and assign those leads to self/others (if permitted by uploader rule).  
4. **Reports** — view own call activity.  
5. Cannot add/edit employees or open Category from the nav.  

---

## 11. Notable Business Rules

1. **Equal assignment** — selected calls are split round-robin across selected user IDs.  
2. **6 ringing attempts** — then auto-close as Not Interested.  
3. **Closure is final** — disposition cannot be changed again.  
4. **“Joined / Converted” → `closure`** — disposition does not set `status='converted'`; the converted list endpoint may remain empty.  
5. **Soft delete employees** — `active = inactive`; they disappear from the active list. Only `active='active'` users can log in.  
6. **Deleting a database** also deletes all related calls and removes the uploaded file if present.  
7. **B2B vs B2C** — different spreadsheet schemas and fields; demo/proposal/negotiation date pickers are emphasized on B2B.  
8. **Performance “connected_calls”** counts statuses `closure` + `converted` (outcome-based, not “phone connected”).  
9. **Online status** — set online on login / check-auth; offline on logout is unreliable (see §4.1).  

---

## 12. Security Notes

- Passwords use **MD5** (legacy; not recommended for new systems — prefer bcrypt/argon2).  
- JWT secret, Flask secret key, MySQL password, and SMTP credentials are hardcoded in `app.py` — move to environment variables for production. README env vars are documented but **not read** by the app.  
- CORS is enabled with credentials support.  
- Role checks exist on sensitive write APIs (employees, assignment, delete DB); category mutations and disposition updates rely mainly on JWT (+ UI hiding for Category).  
- Disposition API does not verify that the call is assigned to the current user.  

---

## 13. Project Layout

```
new_salescrm/
├── backend/
│   ├── app.py              # Main Flask application (APIs + schema bootstrap)
│   ├── requirements.txt
│   ├── uploads/            # Uploaded CSV/Excel files
│   └── build/              # Optional served React build (static)
├── frontend/
│   ├── package.json
│   ├── src/                # React source
│   └── build/              # Production build artifacts
├── README.md               # Older overview (partially outdated vs pipeline)
└── PROJECT_DOCUMENT.md     # This document
```

---

## 14. Glossary

| Term | Meaning |
|------|---------|
| Database (in this app) | An uploaded lead list file + metadata, not a MySQL database |
| Fresh call | Lead not yet progressed past initial outreach stage |
| Disposition | Outcome selected after contacting a lead |
| Sales Manager | Admin role with full operational control |
| Sales Executive | Agent role working assigned leads |
| B2B / corporate | Company contacts (contact person, designation) |
| B2C / institution | Individual/client contacts (client name, department, city) |

---

*Document generated from the current Sales CRM codebase (`backend/app.py` and `frontend/src`).*
