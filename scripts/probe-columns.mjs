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

async function post(table, body) {
  const r = await fetch(`${BASE}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body)
  })
  return r.json()
}

async function get(table) {
  const r = await fetch(`${BASE}/rest/v1/${table}?limit=1`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  })
  return r.json()
}

// Try empty insert to get NOT NULL columns
const tables = ['sedi', 'clienti', 'animali', 'prenotazioni', 'visite', 'comande', 'righe_comanda', 'turni', 'campagne', 'note', 'notifiche', 'eventi']

for (const t of tables) {
  const r = await post(t, {})
  console.log(`\n${t}:`, JSON.stringify(r).slice(0, 300))
}

// Try select to see if it returns column names
console.log('\n\n=== SELECT probe ===')
for (const t of tables) {
  const r = await get(t)
  console.log(`${t}:`, Array.isArray(r) ? `[] (${r.length} rows)` : JSON.stringify(r).slice(0, 150))
}
