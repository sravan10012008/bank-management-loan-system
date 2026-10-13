const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DB_PATH = path.join(__dirname, 'data', 'bank_management.sqlite');

if (!fs.existsSync(DB_PATH)) {
  console.error('Database not found. Run "npm run init-db" first.');
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(session({
  name: 'bank.sid',
  secret: process.env.SESSION_SECRET || 'replace-this-demo-secret-before-deployment',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 2
  }
}));

// Gate the protected HTML files before static-file middleware can serve them.
app.use((req, res, next) => {
  const protectedPages = ['/dashboard.html', '/application.html', '/history.html'];
  if (protectedPages.includes(req.path) && (!req.session || !req.session.user)) {
    return res.redirect('/index.html');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

function apiError(res, status, message) {
  return res.status(status).json({ error: message });
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return apiError(res, 401, 'Please log in to continue.');
  }
  next();
}

function parseApplication(body) {
  const name = typeof body.applicantName === 'string' ? body.applicantName.trim() : '';
  const employmentType = body.employmentType;
  const numericFields = {
    age: body.age,
    currentBankBalance: body.currentBankBalance,
    averageMonthlyBalance: body.averageMonthlyBalance,
    monthlyIncome: body.monthlyIncome,
    monthlyExpenses: body.monthlyExpenses,
    monthlyTurnover: body.monthlyTurnover,
    yearlyTurnover: body.yearlyTurnover,
    existingMonthlyLoanPayments: body.existingMonthlyLoanPayments
  };

  if (name.length < 2 || name.length > 100) {
    throw new Error('Applicant name must contain 2 to 100 characters.');
  }
  if (!['Salaried', 'Self-employed'].includes(employmentType)) {
    throw new Error('Choose a valid employment type.');
  }

  const values = {};
  for (const [key, raw] of Object.entries(numericFields)) {
    if (raw === '' || raw === null || raw === undefined || typeof raw === 'boolean') {
      throw new Error(`${keyLabel(key)} is required.`);
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`${keyLabel(key)} must be a valid number.`);
    if (key === 'age') {
      if (!Number.isInteger(value) || value < 18 || value > 100) {
        throw new Error('Age must be a whole number between 18 and 100.');
      }
    } else if (value < 0 || value > 1000000000000) {
      throw new Error(`${keyLabel(key)} must be between 0 and 1,000,000,000,000.`);
    }
    values[key] = value;
  }

  return { applicantName: name, employmentType, ...values };
}

function keyLabel(key) {
  const labels = {
    age: 'Age',
    currentBankBalance: 'Current bank balance',
    averageMonthlyBalance: 'Average monthly bank balance',
    monthlyIncome: 'Monthly income',
    monthlyExpenses: 'Monthly expenses',
    monthlyTurnover: 'Monthly turnover',
    yearlyTurnover: 'Yearly turnover',
    existingMonthlyLoanPayments: 'Existing monthly loan payments'
  };
  return labels[key] || key;
}

function assess(input) {
  const disposableIncome = input.monthlyIncome - input.monthlyExpenses - input.existingMonthlyLoanPayments;
  const reasons = [];
  if (input.age < 21) reasons.push('Applicant must be at least 21 years old.');
  if (disposableIncome <= 0) reasons.push('Monthly disposable income must be positive.');
  const eligible = reasons.length === 0;
  const annualIncome = input.monthlyIncome * 12;
  const maxAmount = eligible ? Math.max(0, Math.min(24 * disposableIncome, 5 * annualIncome)) : 0;
  const explanation = eligible
    ? 'Eligible under the illustrative college-project rules: age is at least 21 and monthly disposable income is positive. Employment type, average monthly balance, and turnover are informational inputs only and have not been independently verified.'
    : `${reasons.join(' ')} Maximum eligible loan amount is zero under the illustrative college-project rules. Employment type, average monthly balance, and turnover are informational inputs only and have not been independently verified.`;
  return {
    disposableIncome: roundMoney(disposableIncome),
    eligibilityStatus: eligible ? 'Eligible' : 'Not Eligible',
    maxEligibleLoanAmount: roundMoney(maxAmount),
    assessmentExplanation: explanation,
    reasons
  };
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function dbRecord(row) {
  return {
    applicationId: row.application_id,
    applicantName: row.applicant_name,
    age: row.age,
    currentBankBalance: row.current_bank_balance,
    averageMonthlyBalance: row.average_monthly_balance,
    monthlyIncome: row.monthly_income,
    monthlyExpenses: row.monthly_expenses,
    monthlyTurnover: row.monthly_turnover,
    yearlyTurnover: row.yearly_turnover,
    employmentType: row.employment_type,
    existingMonthlyLoanPayments: row.existing_monthly_loan_payments,
    disposableIncome: row.disposable_income,
    eligibilityStatus: row.eligibility_status,
    maxEligibleLoanAmount: row.max_eligible_loan_amount,
    assessmentExplanation: row.assessment_explanation,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const selectByIdAndUser = db.prepare(
  'SELECT * FROM LOAN_APPLICATIONS WHERE application_id = ? AND user_id = ?'
);
const insertApplication = db.prepare(`
  INSERT INTO LOAN_APPLICATIONS (
    applicant_name, age, current_bank_balance, average_monthly_balance,
    monthly_income, monthly_expenses, monthly_turnover, yearly_turnover,
    employment_type, existing_monthly_loan_payments, disposable_income,
    eligibility_status, max_eligible_loan_amount, assessment_explanation, user_id
  ) VALUES (
    @applicant_name, @age, @current_bank_balance, @average_monthly_balance,
    @monthly_income, @monthly_expenses, @monthly_turnover, @yearly_turnover,
    @employment_type, @existing_monthly_loan_payments, @disposable_income,
    @eligibility_status, @max_eligible_loan_amount, @assessment_explanation, @user_id
  )
`);
const updateApplication = db.prepare(`
  UPDATE LOAN_APPLICATIONS SET
    applicant_name = @applicant_name, age = @age,
    current_bank_balance = @current_bank_balance,
    average_monthly_balance = @average_monthly_balance,
    monthly_income = @monthly_income, monthly_expenses = @monthly_expenses,
    monthly_turnover = @monthly_turnover, yearly_turnover = @yearly_turnover,
    employment_type = @employment_type,
    existing_monthly_loan_payments = @existing_monthly_loan_payments,
    disposable_income = @disposable_income,
    eligibility_status = @eligibility_status,
    max_eligible_loan_amount = @max_eligible_loan_amount,
    assessment_explanation = @assessment_explanation,
    updated_at = datetime('now')
  WHERE application_id = @application_id AND user_id = @user_id
`);

app.get('/api/session', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ authenticated: true, username: req.session.user.username });
  }
  res.json({ authenticated: false });
});

app.post('/api/login', (req, res, next) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!username || !password || username.length > 100 || password.length > 200) {
      return apiError(res, 400, 'Enter a valid username and password.');
    }
    const user = db.prepare('SELECT user_id, username, password_hash FROM USERS WHERE username = ? COLLATE NOCASE').get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return apiError(res, 401, 'Invalid username or password.');
    }
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = { id: user.user_id, username: user.username };
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        res.json({ message: 'Login successful.', username: user.username });
      });
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/logout', (req, res, next) => {
  if (!req.session) return res.json({ message: 'Logged out.' });
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('bank.sid', { httpOnly: true, sameSite: 'lax' });
    res.json({ message: 'Logged out.' });
  });
});

app.get('/api/dashboard', requireAuth, (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const stats = db.prepare(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN eligibility_status = 'Eligible' THEN 1 ELSE 0 END) AS eligible,
        SUM(CASE WHEN eligibility_status = 'Not Eligible' THEN 1 ELSE 0 END) AS rejected
      FROM LOAN_APPLICATIONS WHERE user_id = ?
    `).get(userId);
    res.json({ total: stats.total || 0, eligible: stats.eligible || 0, rejected: stats.rejected || 0 });
  } catch (err) { next(err); }
});

app.post('/api/assess', requireAuth, (req, res) => {
  try {
    const input = parseApplication(req.body);
    res.json({ ...assess(input), input });
  } catch (err) {
    apiError(res, 400, err.message || 'Invalid application data.');
  }
});

app.get('/api/applications', requireAuth, (req, res, next) => {
  try {
    const status = req.query.status || 'All';
    if (!['All', 'Eligible', 'Not Eligible'].includes(status)) {
      return apiError(res, 400, 'Invalid eligibility filter.');
    }
    const userId = req.session.user.id;
    let rows;
    if (status === 'All') {
      rows = db.prepare('SELECT * FROM LOAN_APPLICATIONS WHERE user_id = ? ORDER BY application_id DESC').all(userId);
    } else {
      rows = db.prepare('SELECT * FROM LOAN_APPLICATIONS WHERE user_id = ? AND eligibility_status = ? ORDER BY application_id DESC').all(userId, status);
    }
    res.json(rows.map(dbRecord));
  } catch (err) { next(err); }
});

app.get('/api/applications/:id', requireAuth, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return apiError(res, 400, 'Invalid application ID.');
    const row = selectByIdAndUser.get(id, req.session.user.id);
    if (!row) return apiError(res, 404, 'Application not found.');
    res.json(dbRecord(row));
  } catch (err) { next(err); }
});

function sqlValues(input, result, userId) {
  return {
    applicant_name: input.applicantName,
    age: input.age,
    current_bank_balance: input.currentBankBalance,
    average_monthly_balance: input.averageMonthlyBalance,
    monthly_income: input.monthlyIncome,
    monthly_expenses: input.monthlyExpenses,
    monthly_turnover: input.monthlyTurnover,
    yearly_turnover: input.yearlyTurnover,
    employment_type: input.employmentType,
    existing_monthly_loan_payments: input.existingMonthlyLoanPayments,
    disposable_income: result.disposableIncome,
    eligibility_status: result.eligibilityStatus,
    max_eligible_loan_amount: result.maxEligibleLoanAmount,
    assessment_explanation: result.assessmentExplanation,
    user_id: userId
  };
}

app.post('/api/applications', requireAuth, (req, res, next) => {
  try {
    const input = parseApplication(req.body);
    const result = assess(input);
    const saved = insertApplication.run(sqlValues(input, result, req.session.user.id));
    const row = selectByIdAndUser.get(saved.lastInsertRowid, req.session.user.id);
    res.status(201).json({ message: 'Application saved successfully.', application: dbRecord(row) });
  } catch (err) {
    if (err.message && !err.code) return apiError(res, 400, err.message);
    next(err);
  }
});

app.put('/api/applications/:id', requireAuth, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return apiError(res, 400, 'Invalid application ID.');
    const current = selectByIdAndUser.get(id, req.session.user.id);
    if (!current) return apiError(res, 404, 'Application not found.');
    const input = parseApplication(req.body);
    const result = assess(input);
    const values = { ...sqlValues(input, result, req.session.user.id), application_id: id };
    const outcome = updateApplication.run(values);
    if (!outcome.changes) return apiError(res, 404, 'Application not found.');
    const row = selectByIdAndUser.get(id, req.session.user.id);
    res.json({ message: 'Application updated successfully.', application: dbRecord(row) });
  } catch (err) {
    if (err.message && !err.code) return apiError(res, 400, err.message);
    next(err);
  }
});

app.delete('/api/applications/:id', requireAuth, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return apiError(res, 400, 'Invalid application ID.');
    const outcome = db.prepare('DELETE FROM LOAN_APPLICATIONS WHERE application_id = ? AND user_id = ?')
      .run(id, req.session.user.id);
    if (!outcome.changes) return apiError(res, 404, 'Application not found.');
    res.json({ message: 'Application deleted successfully.' });
  } catch (err) { next(err); }
});

// API requests are protected by requireAuth. Also prevent direct access to the
// dashboard HTML unless the session is authenticated.
app.get(['/dashboard.html', '/application.html', '/history.html'], (req, res, next) => {
  if (!req.session || !req.session.user) return res.redirect('/index.html');
  next();
});

app.get('/', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/dashboard.html');
  res.redirect('/index.html');
});

app.use('/api', (req, res) => apiError(res, 404, 'API endpoint not found.'));

app.use((err, req, res, next) => {
  console.error('Application error:', err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'A server error occurred. Check the terminal for details.' });
});

const server = app.listen(PORT, () => {
  console.log(`Bank Management and Loan Eligibility System running at http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop the server.');
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
