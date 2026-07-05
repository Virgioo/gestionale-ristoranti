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

const tables = ['sedi', 'clienti', 'animali', 'prenotazioni', 'visite', 'comande', 'righe_comanda', 'staff', 'turni', 'campagne', 'note', 'notifiche', 'eventi', 'menu']

for (const t of tables) {
  // Use limit=0 to get column info from PostgREST headers
  const res = await fetch(`${BASE}/rest/v1/${t}?limit=1`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json', 'Accept-Profile': 'public' }
  })

  // Try HEAD request to see schema
  const res2 = await fetch(`${BASE}/rest/v1/${t}?limit=0`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/openapi+json' }
  })

  const data = await res.json()
  if (Array.isArray(data) && data.length > 0) {
    console.log(`\n✅ ${t}:`, Object.keys(data[0]).join(', '))
  } else {
    // Insert with only id to provoke column-list error
    const ins = await fetch(`${BASE}/rest/v1/${t}`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ _probe: true })
    })
    const err = await ins.json()
    console.log(`\n📋 ${t}: ${JSON.stringify(err).slice(0, 200)}`)
  }
}
