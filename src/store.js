const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const env = process.env.NODE_ENV || "development";
const dbPath = path.resolve(__dirname, "..", "data", "db.sqlite");

let SQL;
let db;

async function init() {
  SQL = await initSqlJs();
  if (env !== "test" && fs.existsSync(dbPath)) {
    const filebuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(filebuffer);
  } else {
    db = new SQL.Database();
    db.run(`
      CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE, type TEXT NOT NULL, balance INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'USD', status TEXT NOT NULL DEFAULT 'open', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS loans (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, principal INTEGER NOT NULL, outstanding INTEGER NOT NULL, interest_rate REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'open', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER, loan_id INTEGER, type TEXT NOT NULL, amount INTEGER NOT NULL, balance_after INTEGER, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    `);
    persist();
  }
}

const ready = init();

function persist() {
  if (env === "test") return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function runWrite(sql, params = []) {
  db.run(sql, params);
  persist();
}

async function createUser({ name, email, password_hash, role = "user" }) {
  await ready;
  try {
    runWrite(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [name, email, password_hash, role]
    );
    const row = run("SELECT id, name, email, role FROM users WHERE email = ?", [
      email,
    ])[0];
    return row;
  } catch (err) {
    if (err && err.message && err.message.includes("UNIQUE"))
      throw new Error("Email already in use");
    throw err;
  }
}

async function getUserByEmail(email) {
  await ready;
  const row = run("SELECT * FROM users WHERE email = ?", [email])[0];
  return row || null;
}

async function getUserById(id) {
  await ready;
  const row = run("SELECT id, name, email, role FROM users WHERE id = ?", [
    id,
  ])[0];
  return row || null;
}

async function createAccount(user_id, type) {
  await ready;
  const existing = run(
    "SELECT * FROM accounts WHERE user_id = ? AND status = ?",
    [user_id, "open"]
  )[0];
  if (existing) throw new Error("User already has an open account");
  runWrite("INSERT INTO accounts (user_id, type, balance) VALUES (?, ?, 0)", [
    user_id,
    type,
  ]);
  const acc = run("SELECT * FROM accounts WHERE user_id = ? AND status = ?", [
    user_id,
    "open",
  ])[0];
  return acc;
}

async function getAccountById(id) {
  await ready;
  const row = run("SELECT * FROM accounts WHERE id = ?", [id])[0];
  return row || null;
}

async function getAccountsByUser(user_id) {
  await ready;
  return run("SELECT * FROM accounts WHERE user_id = ?", [user_id]);
}

async function updateAccountBalance(id, newBalance) {
  await ready;
  runWrite("UPDATE accounts SET balance = ? WHERE id = ?", [newBalance, id]);
  return getAccountById(id);
}

async function closeAccount(id) {
  await ready;
  runWrite("UPDATE accounts SET status = ? WHERE id = ?", ["closed", id]);
  return getAccountById(id);
}

async function insertTransaction({
  account_id = null,
  loan_id = null,
  type,
  amount,
  balance_after = null,
  description = "",
}) {
  await ready;
  runWrite(
    "INSERT INTO transactions (account_id, loan_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?, ?)",
    [account_id, loan_id, type, amount, balance_after, description]
  );
  const rows = run("SELECT * FROM transactions ORDER BY id DESC LIMIT 1");
  return rows[0];
}

async function createLoan(user_id, amount) {
  await ready;
  runWrite(
    "INSERT INTO loans (user_id, principal, outstanding, interest_rate) VALUES (?, ?, ?, ?)",
    [user_id, amount, amount, 0]
  );
  const rows = run(
    "SELECT * FROM loans WHERE user_id = ? ORDER BY id DESC LIMIT 1",
    [user_id]
  );
  return rows[0];
}

async function getLoansByUser(user_id) {
  await ready;
  return run("SELECT * FROM loans WHERE user_id = ?", [user_id]);
}

async function getLoanById(id) {
  await ready;
  const row = run("SELECT * FROM loans WHERE id = ?", [id])[0];
  return row || null;
}

async function updateLoanOutstanding(id, newOutstanding) {
  await ready;
  runWrite("UPDATE loans SET outstanding = ?, status = ? WHERE id = ?", [
    newOutstanding,
    newOutstanding === 0 ? "closed" : "open",
    id,
  ]);
  return getLoanById(id);
}

async function sumAccountsBalance() {
  await ready;
  const row = run("SELECT SUM(balance) as s FROM accounts")[0];
  return row && row.s ? Number(row.s) : 0;
}

async function sumLoansOutstanding() {
  await ready;
  const row = run("SELECT SUM(outstanding) as s FROM loans")[0];
  return row && row.s ? Number(row.s) : 0;
}

async function getTransactionsForUser(user_id) {
  await ready;
  const rows = run(
    `SELECT t.* FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN loans l ON t.loan_id = l.id
    WHERE a.user_id = ? OR l.user_id = ?`,
    [user_id, user_id]
  );
  return rows;
}

module.exports = {
  init,
  createUser,
  getUserByEmail,
  getUserById,
  createAccount,
  getAccountById,
  getAccountsByUser,
  updateAccountBalance,
  closeAccount,
  insertTransaction,
  createLoan,
  getLoansByUser,
  getLoanById,
  updateLoanOutstanding,
  sumAccountsBalance,
  sumLoansOutstanding,
  getTransactionsForUser,
};
