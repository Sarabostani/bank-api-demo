const express = require("express");
const router = express.Router();

router.use("/auth", require("./auth"));
router.use("/accounts", require("./accounts"));
router.use("/loans", require("./loans"));
router.use("/admin", require("./admin"));
router.use("/transactions", require("./transactions"));

module.exports = router;
