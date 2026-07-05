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

const res = await fetch(`${BASE}/rest/v1/`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/openapi+json' }
})
const spec = await res.json()
const defs = spec.definitions ?? spec.components?.schemas ?? {}

// Find enum values for each table
const tables = ['sedi', 'clienti', 'animali', 'prenotazioni', 'visite', 'campagne', 'note', 'notifiche']
for (const t of tables) {
  const props = defs[t]?.properties ?? {}
  const enumCols = Object.entries(props).filter(([, def]) => def.enum || (def.anyOf && def.anyOf.some(x => x.enum)))
  if (enumCols.length > 0) {
    console.log(`\n${t}:`)
    for (const [col, def] of enumCols) {
      const vals = def.enum ?? def.anyOf?.flatMap(x => x.enum ?? []) ?? []
      console.log(`  ${col}: [${vals.join(', ')}]`)
    }
  }
}
