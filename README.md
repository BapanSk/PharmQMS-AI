# PharmQMS

Pharmaceutical Quality Management System for complaint intake, AI-assisted triage, QA investigation, and CAPA tracking.

The application is a Node.js + Express API with a vanilla HTML/CSS/JS frontend and MySQL (or MariaDB) storage.

## Features

- Public complaint submission and status tracking
- Staff login with JWT authentication and role-based access
- Complaint list, filters, assignment, comments, and status workflow
- AI analysis with a rule-based fallback when the AI service is unavailable
- QA Accept / Edit / Reject of AI recommendations
- Investigation records, CAPA notes, attachments, and audit history
- Admin panel for users, products, and audit logs
- Dashboard analytics with 7 / 30 / 90 day and year ranges

## Architecture

```
Customer  ->  /submit, /track
Staff     ->  /login, /dashboard, /complaints, /complaint-details
Admin     ->  /admin

Frontend (public/)  ->  Express static + page routes
API (/api/*)        ->  Controllers, services, MySQL
AI calls            ->  Backend only (never exposed to the browser)
```

AI recommendations are advisory. They are not applied to the complaint until a QA user Accepts or Edits them.

## Requirements

- Node.js 18+
- MySQL 8 or MariaDB 10.11+

## Install

```bash
npm install
```

## MySQL setup

```bash
mysql -u root < database/schema.sql
mysql -u root pharmqms < database/seed.sql
```

If your MySQL root user requires a password:

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p pharmqms < database/seed.sql
```

If Node cannot connect as `root` over TCP, create an application user and put those credentials in `.env`:

```bash
mysql -u root -e "CREATE USER 'pharmqms'@'localhost' IDENTIFIED BY 'choose-a-password'; GRANT ALL PRIVILEGES ON pharmqms.* TO 'pharmqms'@'localhost'; FLUSH PRIVILEGES;"
```

## Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=pharmqms
SESSION_SECRET=replace-with-a-long-random-string
AI_API_KEY=
AI_API_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
CORS_ORIGIN=
JWT_EXPIRES_IN=8h
```

`SESSION_SECRET` is required. Do not commit `.env`.

Leave `AI_API_KEY` empty to use the rule-based fallback analyzer. The key is used only on the server.

## Start server

```bash
npm start
```

Development watch mode:

```bash
npm run dev
```

The API and website bind to `http://0.0.0.0:3000`.

Health check: `GET /api/health`

## Demo credentials

Password for all demo users: `PharmQMS2026!`

| Role | Email | Password |
| --- | --- | --- |
| ADMIN | admin@pharmqms.com | PharmQMS2026! |
| QA_MANAGER | manager@pharmqms.com | PharmQMS2026! |
| QA_ANALYST | qa@pharmqms.com | PharmQMS2026! |

Passwords are stored as bcrypt hashes only.

## Authentication

Login returns a JWT and also sets an HTTP-only cookie named `pharmqms_token`.

Send the token as:

```
Authorization: Bearer <token>
```

or rely on the cookie for same-origin clients.

## Roles

- **ADMIN**: full access, including users, products, and audit logs
- **QA_MANAGER**: manage all complaints, investigations, assignments, and reopen closed cases
- **QA_ANALYST**: view and update only complaints assigned to them

Unauthenticated requests receive HTTP 401.
Unauthorized requests receive HTTP 403.

## Complaint workflow

```
New -> AI Analyzed -> QA Review -> Under Investigation -> Corrective Action -> Resolved -> Closed
```

- Closed records are read-only
- ADMIN and QA_MANAGER can reopen a closed complaint to QA Review or Under Investigation
- Public intake creates a New complaint, then the server runs analysis automatically

## AI analysis

1. The server calls an OpenAI-compatible chat completions API when `AI_API_KEY` is set
2. If the key is missing, the request fails, or the 12 second timeout is reached, a rule-based analyzer is used
3. Results are stored in `complaint_ai_analysis`
4. The UI labels AI output as `AI Generated — Requires QA Review`
5. Fallback output is labeled `Rule-based analysis — AI service unavailable`
6. QA must Accept, Edit, or Reject before suggested category, severity, and priority are applied

## Database design

Tables in `database/schema.sql`:

- `users`
- `products`
- `complaints`
- `complaint_ai_analysis`
- `complaint_investigations`
- `complaint_comments`
- `complaint_attachments`
- `complaint_status_history`
- `audit_logs`

Complaint IDs use this format:

```
PHQ-2026-000001
```

## API endpoints

### Health and public

- `GET /api/health`
- `GET /api/products`
- `GET /api/track/:complaintId`
- `POST /api/complaints` (public intake allowed)

### Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Complaints (staff)

- `GET /api/complaints`
- `GET /api/complaints/:id`
- `PUT /api/complaints/:id`
- `POST /api/complaints/:id/analyze`
- `POST /api/complaints/:id/analyze/review`
- `GET /api/complaints/:id/investigation`
- `POST /api/complaints/:id/investigation`
- `PUT /api/complaints/:id/investigation`
- `GET /api/complaints/:id/comments`
- `POST /api/complaints/:id/comments`
- `GET /api/complaints/:id/history`
- `POST /api/complaints/:id/attachments`
- `GET /api/complaints/:id/attachments/:attachmentId`

`GET /api/complaints` query parameters:

- `search`
- `status`
- `severity`
- `priority`
- `category`
- `product`
- `date_from`
- `date_to`
- `sort`
- `dir`
- `page`
- `limit`

### Dashboard

- `GET /api/dashboard/stats?range=7d|30d|90d|year`
- `GET /api/dashboard/assignees`

### Admin

- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id` (deactivates the user)
- `GET /api/admin/products?all=1`
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `GET /api/audit-logs`

## Project structure

```
.
├── database/
│   ├── schema.sql
│   └── seed.sql
├── public/
│   ├── css/
│   ├── js/
│   ├── index.html
│   ├── submit.html
│   ├── track.html
│   ├── login.html
│   ├── dashboard.html
│   ├── complaints.html
│   ├── complaint-details.html
│   └── admin.html
├── server/
│   ├── config/db.js
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   └── server.js
├── uploads/complaints/
├── .env.example
├── package.json
└── README.md
```

## Example requests

Login:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pharmqms.com","password":"PharmQMS2026!"}'
```

List complaints:

```bash
curl "http://localhost:3000/api/complaints?status=New&severity=Major" \
  -H "Authorization: Bearer <token>"
```

Create complaint:

```bash
curl -X POST http://localhost:3000/api/complaints \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Aisha Rahman",
    "customer_email": "aisha.rahman@example.com",
    "customer_phone": "+1-555-0107",
    "product_id": 1,
    "batch_number": "NCL-250-A12",
    "manufacturing_date": "2025-11-02",
    "expiry_date": "2027-11-02",
    "category": "Product Quality",
    "description": "Tablets in the bottle were cracked and had an unusual odor.",
    "purchase_location": "Northside Pharmacy",
    "country": "Canada"
  }'
```

## Future

- Email notifications for assignment and status changes
- Exportable regulatory reports
- Batch retain inspection checklists
- Multi-site inventory quarantine
