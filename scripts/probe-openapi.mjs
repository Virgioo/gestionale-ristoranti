import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envRaw = readFileSync(join(__dirname, '..', '.env.local'), 'utf-8')
const env = Object.fromEntries(
  envRaw.split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  })
)

const BASE = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const res = await fetch(`${BASE}/rest/v1/`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/openapi+json' }
})
const spec = await res.json()

const definitions = spec.definitions ?? spec.components?.schemas ?? {}
const tables = Object.keys(definitions).filter(k => !k.includes('_pkey'))

for (const t of tables) {
  const def = definitions[t]
  const cols = Object.keys(def?.properties ?? {})
  if (cols.length) console.log(`\n${t}:\n  ${cols.join(', ')}`)
}
