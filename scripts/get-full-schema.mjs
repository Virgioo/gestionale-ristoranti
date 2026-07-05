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
const KEY = env.SUPABASE_SERVICE_ROLE_KEY

// Get full OpenAPI spec with service_role
const res = await fetch(`${BASE}/rest/v1/`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/openapi+json' }
})
const spec = await res.json()

const defs = spec.definitions ?? spec.components?.schemas ?? {}
const relevantTables = Object.keys(defs).filter(k =>
  !k.endsWith('_pkey') && !k.startsWith('Partitioned') &&
  ['sedi','clienti','animali','prenotazioni','visite','comande','righe_comanda','turni','campagne','note','notifiche','eventi'].some(t => k === t)
)

for (const t of relevantTables.sort()) {
  const props = defs[t]?.properties ?? {}
  const cols = Object.entries(props).map(([col, def]) => `${col}(${def.type ?? def.format ?? '?'})`)
  console.log(`\n${t}:\n  ${cols.join('\n  ')}`)
}

// Also list all definition keys to find alternative table names
console.log('\n\n=== All table definitions in spec ===')
console.log(Object.keys(defs).sort().join('\n'))
