/* eslint-disable */
const fs = require("fs");
const path = require("path");
const https = require("https");

// Read version
const version = fs.readFileSync(path.join(__dirname, "../version.txt"), "utf-8").trim();
if (!version) {
  console.error("❌ version.txt está vazio.");
  process.exit(1);
}

// Read .env.local
const envPath = path.join(__dirname, "../.env.local");
if (!fs.existsSync(envPath)) {
  console.error("❌ .env.local não encontrado.");
  process.exit(1);
}
const env = fs.readFileSync(envPath, "utf-8");
const get = (key) => env.match(new RegExp(`${key}="?([^"\n]+)"?`))?.[1]?.trim();

const apiKey = get("NEXT_PUBLIC_FIREBASE_API_KEY");
const projectId = get("NEXT_PUBLIC_FIREBASE_PROJECT_ID");

if (!apiKey || !projectId) {
  console.error("❌ NEXT_PUBLIC_FIREBASE_API_KEY ou NEXT_PUBLIC_FIREBASE_PROJECT_ID não encontrados no .env.local.");
  process.exit(1);
}

// Firestore REST API — PATCH storeConfig/version
const body = JSON.stringify({
  fields: { version: { stringValue: version } },
});

const options = {
  hostname: "firestore.googleapis.com",
  path: `/v1/projects/${projectId}/databases/(default)/documents/storeConfig/version?key=${apiKey}`,
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  },
};

const req = https.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log(`✅ Versão ${version} publicada no Firebase.`);
      process.exit(0);
    } else {
      console.error(`❌ Erro ${res.statusCode}: ${data}`);
      process.exit(1);
    }
  });
});

req.on("error", (err) => {
  console.error("❌ Erro na requisição:", err.message);
  process.exit(1);
});

req.write(body);
req.end();
