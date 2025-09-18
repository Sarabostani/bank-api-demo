const express = require("express");
const router = express.Router();
const store = require("../store");
const { authMiddleware } = require("../auth");

router.get("/", authMiddleware, async (req, res) => {
  const rows = await store.getTransactionsForUser(req.user.id);
  res.json(rows);
});

module.exports = router;
