# SmartApply — MERN Starter

A runnable MERN starter for college administrative requests.

## Workflow
1. Students register and log in.
2. A student submits an application, selecting a department and a faculty member from that department.
3. The selected faculty member reviews it and forwards it to the HOD of the same department.
4. The HOD approves or rejects the forwarded application.
5. Admin can create HOD and Faculty accounts and assign each to a department.

## Default admin
- Email: `admin@gmail.com`
- Password: `admin123`

The backend creates this admin on startup if the email does not already exist. Change this password before deploying publicly.

## Requirements
- Node.js 20+ recommended
- MongoDB Atlas or local MongoDB

## Setup
### 1. Backend
```powershell
cd server
npm install
copy .env.example .env
```
Open `server/.env` and put your existing MongoDB connection string in `MONGO_URI`. Do not commit `.env`.

Then run:
```powershell
npm run dev
```
Expected messages include:
- `MongoDB connected successfully`
- `SmartApply API listening on 5000`

### 2. Frontend
Open a second terminal:
```powershell
cd client
npm install
npm run dev
```
Open the URL Vite prints, usually `http://localhost:5173`.

## Department names
Starter defaults: CSE, ECE, EEE, MECH, CIVIL, IT, ATML. Edit `server/src/config.js` and the frontend department list if needed.

## Important
- Admin creates HOD/Faculty accounts from the Admin panel.
- Students create their own accounts using Student Registration.
- Faculty and HOD are restricted to their assigned department.
- This is a starter project. Before production, add password reset, rate limiting, email verification, audit logs, and stronger deployment secrets.
