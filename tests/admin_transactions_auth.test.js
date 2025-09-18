const request = require("supertest");
const app = require("../src/app");
const store = require("../src/store");
const { generateToken, hashPassword } = require("../src/auth");

test("admin status requires admin and accessible to admin", async () => {
  const user = { name: "Norm", email: "norm@example.com", password: "pass123" };
  const reg = await request(app).post("/api/auth/register").send(user);
  expect(reg.status).toBe(201);
  const token = reg.body.token;
  const res1 = await request(app)
    .get("/api/admin/status")
    .set("Authorization", `Bearer ${token}`);
  expect(res1.status).toBe(403);
  const adminHash = hashPassword("adminpass");
  const admin = await store.createUser({
    name: "Admin",
    email: "admin@local",
    password_hash: adminHash,
    role: "admin",
  });
  const adminToken = generateToken(admin);
  const res2 = await request(app)
    .get("/api/admin/status")
    .set("Authorization", `Bearer ${adminToken}`);
  expect(res2.status).toBe(200);
  expect(res2.body).toHaveProperty("bankOnHand");
  expect(res2.body).toHaveProperty("totalLoans");
  expect(res2.body).toHaveProperty("totalDeposits");
});

test("transactions endpoint returns transactions for user", async () => {
  const u = { name: "Tina", email: "tina@example.com", password: "pass123" };
  const r = await request(app).post("/api/auth/register").send(u);
  expect(r.status).toBe(201);
  const t = r.body.token;
  const open = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${t}`)
    .send({ type: "checking" });
  expect(open.status).toBe(201);
  const acc = open.body;
  await request(app)
    .post(`/api/accounts/${acc.id}/deposits`)
    .set("Authorization", `Bearer ${t}`)
    .send({ amount: 500 });
  const loan = await request(app)
    .post("/api/loans")
    .set("Authorization", `Bearer ${t}`)
    .send({ amount: 1000 });
  expect(loan.status).toBe(201);
  await request(app)
    .post(`/api/loans/${loan.body.id}/payments`)
    .set("Authorization", `Bearer ${t}`)
    .send({ amount: 100 });
  const txs = await request(app)
    .get("/api/transactions")
    .set("Authorization", `Bearer ${t}`);
  expect(txs.status).toBe(200);
  expect(Array.isArray(txs.body)).toBe(true);
  expect(txs.body.length).toBeGreaterThanOrEqual(2);
});

test("auth failures for missing and invalid token", async () => {
  const r1 = await request(app).get("/api/accounts");
  expect(r1.status).toBe(401);
  const r2 = await request(app)
    .get("/api/accounts")
    .set("Authorization", "Bearer badtoken");
  expect(r2.status).toBe(401);
});
