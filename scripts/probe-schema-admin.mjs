import { createClient } from '@supabase/supabase-js'
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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const tables = ['sedi', 'clienti', 'animali', 'prenotazioni', 'visite', 'comande', 'righe_comanda', 'staff', 'turni', 'campagne', 'note', 'notifiche', 'eventi', 'menu']

for (const t of tables) {
  const { data, error } = await supabase.from(t).select('*').limit(1)
  if (error) {
    console.log(`❌ ${t}: ${error.message}`)
  } else if (data && data.length > 0) {
    console.log(`✅ ${t}: [${Object.keys(data[0]).join(', ')}]`)
  } else {
    // Insert empty to get NOT NULL violations which reveal column names
    const { error: ie } = await supabase.from(t).insert({})
    if (ie) console.log(`📋 ${t} (empty insert): ${ie.message}`)
    else console.log(`✅ ${t}: empty (insert ok with no cols?)`)
  }
}
