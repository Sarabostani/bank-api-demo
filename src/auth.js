const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const store = require("./store");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: "8h",
  });
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 8);
}

function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Authorization required" });
  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer")
    return res.status(401).json({ error: "Invalid authorization header" });
  try {
    const payload = jwt.verify(parts[1], JWT_SECRET);
    const row = await store.getUserById(payload.id);
    if (!row) return res.status(401).json({ error: "User not found" });
    req.user = row;
    req.user.isAdmin = req.user.role === "admin";
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = {
  generateToken,
  hashPassword,
  comparePassword,
  authMiddleware,
};
