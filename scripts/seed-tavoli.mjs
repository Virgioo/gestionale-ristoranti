/**
 * Seed: Sala principale + Terrazza con tavoli realistici
 * Eseguire con: node scripts/seed-tavoli.mjs
 * Il dev server deve essere avviato su localhost:3000
 */

const BASE = 'http://localhost:3000/api/db'

async function dbQuery(table, filters = []) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, filters }),
  })
  const j = await res.json()
  if (j.error) throw new Error(`query ${table}: ${j.error}`)
  return j.data ?? []
}

async function dbInsert(table, values) {
  const res = await fetch(BASE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, values }),
  })
  const j = await res.json()
  if (j.error) throw new Error(`insert ${table}: ${j.error}`)
  return j.data ?? []
}

async function dbUpsert(table, values, onConflict) {
  const res = await fetch(BASE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table, values, upsert: true, onConflict }),
  })
  const j = await res.json()
  if (j.error) throw new Error(`upsert ${table}: ${j.error}`)
  return j.data ?? []
}

// ─── Layout Sala principale (canvas 1000×680) ─────────────────────────────────
// 4 tavoli da 2p lungo i muri (sinistra/destra)
// 2 tavoli da 4p al centro
// 1 tavolo lungo da 8p in fondo
// 1 tavolo rotondo da 6p
const TAVOLI_PRINCIPALE = [
  { nome: 'T1',  forma: 'rettangolare', capienza: 2, pos_x: 30,  pos_y: 70,  larghezza: 70,  altezza: 50,  rotazione: 0 },
  { nome: 'T2',  forma: 'rettangolare', capienza: 2, pos_x: 30,  pos_y: 190, larghezza: 70,  altezza: 50,  rotazione: 0 },
  { nome: 'T3',  forma: 'rettangolare', capienza: 2, pos_x: 900, pos_y: 70,  larghezza: 70,  altezza: 50,  rotazione: 0 },
  { nome: 'T4',  forma: 'rettangolare', capienza: 2, pos_x: 900, pos_y: 190, larghezza: 70,  altezza: 50,  rotazione: 0 },
  { nome: 'T5',  forma: 'rettangolare', capienza: 4, pos_x: 370, pos_y: 190, larghezza: 110, altezza: 80,  rotazione: 0 },
  { nome: 'T6',  forma: 'rettangolare', capienza: 4, pos_x: 520, pos_y: 190, larghezza: 110, altezza: 80,  rotazione: 0 },
  { nome: 'T7',  forma: 'rettangolare', capienza: 8, pos_x: 330, pos_y: 530, larghezza: 300, altezza: 80,  rotazione: 0 },
  { nome: 'T8',  forma: 'rotondo',      capienza: 6, pos_x: 155, pos_y: 390, larghezza: 110, altezza: 110, rotazione: 0 },
]

// ─── Layout Terrazza (canvas 1000×680) ────────────────────────────────────────
// 4 tavoli rotondi, stile estivo
const TAVOLI_TERRAZZA = [
  { nome: 'TR1', forma: 'rotondo', capienza: 2, pos_x: 80,  pos_y: 90,  larghezza: 70, altezza: 70,  rotazione: 0 },
  { nome: 'TR2', forma: 'rotondo', capienza: 4, pos_x: 280, pos_y: 80,  larghezza: 90, altezza: 90,  rotazione: 0 },
  { nome: 'TR3', forma: 'rotondo', capienza: 4, pos_x: 100, pos_y: 320, larghezza: 90, altezza: 90,  rotazione: 0 },
  { nome: 'TR4', forma: 'rotondo', capienza: 2, pos_x: 380, pos_y: 330, larghezza: 70, altezza: 70,  rotazione: 0 },
]

async function main() {
  console.log('🍽️  Seed tavoli demo avviato...\n')

  // ── Controllo duplicati ──────────────────────────────────────────────────────
  const esistenti = await dbQuery('sale', [{ fn: 'in', args: ['nome', ['Sala principale', 'Terrazza']] }])
  if (esistenti.length > 0) {
    console.log('⚠️  Sale già presenti nel DB:')
    esistenti.forEach(s => console.log(`   - ${s.nome} (${s.id})`))
    console.log('\nPer reinserire: elimina prima le sale dal pannello Disposizione tavoli.')
    process.exit(0)
  }

  // ── Sala principale ──────────────────────────────────────────────────────────
  console.log('📍 Inserisco Sala principale...')
  const [sala1] = await dbInsert('sale', {
    nome: 'Sala principale', colore: '#3b82f6', ordine: 1,
  })
  console.log(`   ✅ sala1 id=${sala1.id}`)

  for (const t of TAVOLI_PRINCIPALE) {
    const [row] = await dbInsert('tavoli', { ...t, sala_id: sala1.id })
    console.log(`   ✅ tavolo ${t.nome} id=${row.id}`)
    await dbUpsert('stato_tavoli', { tavolo_id: row.id, stato: 'libero' }, 'tavolo_id')
  }

  // ── Terrazza ─────────────────────────────────────────────────────────────────
  console.log('\n📍 Inserisco Terrazza...')
  const [sala2] = await dbInsert('sale', {
    nome: 'Terrazza', colore: '#10b981', ordine: 2,
  })
  console.log(`   ✅ sala2 id=${sala2.id}`)

  for (const t of TAVOLI_TERRAZZA) {
    const [row] = await dbInsert('tavoli', { ...t, sala_id: sala2.id })
    console.log(`   ✅ tavolo ${t.nome} id=${row.id}`)
    await dbUpsert('stato_tavoli', { tavolo_id: row.id, stato: 'libero' }, 'tavolo_id')
  }

  console.log('\n🎉 Seed completato! 12 tavoli inseriti (8 Sala principale + 4 Terrazza).')
  console.log('   Apri /comande per vederli sulla mappa.')
}

main().catch(e => { console.error('❌ Errore:', e.message); process.exit(1) })
