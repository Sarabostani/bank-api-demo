const express = require("express");
const router = express.Router();
const Joi = require("joi");
const store = require("../store");
const { authMiddleware } = require("../auth");

const createSchema = Joi.object({
  type: Joi.string().valid("checking").required(),
});
const amountSchema = Joi.object({
  amount: Joi.number().integer().min(1).required(),
});

router.post("/", authMiddleware, async (req, res) => {
  const { error, value } = createSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  try {
    const account = await store.createAccount(req.user.id, value.type);
    return res.status(201).json(account);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const acc = await store.getAccountById(id);
  if (!acc || acc.user_id !== req.user.id)
    return res.status(404).json({ error: "Account not found" });
  await store.closeAccount(id);
  res.json({ ok: true });
});

router.get("/", authMiddleware, async (req, res) => {
  const rows = await store.getAccountsByUser(req.user.id);
  res.json(rows);
});

router.get("/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const acc = await store.getAccountById(id);
  if (!acc || acc.user_id !== req.user.id)
    return res.status(404).json({ error: "Account not found" });
  res.json(acc);
});

router.post("/:id/deposits", authMiddleware, async (req, res) => {
  const { error, value } = amountSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const id = Number(req.params.id);
  const acc = await store.getAccountById(id);
  if (!acc) return res.status(404).json({ error: "Account not found" });
  if (acc.user_id !== req.user.id)
    return res.status(403).json({ error: "Cannot deposit to others accounts" });
  const newBal = acc.balance + value.amount;
  const updated = await store.updateAccountBalance(id, newBal);
  const tx = await store.insertTransaction({
    account_id: id,
    type: "deposit",
    amount: value.amount,
    balance_after: newBal,
    description: "deposit",
  });
  res.json({ account: updated, transaction: tx });
});

router.post("/:id/withdrawals", authMiddleware, async (req, res) => {
  const { error, value } = amountSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const id = Number(req.params.id);
  const acc = await store.getAccountById(id);
  if (!acc) return res.status(404).json({ error: "Account not found" });
  if (acc.user_id !== req.user.id)
    return res
      .status(403)
      .json({ error: "Cannot withdraw from others accounts" });
  if (acc.balance < value.amount)
    return res.status(400).json({ error: "Insufficient funds" });
  const newBal = acc.balance - value.amount;
  const updated = await store.updateAccountBalance(id, newBal);
  const tx = await store.insertTransaction({
    account_id: id,
    type: "withdrawal",
    amount: value.amount,
    balance_after: newBal,
    description: "withdrawal",
  });
  res.json({ account: updated, transaction: tx });
});

module.exports = router;
