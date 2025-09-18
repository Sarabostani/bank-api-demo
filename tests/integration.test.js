const request = require("supertest");
const app = require("../src/app");
const db = require("../src/db");

let token, account;

beforeAll(() => {});

afterAll(() => {});

test("register -> login -> open account -> deposit -> withdraw -> apply loan -> pay loan", async () => {
  const user = {
    name: "Alice",
    email: "alice@example.com",
    password: "password",
  };
  const reg = await request(app).post("/api/auth/register").send(user);
  expect(reg.status).toBe(201);
  token = reg.body.token;

  const open = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "checking" });
  expect(open.status).toBe(201);
  account = open.body;

  const dep = await request(app)
    .post(`/api/accounts/${account.id}/deposits`)
    .set("Authorization", `Bearer ${token}`)
    .send({ amount: 1000 });
  expect(dep.status).toBe(200);
  expect(dep.body.account.balance).toBe(1000);

  const wit = await request(app)
    .post(`/api/accounts/${account.id}/withdrawals`)
    .set("Authorization", `Bearer ${token}`)
    .send({ amount: 200 });
  expect(wit.status).toBe(200);
  expect(wit.body.account.balance).toBe(800);

  const loan = await request(app)
    .post("/api/loans")
    .set("Authorization", `Bearer ${token}`)
    .send({ amount: 50000 });
  expect(loan.status).toBe(201);

  const payment = await request(app)
    .post(`/api/loans/${loan.body.id}/payments`)
    .set("Authorization", `Bearer ${token}`)
    .send({ amount: 10000 });
  expect(payment.status).toBe(200);
  expect(payment.body.outstanding).toBe(40000);
});

test("cannot deposit without account", async () => {
  const user = { name: "Bob", email: "bob@example.com", password: "password" };
  const reg = await request(app).post("/api/auth/register").send(user);
  expect(reg.status).toBe(201);
  const bobToken = reg.body.token;
  const res = await request(app)
    .post("/api/accounts/999/deposits")
    .set("Authorization", `Bearer ${bobToken}`)
    .send({ amount: 10 });
  expect(res.status).toBe(404);
});

test("cannot withdraw more than balance", async () => {
  const res = await request(app)
    .post(`/api/accounts/${account.id}/withdrawals`)
    .set("Authorization", `Bearer ${token}`)
    .send({ amount: 999999 });
  expect(res.status).toBe(400);
});
