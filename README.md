# Bank Management and Loan Eligibility System

A beginner-friendly DBMS PAT 4 project built with HTML, CSS, vanilla JavaScript, Node.js, Express, and SQLite. It runs locally on Windows and does not need a cloud account or a separate database server.

## Features

- Real login with bcrypt-hashed passwords and session-based authentication.
- SQLite database created automatically by the initialization command.
- Dashboard counts calculated using SQL queries.
- Server-side loan eligibility assessment and validation.
- Create, view, filter, update, and delete applications.
- Each application belongs to the logged-in user. API queries check both the application ID and the session user's ID.
- Parameterized SQL queries for data values.
- Responsive blue-and-white banking interface.

## 1. Requirements

- Windows 10 or Windows 11.
- Node.js 18.17 or later (Node.js 20 LTS is a good choice).
- npm, included with Node.js.
- A modern browser such as Chrome or Edge.

No MySQL server, Oracle server, or internet connection is needed while using the application after dependencies are installed.

### Install Node.js and npm

1. Open the official Node.js website: https://nodejs.org/
2. Download the LTS Windows installer (`.msi`).
3. Run it and keep the option to install npm enabled.
4. Close and reopen Command Prompt.
5. Check installation:

```bat
node --version
npm --version
```

Node should report version 18.17 or newer.

## 2. Project files

```text
bank-management-loan-system/
├── data/                       # Created by npm run init-db
│   └── bank_management.sqlite  # Persistent SQLite database
├── public/
│   ├── index.html              # Login
│   ├── dashboard.html
│   ├── application.html        # Create/update and assessment form
│   ├── history.html
│   ├── styles.css
│   ├── login.js
│   └── app.js
├── schema.sql                  # Database DDL
├── sample_data.sql             # Optional commented sample INSERT
├── init-db.js                  # Database setup and demo-user creation
├── server.js                   # Express backend and API
├── package.json
├── .gitignore
└── README.md
```

## 3. Install and run on Windows

1. Extract the project ZIP file to a folder, for example `C:\College\bank-management-loan-system`.
2. Open Command Prompt.
3. Move into the project directory. Use your actual folder path:

```bat
cd /d C:\College\bank-management-loan-system
```

4. Install dependencies (internet is needed for this one-time step):

```bat
npm install
```

5. Initialize the database and demo login:

```bat
npm run init-db
```

6. Start the backend:

```bat
npm start
```

7. Keep that Command Prompt window open. Open this URL in Chrome or Edge:

**http://localhost:3000**

### Demo credentials

- Username: `admin`
- Password: `Bank@123`

The initialization script creates the demo account only if that username does not already exist. Passwords are stored as bcrypt hashes, not plain text. The demo password is for local college demonstration only.

To use different credentials when creating the demo user for the first time, set `DEMO_USERNAME` and `DEMO_PASSWORD` in the environment before running `npm run init-db`. For a classroom demo, use the documented credentials above.

## 4. Loan calculation used in this project

These are **illustrative college-project rules only**, not an actual bank's lending policy and not a loan offer.

1. Applicant must be at least 21 years old.
2. Monthly disposable income = monthly income − monthly expenses − existing monthly loan payments.
3. Monthly disposable income must be greater than zero.
4. If both eligibility conditions pass, maximum eligible loan amount is:

   `min(24 × monthly disposable income, 5 × annual income)`

   For this project, annual income is calculated as monthly income × 12.
5. If either eligibility condition fails, the maximum eligible loan amount is zero.

Employment type, average monthly balance, and turnover are saved and shown as additional information only. They are not independently verified and do not change the eligibility decision.

Example: monthly income ₹60,000, expenses ₹25,000, and existing loan payments ₹5,000 give disposable income ₹30,000. Annual income is ₹7,20,000. The two limits are ₹7,20,000 and ₹36,00,000, so the maximum illustrative amount is ₹7,20,000, provided the applicant is at least 21.

## 5. Database tables and SQL

The application uses `better-sqlite3`, a Node.js SQLite driver. SQLite stores its data in the local file `data/bank_management.sqlite`; a separate database server is not required.

### USERS

`schema.sql` creates:

- `user_id`: integer primary key, auto-incremented.
- `username`: required, unique, case-insensitive text.
- `password_hash`: required text containing a bcrypt hash.
- `created_at`: timestamp created by SQLite.

### LOAN_APPLICATIONS

The table contains:

- `application_id`: integer primary key.
- Applicant name and age.
- Current and average monthly bank balance.
- Monthly income, expenses, turnover, and yearly turnover.
- Employment type.
- Existing monthly loan payments.
- Calculated disposable income.
- Eligibility status and maximum eligible amount.
- Assessment explanation.
- `user_id`: required foreign key to `USERS`.
- Created and updated timestamps.

SQLite `CHECK` constraints reject invalid ages, negative monetary inputs, invalid employment types, and invalid eligibility statuses. A foreign key connects applications to their owners.

### DDL: CREATE TABLE and indexes

The actual DDL is in `schema.sql`. The main statements are:

```sql
CREATE TABLE IF NOT EXISTS USERS (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS LOAN_APPLICATIONS (
    application_id INTEGER PRIMARY KEY AUTOINCREMENT,
    applicant_name TEXT NOT NULL,
    age INTEGER NOT NULL CHECK (age BETWEEN 18 AND 100),
    current_bank_balance REAL NOT NULL CHECK (current_bank_balance >= 0),
    average_monthly_balance REAL NOT NULL CHECK (average_monthly_balance >= 0),
    monthly_income REAL NOT NULL CHECK (monthly_income >= 0),
    monthly_expenses REAL NOT NULL CHECK (monthly_expenses >= 0),
    monthly_turnover REAL NOT NULL CHECK (monthly_turnover >= 0),
    yearly_turnover REAL NOT NULL CHECK (yearly_turnover >= 0),
    employment_type TEXT NOT NULL CHECK (employment_type IN ('Salaried', 'Self-employed')),
    existing_monthly_loan_payments REAL NOT NULL CHECK (existing_monthly_loan_payments >= 0),
    disposable_income REAL NOT NULL,
    eligibility_status TEXT NOT NULL CHECK (eligibility_status IN ('Eligible', 'Not Eligible')),
    max_eligible_loan_amount REAL NOT NULL CHECK (max_eligible_loan_amount >= 0),
    assessment_explanation TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES USERS(user_id) ON DELETE CASCADE
);
```

The full schema also creates indexes for user-specific history and status filters. Run the complete `schema.sql` through `npm run init-db`; this is the supported setup path. `CREATE TABLE IF NOT EXISTS` lets initialization run again without deleting existing records.

### DML used by the application

- **INSERT:** `init-db.js` inserts the demo user using a parameterized statement. `server.js` inserts a new loan application with a prepared `INSERT INTO LOAN_APPLICATIONS` statement.
- **SELECT:** login checks `USERS`; dashboard statistics use `COUNT` and conditional `SUM`; history uses `SELECT` filtered by `user_id` and optionally `eligibility_status`.
- **UPDATE:** editing an application updates all input fields and recalculated result fields, plus `updated_at`.
- **DELETE:** deletes by both `application_id` and `user_id`, so one user cannot delete another user's record.

The code uses `?` placeholders or named placeholders and passes values separately. It does not concatenate user input into SQL statements.

### Optional sample DML

`sample_data.sql` contains a commented example `INSERT`. It is optional and is not executed automatically. The app creates real application rows when you submit the form; no mock rows are required.

## 6. How to test the application

1. **Login:** open `http://localhost:3000`, enter the demo credentials, and sign in.
2. **Dashboard:** check the total, eligible, and not-eligible counts. They start at zero for a new database.
3. **Create an eligible record:** enter a name, age 25 or above, monthly income `60000`, expenses `25000`, existing payments `5000`, and non-negative values for the other fields. Choose an employment type and submit. The server calculates the result and saves the application.
4. **Create a not-eligible record:** use age `20`, or use an age of 21 or more with expenses plus existing payments greater than or equal to income. The maximum amount should be ₹0.
5. **History:** open Application History. Confirm the saved records appear.
6. **Filter:** select Eligible or Not eligible in the Status filter.
7. **Update:** click Edit, change an input, and submit. The server recalculates the eligibility fields and updates the database.
8. **Delete:** click Delete and confirm. The row should disappear.
9. **Authentication:** log out and try opening `/api/dashboard` in a new logged-out browser session. It should return HTTP 401. The dashboard pages redirect to login.
10. **Persistence:** stop the server with Ctrl+C, start it again with `npm start`, and sign in. Saved rows remain in `data/bank_management.sqlite`.

## 7. Database connectivity explanation for a viva

1. The browser sends form data to Express using `fetch()` and JSON.
2. Express validates all fields again on the server; browser validation alone is not trusted.
3. `better-sqlite3` opens the SQLite database file.
4. Prepared statements execute `INSERT`, `SELECT`, `UPDATE`, and `DELETE` queries.
5. The backend calculates eligibility and stores the calculated values together with the input fields.
6. The backend returns JSON to the frontend, which displays the result.
7. `express-session` tracks the authenticated user using an HTTP-only session cookie. Every protected API route checks the session, and application SQL queries are scoped to that user's ID.
8. `bcryptjs` verifies the submitted password against the stored hash.

## 8. Common errors and fixes

### `node` or `npm` is not recognized

Install Node.js LTS, ensure the installer adds it to PATH, then close and reopen Command Prompt. Verify with `node --version` and `npm --version`.

### `Cannot find module ...`

Run `npm install` from the project root. Make sure Command Prompt is in the directory containing `package.json`.

### Database not found

Run `npm run init-db` from the project root before `npm start`.

### Port 3000 is already in use

Stop the other server, or use another port:

```bat
set PORT=3001
npm start
```

Then open `http://localhost:3001`.

### `better-sqlite3` installation fails

Use a current Node.js LTS release and run `npm install` again. If a prebuilt binary is unavailable for your setup, install the Windows **Desktop development with C++** workload from Visual Studio Build Tools, reopen Command Prompt, and retry `npm install`.

### Login says invalid username or password

Use `admin` / `Bank@123` with a fresh database. If you previously created the `admin` user with another password, initialization does not reset it. For a disposable practice database only, stop the server, back up any records you need, delete `data\bank_management.sqlite` and its `-shm` / `-wal` files if present, then run `npm run init-db` again. **Deleting this file deletes saved application data.**

### Changes are not visible

Check the terminal for errors and refresh the browser. Confirm you are using the correct localhost port and the same project directory.

## 9. Stop, restart, and move the project

- Stop: focus the server Command Prompt and press **Ctrl+C**.
- Restart: run `npm start` from the project root.
- Saved data: keep `data/bank_management.sqlite`; it stores your users and applications.
- Copy to another computer: copy the whole project folder, including the `data` folder if you want to retain saved data. Install Node.js on the new computer, open Command Prompt in the copied folder, run `npm install`, then `npm start`. If the database file is missing, run `npm run init-db`.
- Do not share a database file containing real personal or financial information. Use fictional details for your college demonstration.

## 10. Notes about security and scope

This is a local educational project, not production banking software. The session secret has a demo fallback for convenient local setup; set a strong `SESSION_SECRET` environment variable before exposing it beyond your own computer. The default in-memory session store is intended for local demos and sessions reset when the server restarts. Do not use real customer information or deploy this project as a real lending service.
