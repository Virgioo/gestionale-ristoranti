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

// Genera gli ultimi 7 giorni (incluso oggi)
function getLast7Days() {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function dayOfWeek(dateStr) {
  return new Date(dateStr + 'T12:00:00').getDay() // 0=dom,6=sab
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function randFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

// Quanto sono "pesanti" i giorni della settimana (0=dom..6=sab)
const PESO_GIORNO = [0.9, 0.5, 0.6, 0.7, 0.85, 1.0, 0.95]

async function main() {
  const giorni = getLast7Days()
  console.log('\n=== Seed 7 Giorni ===')
  console.log('Periodo:', giorni[0], '→', giorni[giorni.length - 1])
  console.log('(I dati esistenti NON vengono cancellati)\n')

  // ── Recupera sedi esistenti ──────────────────────────────────────────────
  const { data: sedi, error: sediErr } = await supabase
    .from('sedi').select('id, nome, colore_hex').eq('attiva', true)
  if (sediErr || !sedi?.length) {
    console.error('ERRORE: nessuna sede trovata. Esegui seed-demo.mjs prima.')
    process.exit(1)
  }
  console.log(`Sedi trovate: ${sedi.map(s => s.nome).join(', ')}\n`)

  // ── Recupera clienti esistenti ───────────────────────────────────────────
  const { data: clienti } = await supabase
    .from('clienti').select('id, nome, cognome, sede_principale_id, allergie, telefono')
  const clientiList = clienti ?? []
  console.log(`Clienti trovati: ${clientiList.length}\n`)

  // ── PRENOTAZIONI ─────────────────────────────────────────────────────────
  console.log('Prenotazioni (7 giorni)...')

  const ORE_PRANZO = ['12:00', '12:30', '13:00', '13:30', '14:00']
  const ORE_CENA   = ['19:30', '20:00', '20:30', '21:00', '21:30']
  const TIPI_TAVOLO = ['sala', 'terrazza', 'prive', 'esterno']
  const ORIGINI = ['telefono', 'online', 'app', 'walk-in', 'booking']
  const OCCASIONI = [null, null, null, 'compleanno', 'anniversario', 'business', 'romantica']

  const NOMI_OSPITI = [
    'Luca Ferrari', 'Anna Moretti', 'Paolo Greco', 'Sara Fontana', 'Marco Vitale',
    'Giulia Serra', 'Andrea Costi', 'Roberta Pini', 'Francesco Riva', 'Monica Gallo',
    'Matteo Bruno', 'Laura Fiore', 'Simone Leone', 'Elisa Caruso', 'Davide Neri',
    'Claudia Rosa', 'Massimo Fabbri', 'Serena Gatti', 'Nicolò Amato', 'Federica Longo',
    'Stefano Villa', 'Alessia Russo', 'Giorgio Costa', 'Vanessa Dati', 'Fabio Greco',
  ]

  const ALLERGIE_OPTIONS = [null, null, null, null, 'glutine', 'crostacei', 'lattosio', 'frutta a guscio']

  const allPrenotazioni = []

  for (const data of giorni) {
    const dow = dayOfWeek(data)
    const peso = PESO_GIORNO[dow]
    const isWeekend = dow === 0 || dow === 5 || dow === 6

    for (const sede of sedi) {
      // Numero base di prenotazioni: 3-7 nei giorni feriali, 5-10 weekend
      const nBase = isWeekend ? randInt(5, 10) : randInt(3, 7)
      const n = Math.round(nBase * peso)

      for (let i = 0; i < n; i++) {
        const isPranzo = Math.random() < 0.35
        const ora_arrivo = isPranzo ? pick(ORE_PRANZO) : pick(ORE_CENA)

        // Stato: la maggior parte confermata, qualche no-show/cancellata
        let stato
        const r = Math.random()
        if (r < 0.65)       stato = 'confermata'
        else if (r < 0.78)  stato = 'completata'
        else if (r < 0.87)  stato = 'in_attesa'
        else if (r < 0.93)  stato = 'no_show'
        else                stato = 'cancellata'

        // Cliente VIP o ospite anonimo
        const useCliente = Math.random() < 0.3 && clientiList.length > 0
        const cliente = useCliente ? pick(clientiList.filter(c =>
          c.sede_principale_id === sede.id || Math.random() < 0.3
        ) || clientiList) : null

        const nomeOspite = cliente
          ? `${cliente.nome} ${cliente.cognome}`
          : pick(NOMI_OSPITI)

        const allergie = cliente?.allergie ?? pick(ALLERGIE_OPTIONS)

        allPrenotazioni.push({
          sede_id:              sede.id,
          cliente_id:           cliente?.id ?? null,
          nome_ospite:          nomeOspite,
          telefono_ospite:      cliente?.telefono ?? `+39 3${randInt(10,99)} ${randInt(1000000,9999999)}`,
          data_prenotazione:    data,
          ora_arrivo:           ora_arrivo + ':00',
          coperti:              randInt(1, isWeekend ? 8 : 6),
          tipo_tavolo:          pick(TIPI_TAVOLO),
          stato,
          note_speciali:        Math.random() < 0.2 ? pick(['Seggiolino bambini', 'Tavolo vicino finestra', 'Musica bassa', 'Nessun tavolo vicino alla cucina']) : null,
          allergie_comunicare:  allergie,
          con_animale:          Math.random() < 0.08,
          origine:              pick(ORIGINI),
          occasione_speciale:   pick(OCCASIONI),
        })
      }
    }
  }

  // Inserisce a batch per evitare payload troppo grandi
  let totPren = 0
  for (let i = 0; i < allPrenotazioni.length; i += 50) {
    const batch = allPrenotazioni.slice(i, i + 50)
    const { data: ins, error } = await supabase.from('prenotazioni').insert(batch).select('id')
    if (error) console.error(`  ERRORE prenotazioni batch ${i}:`, error.message)
    else totPren += ins.length
  }
  ok('prenotazioni', totPren)

  // ── VISITE (revenue) ──────────────────────────────────────────────────────
  console.log('\nVisite/Revenue (7 giorni)...')

  const SERVIZI = ['pranzo', 'cena', 'brunch']
  const TIPI_VISITA = ['sala', 'terrazza', 'prive', 'esterno']

  // Scontrino medio per sede (più alto a Rimini e Cortina)
  const SCONTRINO_SEDE = {}
  sedi.forEach((s, idx) => {
    if (s.nome.includes('Rimini') || s.nome.includes('Cortina')) {
      SCONTRINO_SEDE[s.id] = [120, 320]
    } else if (s.nome.includes('Pesaro')) {
      SCONTRINO_SEDE[s.id] = [80, 200]
    } else {
      SCONTRINO_SEDE[s.id] = [90, 240]
    }
  })

  const allVisite = []

  for (const data of giorni) {
    const dow = dayOfWeek(data)
    const peso = PESO_GIORNO[dow]
    const isWeekend = dow === 0 || dow === 5 || dow === 6

    for (const sede of sedi) {
      const nBase = isWeekend ? randInt(4, 9) : randInt(2, 5)
      const n = Math.round(nBase * peso)
      const [minSc, maxSc] = SCONTRINO_SEDE[sede.id] ?? [90, 200]

      for (let i = 0; i < n; i++) {
        const isPranzo = Math.random() < 0.3
        const coperti = randInt(1, isWeekend ? 8 : 5)

        // visite richiede sempre un cliente_id (NOT NULL nel DB)
        const cliente = clientiList.length > 0 ? pick(clientiList) : null
        if (!cliente) continue

        // Importo = coperti × scontrino ± variazione
        const scontrinoBase = randFloat(minSc, maxSc, 0)
        const importo = parseFloat((coperti * scontrinoBase * randFloat(0.85, 1.15, 2)).toFixed(2))

        allVisite.push({
          sede_id:    sede.id,
          cliente_id: cliente.id,
          data_visita: data,
          servizio:    isPranzo ? 'pranzo' : pick(['cena', 'cena', 'cena']),
          coperti,
          tipo_tavolo: pick(TIPI_VISITA),
          importo,
          con_animale: Math.random() < 0.06,
          note: Math.random() < 0.1 ? pick(['Ottima serata', 'Cliente soddisfatto', 'Ha ordinato menu degustazione', 'Vino costoso']) : null,
        })
      }
    }
  }

  let totVisite = 0
  for (let i = 0; i < allVisite.length; i += 50) {
    const batch = allVisite.slice(i, i + 50)
    const { data: ins, error } = await supabase.from('visite').insert(batch).select('id')
    if (error) console.error(`  ERRORE visite batch ${i}:`, error.message)
    else totVisite += ins.length
  }
  ok('visite', totVisite)

  // ── NOTIFICHE ─────────────────────────────────────────────────────────────
  console.log('\nNotifiche...')

  const oggi = giorni[giorni.length - 1]
  const ieri  = giorni[giorni.length - 2]

  const s1 = sedi[0]?.id
  const s2 = sedi[1]?.id
  const s3 = sedi[2]?.id

  const cVip = clientiList.find(c => c.allergie === 'glutine') ?? clientiList[0]
  const cDiamante = clientiList.find(c => (c.nome + ' ' + c.cognome).includes('Ricci')) ?? clientiList[1]
  const cRischio  = clientiList.find(c => c.a_rischio) ?? clientiList[2]

  const notifiche = [
    {
      tipo: 'allergia',
      titolo: `ALLERGIA — ${cVip ? cVip.nome + ' ' + cVip.cognome : 'Cliente'} stasera in prive`,
      messaggio: `Attenzione: ${cVip ? cVip.nome + ' ' + cVip.cognome : 'cliente'} ha allergia accertata (${cVip?.allergie ?? 'glutine'}). Avvisare cucina e usare stoviglie dedicate.`,
      sede_id: s1 ?? null,
      cliente_id: cVip?.id ?? null,
      letta: false,
    },
    {
      tipo: 'prenotazione',
      titolo: `${allPrenotazioni.filter(p => p.data_prenotazione === oggi && p.stato === 'confermata').length} prenotazioni confermate per oggi ${oggi}`,
      messaggio: `Totale coperture oggi in tutte le sedi: ${allPrenotazioni.filter(p => p.data_prenotazione === oggi && p.stato === 'confermata').reduce((a, p) => a + p.coperti, 0)} coperti confermati.`,
      sede_id: null,
      cliente_id: null,
      letta: false,
    },
    {
      tipo: 'rischio_abbandono',
      titolo: `Cliente a rischio — ${cRischio ? cRischio.nome + ' ' + cRischio.cognome : 'Cliente'} inattivo`,
      messaggio: `${cRischio ? cRischio.nome + ' ' + cRischio.cognome : 'Cliente'} non si vede da molto tempo. Considerare campagna di re-engagement personalizzata.`,
      sede_id: s2 ?? null,
      cliente_id: cRischio?.id ?? null,
      letta: false,
    },
    {
      tipo: 'prenotazione',
      titolo: `No-show registrato ieri (${ieri})`,
      messaggio: `${allPrenotazioni.filter(p => p.data_prenotazione === ieri && p.stato === 'no_show').length} no-show registrati ieri. Considerare policy deposito anticipato per i prossimi weekend.`,
      sede_id: null,
      cliente_id: null,
      letta: false,
    },
    {
      tipo: 'prenotazione',
      titolo: 'Simulazione 7 giorni completata',
      messaggio: `Inseriti dati realistici per il periodo ${giorni[0]} → ${oggi}: ${totPren} prenotazioni, ${totVisite} visite/revenue, notifiche miste.`,
      sede_id: null,
      cliente_id: null,
      letta: false,
    },
    {
      tipo: 'compleanno',
      titolo: `Compleanni in arrivo questa settimana`,
      messaggio: `Verifica clienti VIP con compleanno nei prossimi 7 giorni e prepara sorprese personalizzate.`,
      sede_id: s1 ?? null,
      cliente_id: null,
      letta: false,
    },
    {
      tipo: 'anniversario',
      titolo: `Revenue week in aumento`,
      messaggio: `Ottima settimana: ${allVisite.reduce((a, v) => a + v.importo, 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} incassati in 7 giorni su ${sedi.length} sedi.`,
      sede_id: null,
      cliente_id: null,
      letta: true,
    },
  ]

  const { data: notifIns, error: notifErr } = await supabase.from('notifiche').insert(notifiche).select('id')
  if (notifErr) console.error('  ERRORE notifiche:', notifErr.message)
  else ok('notifiche', notifIns.length)

  // ── RIEPILOGO ─────────────────────────────────────────────────────────────
  const revTot = allVisite.reduce((a, v) => a + v.importo, 0)
  const noShow = allPrenotazioni.filter(p => p.stato === 'no_show').length
  const cancellate = allPrenotazioni.filter(p => p.stato === 'cancellata').length

  console.log('\n=== Seed 7 Giorni completato! ===')
  console.log(`  Periodo:       ${giorni[0]} → ${oggi}`)
  console.log(`  Sedi:          ${sedi.length}`)
  console.log(`  Prenotazioni:  ${totPren}  (no-show: ${noShow}, cancellate: ${cancellate})`)
  console.log(`  Visite:        ${totVisite}`)
  console.log(`  Revenue 7gg:   ${revTot.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}`)
  console.log(`  Notifiche:     ${notifIns?.length ?? 0}  (${notifiche.filter(n => !n.letta).length} non lette)\n`)
}

main().catch(e => { console.error('\nErrore fatale:', e.message); process.exit(1) })
