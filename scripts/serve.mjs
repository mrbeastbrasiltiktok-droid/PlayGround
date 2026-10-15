// Minimal foreground static file server for the built NOVA STRIKE bundle.
// Root: argv[2] or cwd. Port: process.env.PORT or 3000. No dependencies.
import { createServer } from 'node:http'
import { readFileSync, statSync } from 'node:fs'
import { resolve, join, extname } from 'node:path'

const root = resolve(process.argv[2] || process.cwd())
const port = Number(process.env.PORT || 3000)
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
}

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    let path = resolve(root, '.' + decodeURIComponent(url.pathname))
    if (path !== root && !path.startsWith(root + '/')) { res.writeHead(404); res.end('Not found'); return }
    try {
      if (statSync(path).isDirectory()) path = join(path, 'index.html')
    } catch { res.writeHead(404); res.end('Not found'); return }
    const body = readFileSync(path)
    res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.end(body)
  } catch { res.writeHead(404); res.end('Not found') }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`nova-strike static server: root=${root} port=${port}`)
})
