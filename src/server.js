const app = require("./app");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3000;

const dataDir = path.resolve(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

app.listen(PORT, () => {
  console.log(`Scrooge Bank API running on http://localhost:${PORT}`);
});
