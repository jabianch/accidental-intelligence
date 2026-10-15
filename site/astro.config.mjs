import { defineConfig } from 'astro/config'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Dev-only editor backend: POST /__save with the whole copy object writes src/copy.json.
// Vite then hot-reloads the page. Never part of the built site.
const editor = () => ({
  name: 'in-browser-editor',
  hooks: {
    'astro:server:setup': ({ server }) => {
      server.middlewares.use('/__save', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        // only this machine's own pages may save: refuses a cross-site POST from any open tab, and a DNS-rebound hostname
        const origin = (() => { try { return new URL(req.headers.origin).hostname } catch { return '' } })()
        if (origin !== '127.0.0.1' && origin !== 'localhost') { res.statusCode = 403; return res.end() }
        let body = ''
        req.on('data', c => (body += c))
        req.on('end', () => {
          try {
            const data = JSON.parse(body)
            // schema guard: only a whole copy object may be written (a stray POST must never blank the file)
            if (!data || !Array.isArray(data.order) || typeof data.headline !== 'string' || !Array.isArray(data.forms)) { res.statusCode = 422; return res.end('{"ok":false,"error":"not a copy object"}') }
            writeFileSync(fileURLToPath(new URL('./src/copy.json', import.meta.url)), JSON.stringify(data, null, 2) + '\n')
            res.setHeader('content-type', 'application/json'); res.end('{"ok":true}')
          } catch (e) { res.statusCode = 400; res.end(JSON.stringify({ ok: false, error: String(e) })) }
        })
      })
    },
  },
})

export default defineConfig({ site: 'https://accidentalintelligence.org', build: { format: 'directory' }, integrations: [editor()] })
