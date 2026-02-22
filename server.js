const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.ANTHROPIC_API_KEY;
const PORT = process.env.PORT || 3000;

if (!API_KEY) {
  console.error("❌ Fehler: ANTHROPIC_API_KEY ist nicht gesetzt.");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  // CORS-Header für alle Anfragen
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Statische Dateien (index.html etc.)
  if (req.method === "GET" && req.url !== "/chat") {
    const filePath = path.join(__dirname, req.url === "/" ? "index.html" : req.url);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Nicht gefunden");
        return;
      }
      const ext = path.extname(filePath);
      const types = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript" };
      res.writeHead(200, { "Content-Type": types[ext] || "text/plain" });
      res.end(data);
    });
    return;
  }

  // API-Proxy: POST /chat
  if (req.method === "POST" && req.url === "/chat") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Ungültiges JSON" }));
        return;
      }

      const payload = JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: parsed.system,
        messages: parsed.messages,
      });

      const options = {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Length": Buffer.byteLength(payload),
        },
      };

      const apiReq = https.request(options, (apiRes) => {
        let data = "";
        apiRes.on("data", (chunk) => (data += chunk));
        apiRes.on("end", () => {
          res.writeHead(apiRes.statusCode, { "Content-Type": "application/json" });
          res.end(data);
        });
      });

      apiReq.on("error", (e) => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      });

      apiReq.write(payload);
      apiReq.end();
    });
    return;
  }

  res.writeHead(404);
  res.end("Nicht gefunden");
});

server.listen(PORT, () => {
  console.log(`✅ Server läuft auf Port ${PORT}`);
});
