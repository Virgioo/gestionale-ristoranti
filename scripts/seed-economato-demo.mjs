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
function ok(label, n) { console.log(`  ✓ ${label}: ${n} record`) }

async function main() {
  console.log('\n=== Seed Economato Demo ===\n')

  // Verifica tabelle
  const { error: checkErr } = await supabase.from('categorie_economato').select('id').limit(1)
  if (checkErr) {
    console.error('ERRORE: tabelle economato non trovate.')
    console.error('Esegui prima supabase/migrations/20260703_create_economato.sql nel SQL Editor di Supabase.')
    process.exit(1)
  }

  // Recupera categorie esistenti (inserite dalla migrazione)
  const { data: cat, error: catErr } = await supabase
    .from('categorie_economato').select('id, nome').order('ordine')
  if (catErr || !cat?.length) {
    console.error('Nessuna categoria trovata. Esegui la migrazione SQL prima.')
    process.exit(1)
  }
  console.log(`Categorie trovate: ${cat.map(c => c.nome).join(', ')}\n`)

  const byNome = Object.fromEntries(cat.map(c => [c.nome, c.id]))
  const viniId      = byNome['Vini']
  const bevId       = byNome['Bevande']
  const ingId       = byNome['Ingredienti']
  const tovId       = byNome['Tovagliati']
  const accId       = byNome['Accessori']
  const altroId     = byNome['Altro']

  // Inserisce prodotti demo
  console.log('Inserimento prodotti demo...')
  const prodotti = []

  // ── VINI ─────────────────────────────────────────────────────────────────
  if (viniId) {
    prodotti.push(
      { categoria_id: viniId, nome: 'Sangiovese DOC Romagna', unita: 'bottiglie', qta_attuale: 48, qta_minima: 24, qta_massima: 120, fornitore: 'Cantina Romagnola', prezzo_unitario: 8.50, note: 'Casa del ristorante, rotazione alta' },
      { categoria_id: viniId, nome: 'Pinot Grigio delle Venezie IGT', unita: 'bottiglie', qta_attuale: 36, qta_minima: 18, qta_massima: 72, fornitore: 'Vini del Nord SRL', prezzo_unitario: 7.20, note: null },
      { categoria_id: viniId, nome: 'Prosecco DOC Valdobbiadene', unita: 'bottiglie', qta_attuale: 10, qta_minima: 24, qta_massima: 60, fornitore: 'Cantine Venete', prezzo_unitario: 9.80, note: 'SOTTO SCORTA — riordinare urgente' },
      { categoria_id: viniId, nome: 'Barolo DOCG Serralunga', unita: 'bottiglie', qta_attuale: 18, qta_minima: 6, qta_massima: 24, fornitore: 'Enoteca Piemonte', prezzo_unitario: 38.00, note: 'Solo per clienti Platinum/Diamante' },
      { categoria_id: viniId, nome: 'Rosé Provence AOC', unita: 'bottiglie', qta_attuale: 24, qta_minima: 12, qta_massima: 48, fornitore: 'Import Francia SRL', prezzo_unitario: 11.50, note: 'Alta richiesta in estate' },
    )
  }

  // ── BEVANDE ──────────────────────────────────────────────────────────────
  if (bevId) {
    prodotti.push(
      { categoria_id: bevId, nome: 'Acqua San Pellegrino 75cl', unita: 'casse', qta_attuale: 12, qta_minima: 8, qta_massima: 30, fornitore: 'Beverage Italia', prezzo_unitario: 14.40, note: '6 bottiglie a cassa' },
      { categoria_id: bevId, nome: 'Acqua Naturale 75cl', unita: 'casse', qta_attuale: 8, qta_minima: 10, qta_massima: 30, fornitore: 'Beverage Italia', prezzo_unitario: 10.80, note: 'SOTTO SCORTA' },
      { categoria_id: bevId, nome: 'Coca-Cola 33cl', unita: 'casse', qta_attuale: 5, qta_minima: 3, qta_massima: 15, fornitore: 'Distribuzione Locale', prezzo_unitario: 18.00, note: null },
      { categoria_id: bevId, nome: 'Birra artigianale locale 33cl', unita: 'bottiglie', qta_attuale: 72, qta_minima: 36, qta_massima: 144, fornitore: 'Birrificio Adriatico', prezzo_unitario: 2.80, note: 'Etichetta esclusiva Scogliera' },
      { categoria_id: bevId, nome: 'Succhi di frutta biologici 20cl', unita: 'pz', qta_attuale: 30, qta_minima: 12, qta_massima: 60, fornitore: 'BioDistribution', prezzo_unitario: 1.20, note: 'Per famiglie con bambini' },
    )
  }

  // ── INGREDIENTI ───────────────────────────────────────────────────────────
  if (ingId) {
    prodotti.push(
      { categoria_id: ingId, nome: 'Olio EVO DOP Brisighella', unita: 'l', qta_attuale: 15, qta_minima: 10, qta_massima: 40, fornitore: 'Frantoio Romagnolo', prezzo_unitario: 12.00, note: 'Per condimento tavoli e cucina' },
      { categoria_id: ingId, nome: 'Branzino fresco (kg)', unita: 'kg', qta_attuale: 8, qta_minima: 5, qta_massima: 20, fornitore: 'Pescheria Adriatica', prezzo_unitario: 18.50, note: 'Ordine giornaliero — verificare freschezza' },
      { categoria_id: ingId, nome: 'Pasta di Gragnano (assortita)', unita: 'kg', qta_attuale: 25, qta_minima: 10, qta_massima: 50, fornitore: 'Pasta Artigianale SRL', prezzo_unitario: 3.80, note: null },
      { categoria_id: ingId, nome: 'Prosciutto crudo di Parma DOP', unita: 'kg', qta_attuale: 3, qta_minima: 5, qta_massima: 15, fornitore: 'Salumificio Emiliano', prezzo_unitario: 28.00, note: 'SOTTO SCORTA — per antipasti VIP' },
      { categoria_id: ingId, nome: 'Parmigiano Reggiano 36 mesi', unita: 'kg', qta_attuale: 6, qta_minima: 3, qta_massima: 12, fornitore: 'Caseificio Val Padana', prezzo_unitario: 22.00, note: null },
    )
  }

  // ── TOVAGLIATI ────────────────────────────────────────────────────────────
  if (tovId) {
    prodotti.push(
      { categoria_id: tovId, nome: 'Tovaglioli di carta premium 33x33', unita: 'confezioni', qta_attuale: 20, qta_minima: 10, qta_massima: 50, fornitore: 'Carta & Tavola', prezzo_unitario: 4.50, note: '100 tovaglioli a confezione' },
      { categoria_id: tovId, nome: 'Tovaglioli tessuto bianchi', unita: 'pz', qta_attuale: 150, qta_minima: 80, qta_massima: 300, fornitore: 'Linea Tavola SRL', prezzo_unitario: 2.20, note: 'Lavaggio ogni 2 gg — monitorare giacenza' },
      { categoria_id: tovId, nome: 'Tovaglie bianche 140x180cm', unita: 'pz', qta_attuale: 40, qta_minima: 30, qta_massima: 80, fornitore: 'Linea Tavola SRL', prezzo_unitario: 8.00, note: null },
      { categoria_id: tovId, nome: 'Sottobicchieri di carta', unita: 'rotoli', qta_attuale: 8, qta_minima: 4, qta_massima: 20, fornitore: 'Carta & Tavola', prezzo_unitario: 6.00, note: null },
    )
  }

  // ── ACCESSORI ─────────────────────────────────────────────────────────────
  if (accId) {
    prodotti.push(
      { categoria_id: accId, nome: 'Candele da tavolo bianche', unita: 'pz', qta_attuale: 60, qta_minima: 30, qta_massima: 120, fornitore: 'Arredo Tavola', prezzo_unitario: 0.80, note: 'Solo cena — check giornaliero' },
      { categoria_id: accId, nome: 'Calici vino rosso cristallo', unita: 'pz', qta_attuale: 120, qta_minima: 60, qta_massima: 200, fornitore: 'Vetrerie Italia', prezzo_unitario: 4.50, note: 'Contare rotture settimanali' },
      { categoria_id: accId, nome: 'Calici vino bianco cristallo', unita: 'pz', qta_attuale: 90, qta_minima: 60, qta_massima: 180, fornitore: 'Vetrerie Italia', prezzo_unitario: 4.20, note: null },
      { categoria_id: accId, nome: 'Piatti fondi ceramica bianca', unita: 'pz', qta_attuale: 200, qta_minima: 100, qta_massima: 300, fornitore: 'Ceramiche Pro', prezzo_unitario: 6.50, note: null },
      { categoria_id: accId, nome: 'Set posate inox 18/10 (p.p.)', unita: 'pz', qta_attuale: 180, qta_minima: 80, qta_massima: 250, fornitore: 'Argenteria Professionale', prezzo_unitario: 3.80, note: 'Inventario mensile obbligatorio' },
    )
  }

  // ── ALTRO ─────────────────────────────────────────────────────────────────
  if (altroId) {
    prodotti.push(
      { categoria_id: altroId, nome: 'Ciotole acqua cani (varie misure)', unita: 'pz', qta_attuale: 8, qta_minima: 4, qta_massima: 15, fornitore: 'Pet Equipment', prezzo_unitario: 5.00, note: 'Per clienti pet-friendly — lavarle ogni uso' },
      { categoria_id: altroId, nome: 'Cibo secco per cani BIO', unita: 'kg', qta_attuale: 2, qta_minima: 3, qta_massima: 10, fornitore: 'PetBio Italia', prezzo_unitario: 8.50, note: 'SOTTO SCORTA — pet-friendly service' },
      { categoria_id: altroId, nome: 'Sacchetti per doggy bag biodegradabili', unita: 'confezioni', qta_attuale: 15, qta_minima: 5, qta_massima: 30, fornitore: 'EcoPackaging', prezzo_unitario: 3.20, note: null },
    )
  }

  const { data: ins, error: insErr } = await supabase.from('prodotti_economato').insert(prodotti).select('id')
  if (insErr) { console.error('ERRORE inserimento prodotti:', insErr.message); process.exit(1) }
  ok('prodotti_economato', ins.length)

  // Riepilogo scorte
  const sottoScorta = prodotti.filter(p => p.qta_attuale < p.qta_minima)
  console.log(`\n=== Economato Demo completato! ===`)
  console.log(`  Prodotti inseriti: ${ins.length}`)
  console.log(`  Sotto scorta: ${sottoScorta.length} (${sottoScorta.map(p => p.nome).join(', ')})`)
  console.log(`  Valore magazzino stimato: €${prodotti.reduce((s, p) => s + p.qta_attuale * (p.prezzo_unitario ?? 0), 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}\n`)
}

main().catch(e => { console.error('\nErrore fatale:', e.message); process.exit(1) })
