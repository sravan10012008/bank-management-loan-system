PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS USERS (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS LOAN_APPLICATIONS (
    application_id INTEGER PRIMARY KEY AUTOINCREMENT,
    applicant_name TEXT NOT NULL CHECK (length(trim(applicant_name)) BETWEEN 2 AND 100),
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

CREATE INDEX IF NOT EXISTS idx_loan_user_created
ON LOAN_APPLICATIONS(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loan_user_status
ON LOAN_APPLICATIONS(user_id, eligibility_status);
