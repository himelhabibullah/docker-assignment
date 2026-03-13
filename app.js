const express = require("express");
const os = require("os");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({
    hostname: os.hostname(),
    message: "Hello from hostname-app!",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
