// scripts/replace-firebase-config.cjs
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "src", "firebase.ts");

let content = fs.readFileSync(filePath, "utf8");

const replacements = {
  "__FIREBASE_API_KEY__": process.env.FIREBASE_API_KEY,
  "__FIREBASE_AUTH_DOMAIN__": process.env.FIREBASE_AUTH_DOMAIN,
  "__FIREBASE_PROJECT_ID__": process.env.FIREBASE_PROJECT_ID,
  "__FIREBASE_STORAGE_BUCKET__": process.env.FIREBASE_STORAGE_BUCKET,
  "__FIREBASE_MESSAGING_SENDER_ID__": process.env.FIREBASE_MESSAGING_SENDER_ID,
  "__FIREBASE_APP_ID__": process.env.FIREBASE_APP_ID,
};

for (const [placeholder, value] of Object.entries(replacements)) {
  if (!value) {
    console.error(`❌ Missing env for ${placeholder}`);
    process.exit(1);
  }
  // Replace both "__PLACEHOLDER__" and __PLACEHOLDER__ just in case
  const regex = new RegExp(placeholder, "g");
  content = content.replace(regex, value);
}

fs.writeFileSync(filePath, content, "utf8");
console.log("✅ firebase.ts config placeholders replaced for CI build");
