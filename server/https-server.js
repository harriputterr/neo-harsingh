import { createServer } from "https"
import { parse } from "url"
import next from "next"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const dev = process.env.NODE_ENV !== "production"
const app = next({ dev })
const handle = app.getRequestHandler()

const PORT = process.env.PORT || 3000

// Get directory name in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Check if certificates exist
const certsDir = path.join(__dirname, "..", "certs")
const certPath = path.join(certsDir, "cert.pem")
const keyPath = path.join(certsDir, "key.pem")

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('❌ SSL certificates not found. Please run "node scripts/generate-cert.js" first.')
  process.exit(1)
}

const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
}

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  }).listen(PORT, (err) => {
    if (err) throw err
    console.log(`> Ready on https://localhost:${PORT}`)
    console.log("> Note: You may need to accept the self-signed certificate in your browser")

    // Log environment variables for debugging
    console.log("> Environment variables:")
    console.log(`> NEXT_PUBLIC_SOCKET_HOST: ${process.env.NEXT_PUBLIC_SOCKET_HOST || "not set"}`)
    console.log(`> NEXT_PUBLIC_SOCKET_PORT: ${process.env.NEXT_PUBLIC_SOCKET_PORT || "not set"}`)
  })
})
