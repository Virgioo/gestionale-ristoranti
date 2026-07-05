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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const tables = ['sedi', 'clienti', 'animali', 'prenotazioni', 'visite', 'comande', 'staff', 'campagne', 'note', 'notifiche', 'eventi', 'menu']

for (const t of tables) {
  const { data, error, count } = await supabase.from(t).select('*', { count: 'exact', head: true })
  if (error) console.log(`❌ ${t}: ${error.message} (code: ${error.code})`)
  else console.log(`✓  ${t}: ${count ?? 0} righe`)
}

// Test insert su sedi
console.log('\n--- Test insert sedi ---')
const { data: ins, error: insErr } = await supabase.from('sedi').insert({
  nome: 'TEST', indirizzo: 'Via Test', citta: 'Napoli', capienza: 50, attiva: true
}).select().single()
if (insErr) console.log('Insert bloccato:', insErr.message, '| code:', insErr.code)
else {
  console.log('Insert OK, id:', ins.id)
  await supabase.from('sedi').delete().eq('id', ins.id)
  console.log('Cleanup OK')
}
