const express = require("express");
const router = express.Router();
const store = require("../store");
const { generateToken, hashPassword, comparePassword } = require("../auth");
const Joi = require("joi");

const registerSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

router.post("/register", async (req, res) => {
  const { error, value } = registerSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const { name, email, password } = value;
  try {
    const hash = hashPassword(password);
    const user = await store.createUser({ name, email, password_hash: hash });
    const token = generateToken(user);
    res.status(201).json({ user, token });
  } catch (err) {
    if (err.message.includes("Email already in use"))
      return res.status(400).json({ error: "Email already in use" });
    throw err;
  }
});

router.post("/login", async (req, res) => {
  const { error, value } = loginSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  const { email, password } = value;
  const row = await store.getUserByEmail(email);
  if (!row) return res.status(400).json({ error: "Invalid credentials" });
  if (!comparePassword(password, row.password_hash))
    return res.status(400).json({ error: "Invalid credentials" });
  const user = { id: row.id, name: row.name, email: row.email, role: row.role };
  const token = generateToken(user);
  res.json({ user, token });
});

module.exports = router;
