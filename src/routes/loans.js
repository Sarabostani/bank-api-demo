const express = require("express");
const router = express.Router();
const Joi = require("joi");
const store = require("../store");
const { authMiddleware } = require("../auth");

const applySchema = Joi.object({
  amount: Joi.number().integer().min(1).required(),
});
const paySchema = Joi.object({
  amount: Joi.number().integer().min(1).required(),
});

async function getBankOnHand() {
  const bankStart = 250000;
  const totalCustomerMoney = await store.sumAccountsBalance();
  return bankStart + Math.floor(totalCustomerMoney * 0.25);
}

router.post("/", authMiddleware, async (req, res) => {
  const { error, value } = applySchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const requested = value.amount;
  const bankOnHand = await getBankOnHand();
  const totalLoans = await store.sumLoansOutstanding();
  const available = bankOnHand - totalLoans;
  if (requested > available)
    return res.status(400).json({ error: "Bank cannot cover this loan" });
  const loan = await store.createLoan(req.user.id, requested);
  await store.insertTransaction({
    loan_id: loan.id,
    type: "loan_disbursement",
    amount: requested,
    description: "loan disbursed",
  });
  res.status(201).json(loan);
});

router.post("/:id/payments", authMiddleware, async (req, res) => {
  const { error, value } = paySchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const id = Number(req.params.id);
  const loan = await store.getLoanById(id);
  if (!loan || loan.user_id !== req.user.id)
    return res.status(404).json({ error: "Loan not found" });
  const pay = value.amount;
  const newOutstanding = Math.max(0, loan.outstanding - pay);
  await store.updateLoanOutstanding(id, newOutstanding);
  await store.insertTransaction({
    loan_id: id,
    type: "loan_payment",
    amount: pay,
    description: "loan payment",
  });
  const updated = await store.getLoanById(id);
  res.json(updated);
});

router.get("/", authMiddleware, async (req, res) => {
  const rows = await store.getLoansByUser(req.user.id);
  res.json(rows);
});

router.get("/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const loan = await store.getLoanById(id);
  if (!loan || loan.user_id !== req.user.id)
    return res.status(404).json({ error: "Loan not found" });
  res.json(loan);
});

module.exports = router;
