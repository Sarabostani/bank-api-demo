const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../auth");
const store = require("../store");

router.get("/status", authMiddleware, async (req, res) => {
  if (!req.user || !req.user.isAdmin)
    return res.status(403).json({ error: "Forbidden" });
  const bankStart = 250000;
  const totalCustomerMoney = await store.sumAccountsBalance();
  const bankOnHand = bankStart + Math.floor(totalCustomerMoney * 0.25);
  const totalLoans = await store.sumLoansOutstanding();
  const totalDeposits = totalCustomerMoney;
  res.json({ bankOnHand, totalLoans, totalDeposits });
});

module.exports = router;
