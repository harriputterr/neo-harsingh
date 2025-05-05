import { execSync } from "child_process"
import fs from "fs"
import path from "path"

// Create certs directory if it doesn't exist
const certsDir = path.join(process.cwd(), "certs")
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir)
}

console.log("Generating self-signed certificate...")

try {
  // Generate self-signed certificate using OpenSSL
  execSync(
    'openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes -subj "/CN=localhost"',
    { stdio: "inherit" },
  )

  console.log("\nCertificate generated successfully!")
  console.log("\nYou can now run your Next.js app with HTTPS using:")
  console.log("npm run dev:https")
} catch (error) {
  console.error("Failed to generate certificate:", error.message)
  console.log("\nMake sure OpenSSL is installed on your system.")
  console.log("Alternatively, you can use mkcert: https://github.com/FiloSottile/mkcert")
}
