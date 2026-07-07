/**
 * Simulazione serata completa — Scogliera di Rimini
 * Ogni esecuzione è diversa: giorno, meteo, evento, clienti, imprevisti.
 * Salva il "diario" su Supabase in serate_simulate.
 *
 * Uso: node scripts/simulate-live-service.mjs
 */

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

// ─── ANSI ─────────────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
  white: '\x1b[37m', gray: '\x1b[90m',
  bgGreen: '\x1b[42m', bgRed: '\x1b[41m', bgBlue: '\x1b[44m',
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

function fmt(emoji, color, msg) {
  const ts = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  console.log(`${C.gray}[${ts}]${C.reset} ${emoji}  ${color}${msg}${C.reset}`)
}
function section(title) {
  console.log('\n' + C.bold + C.cyan + '─'.repeat(60) + C.reset)
  console.log(C.bold + C.white + '  ' + title + C.reset)
  console.log(C.cyan + '─'.repeat(60) + C.reset)
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function randFloat(min, max) { return +(Math.random() * (max - min) + min).toFixed(2) }

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const GIORNI   = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
const GIORNO_MULT = [1.2, 0.5, 0.65, 0.75, 0.90, 1.45, 1.55]

const METEO = ['Sereno ☀️', 'Nuvoloso ⛅', 'Pioggia 🌧️', 'Temporale ⛈️', 'Caldo afoso 🥵', 'Brezza marina 🌬️']
const METEO_MULT = { 'Sereno ☀️': 1.2, 'Nuvoloso ⛅': 1.0, 'Pioggia 🌧️': 0.7, 'Temporale ⛈️': 0.5, 'Caldo afoso 🥵': 1.1, 'Brezza marina 🌬️': 0.95 }

const EVENTI_SPECIALI = [
  null, null, null, null,
  'Anniversario di coppia 💑',
  'Compleanno VIP 🎂',
  'Gruppo aziendale 💼',
  'Degustazione vini privata 🍷',
]

const CAMERIERI = ['Marco', 'Laura', 'Antonio', 'Federica', 'Simone']

const MENU_ITEMS = [
  { nome: 'Antipasto della casa',       cat: 'antipasti', prezzo: 12 },
  { nome: 'Carpaccio di branzino',      cat: 'antipasti', prezzo: 16 },
  { nome: 'Tartare di tonno',           cat: 'antipasti', prezzo: 18 },
  { nome: 'Frittura di gamberi',        cat: 'antipasti', prezzo: 14, allergene: 'crostacei' },
  { nome: 'Burrata con pomodorini',     cat: 'antipasti', prezzo: 12, allergene: 'lattosio' },
  { nome: 'Tagliatelle al ragù',        cat: 'primi',     prezzo: 14, allergene: 'glutine' },
  { nome: 'Spaghetti alle vongole',     cat: 'primi',     prezzo: 16, allergene: 'molluschi' },
  { nome: 'Risotto ai funghi porcini',  cat: 'primi',     prezzo: 15 },
  { nome: 'Gnocchi al tartufo',         cat: 'primi',     prezzo: 18, allergene: 'glutine' },
  { nome: "Paccheri all'astice",        cat: 'primi',     prezzo: 22, allergene: 'crostacei' },
  { nome: 'Branzino alla griglia',      cat: 'secondi',   prezzo: 24 },
  { nome: 'Tagliata di manzo',          cat: 'secondi',   prezzo: 26 },
  { nome: 'Grigliata mista di pesce',   cat: 'secondi',   prezzo: 28 },
  { nome: 'Costata di manzo 400g',      cat: 'secondi',   prezzo: 32 },
  { nome: 'Polpo alla brace',           cat: 'secondi',   prezzo: 22 },
  { nome: 'Tiramisù',                   cat: 'dolci',     prezzo: 7,  allergene: 'glutine' },
  { nome: 'Panna cotta ai frutti rossi',cat: 'dolci',     prezzo: 6,  allergene: 'lattosio' },
  { nome: 'Tortino al cioccolato caldo',cat: 'dolci',     prezzo: 8 },
  { nome: 'Vino della casa (calice)',   cat: 'vini',      prezzo: 5 },
  { nome: 'Bottiglia Sangiovese DOC',   cat: 'vini',      prezzo: 22 },
  { nome: 'Bottiglia Vermentino',       cat: 'vini',      prezzo: 24 },
  { nome: 'Champagne (bottiglia)',      cat: 'vini',      prezzo: 65 },
  { nome: 'Acqua minerale',             cat: 'bevande',   prezzo: 3 },
]

const NOMI = [
  'Marco','Luca','Chiara','Sofia','Francesco','Giulia','Andrea','Elena',
  'Roberto','Laura','Antonio','Valentina','Giovanni','Federica','Davide',
  'Matteo','Alessia','Simone','Martina','Lorenzo','Sara','Riccardo','Paola',
]
const COGNOMI = [
  'Rossi','Ferrari','Esposito','Bianchi','Romano','Colombo','Ricci','Marino',
  'Greco','Bruno','Gallo','Conti','De Luca','Costa','Mancini','Giordano',
  'Rizzo','Lombardi','Moretti','Barbieri','Fontana','Russo','Serra','Leone',
]

const SLOT_ORARI = ['19:30', '20:00', '20:30', '21:00', '21:30', '22:00']
const SLOT_PESI  = [0.12, 0.25, 0.30, 0.18, 0.10, 0.05]

const PROBLEMI_POOL = [
  (nome, t) => ({ tipo: 'no_show',   msg: `No-show: ${nome} (${t.coperti} coperti) non si è presentato. Tavolo ${t.num} rilasciato.` }),
  (nome, t) => ({ tipo: 'allergia',  msg: `⚠️ ALLERGIA: Cliente al T${t.num} rivela allergia ai ${pick(['crostacei','lattosio','glutine'])} dopo aver ordinato. Piatto sostituito in urgenza.` }),
  (nome, t) => ({ tipo: 'errore',    msg: `❌ ERRORE ${pick(CAMERIERI)}: servita tagliata al posto del branzino al T${t.num}. Riordine in cucina (+12 min).` }),
  (nome, t) => ({ tipo: 'lento',     msg: `🐌 T${t.num} (${t.coperti} coperti) a tavola da 2h15. Tavolo in coda per le ${pick(['21:00','21:30'])}.` }),
  (_,    t) => ({ tipo: 'esaurito',  msg: `📛 Esaurito: Paccheri all'astice terminati alle ${pick(['20:45','21:00'])}. T${t.num} riordina gnocchi al tartufo.` }),
  (_,    t) => ({ tipo: 'speciale',  msg: `✨ Richiesta dieta vegana non comunicata al T${t.num}. Chef improvvisa piatto ad hoc. Cliente entusiasta (+€8 mancia).` }),
]

// ─── CORE SIMULATION ──────────────────────────────────────────────────────────
async function runSimulation() {
  const logLines = []
  const oggi = new Date()
  const dayIdx  = oggi.getDay()
  const meteo   = pick(METEO)
  const evento  = pick(EVENTI_SPECIALI)
  const gMult   = GIORNO_MULT[dayIdx]
  const mMult   = METEO_MULT[meteo] ?? 1.0
  const eMult   = evento ? 1.35 : 1.0

  const baseCoperti = rand(25, 45)
  const targetCoperti = Math.round(baseCoperti * gMult * mMult * eMult)

  const dateStr = oggi.toISOString().split('T')[0]

  // VIP from DB (best effort)
  let vipNames = []
  try {
    const { data } = await supabase.from('clienti')
      .select('nome,cognome,tier').in('tier', ['Platinum', 'Diamante']).limit(8)
    vipNames = (data ?? []).map(c => `${c.nome} ${c.cognome}`)
  } catch {}

  // Build tables for the evening
  const totalTavoli = Math.max(4, Math.round(targetCoperti / 3.2))
  let tavoli = []
  let tNum = 1

  for (let si = 0; si < SLOT_ORARI.length; si++) {
    const count = Math.max(1, Math.round(totalTavoli * SLOT_PESI[si]))
    for (let i = 0; i < count; i++) {
      const coperti = rand(2, 6)
      const isVip   = vipNames.length > 0 && Math.random() < 0.3
      const nome    = isVip ? pick(vipNames) : `${pick(NOMI)} ${pick(COGNOMI)}`
      tavoli.push({
        num: tNum++, slot: SLOT_ORARI[si], coperti,
        cameriere: pick(CAMERIERI), nome, isVip,
        revenue: 0, tempoMin: rand(55, 95),
      })
    }
  }

  // Pick 2-4 problems
  const numProblemi = rand(2, 4)
  const problemiIdx = []
  while (problemiIdx.length < numProblemi) {
    const i = rand(0, PROBLEMI_POOL.length - 1)
    if (!problemiIdx.includes(i)) problemiIdx.push(i)
  }
  const noShowTavoli = new Set()
  if (problemiIdx.includes(0)) {
    // mark 1 tavolo as no-show
    const victim = pick(tavoli.filter(t => !t.isVip))
    if (victim) noShowTavoli.add(victim.num)
  }

  const revenuePerCameriere = {}
  CAMERIERI.forEach(c => { revenuePerCameriere[c] = 0 })

  // Simulate each table's order
  for (const t of tavoli) {
    if (noShowTavoli.has(t.num)) { t.noShow = true; continue }
    let rev = 0
    for (let p = 0; p < t.coperti; p++) {
      rev += 2.5 // coperto
      if (Math.random() < 0.70) rev += pick(MENU_ITEMS.filter(m => m.cat === 'antipasti')).prezzo
      if (Math.random() < 0.88) rev += pick(MENU_ITEMS.filter(m => m.cat === 'primi')).prezzo
      if (Math.random() < 0.92) rev += pick(MENU_ITEMS.filter(m => m.cat === 'secondi')).prezzo
      if (Math.random() < 0.48) rev += pick(MENU_ITEMS.filter(m => m.cat === 'dolci')).prezzo
      // Wine
      const wineRoll = Math.random()
      if (wineRoll < 0.25) rev += pick(MENU_ITEMS.filter(m => m.cat === 'vini' && m.prezzo > 10)).prezzo
      else if (wineRoll < 0.65) rev += 5 * Math.ceil(t.coperti / 2)
      rev += 3 // acqua
    }
    // VIP or evento premium boost
    if (t.isVip) rev = +(rev * 1.25).toFixed(2)
    if (evento && Math.random() < 0.4) rev += rand(15, 45) // extra drinks/dessert
    t.revenue = +rev.toFixed(2)
    revenuePerCameriere[t.cameriere] = +(revenuePerCameriere[t.cameriere] + rev).toFixed(2)
  }

  const tavComp = tavoli.filter(t => !t.noShow)
  const revTot  = +tavoli.reduce((s, t) => s + (t.revenue || 0), 0).toFixed(2)
  const copertiTot = tavComp.reduce((s, t) => s + t.coperti, 0)
  const noShowCount = tavoli.filter(t => t.noShow).length
  const tempoMedio = Math.round(
    tavComp.reduce((s, t) => s + t.tempoMin, 0) / Math.max(1, tavComp.length)
  )
  const camerierTop = Object.entries(revenuePerCameriere)
    .sort((a, b) => b[1] - a[1])[0][0]

  // ── PRINT SIMULATION ───────────────────────────────────────────────────────

  console.clear()
  console.log('\n' + C.bold + C.green)
  console.log('  ╔══════════════════════════════════════════════════════════╗')
  console.log('  ║       SIMULAZIONE SERATA — Scogliera di Rimini          ║')
  console.log('  ╚══════════════════════════════════════════════════════════╝')
  console.log(C.reset)
  await sleep(300)

  section(`CONTESTO — ${GIORNI[dayIdx]} ${dateStr}`)
  await sleep(200)
  fmt('📅', C.white,    `Giorno: ${C.bold}${GIORNI[dayIdx]}${C.reset} (moltiplicatore ×${gMult})`)
  await sleep(150)
  fmt('🌤️', C.yellow,   `Meteo: ${C.bold}${meteo}${C.reset} (×${mMult})`)
  await sleep(150)
  if (evento) {
    fmt('⭐', C.magenta, `Evento speciale: ${C.bold}${evento}${C.reset} (+35% revenue, +35% coperti)`)
  } else {
    fmt('📋', C.gray,   'Nessun evento speciale stanotte')
  }
  await sleep(150)
  fmt('👥', C.cyan,     `Coperti previsti: ~${targetCoperti}  ·  Tavoli in lista: ${tavoli.length}`)
  await sleep(300)

  logLines.push({ time: SLOT_ORARI[0], emoji: '📅', msg: `${GIORNI[dayIdx]} · ${meteo}${evento ? ' · ' + evento : ''}` })

  // Simulate slots
  let currentSlot = null
  for (const t of tavoli) {
    if (t.slot !== currentSlot) {
      currentSlot = t.slot
      section(`ORE ${currentSlot}`)
      await sleep(400)
      logLines.push({ time: currentSlot, emoji: '🕐', msg: `── Slot ${currentSlot} ──` })
    }

    await sleep(120)

    if (t.noShow) {
      const prob = PROBLEMI_POOL[0](t.nome, t)
      fmt('🚫', C.red, `T${t.num} NO-SHOW: ${t.nome} (${t.coperti} coperti) — tavolo rilasciato`)
      logLines.push({ time: t.slot, emoji: '🚫', msg: prob.msg })
      continue
    }

    const marker = t.isVip ? C.magenta + '★VIP ' : C.gray
    fmt('🪑', marker, `T${t.num}: ${C.bold}${t.nome}${C.reset} · ${t.coperti} coperti · ${t.cameriere} · ${C.green}€${t.revenue}${C.reset}`)
    logLines.push({ time: t.slot, emoji: t.isVip ? '⭐' : '🪑', msg: `T${t.num}: ${t.nome} (${t.coperti} cop.) → €${t.revenue}` })
  }

  // Problems
  section('IMPREVISTI DI SERATA')
  await sleep(300)

  const problemiMsgs = []
  for (const idx of problemiIdx) {
    if (idx === 0) continue // no-show already handled
    const fakeTavolo = pick(tavoli.filter(t => !t.noShow))
    await sleep(300)
    const { msg } = PROBLEMI_POOL[idx]('', fakeTavolo)
    fmt('⚡', C.yellow, msg)
    logLines.push({ time: pick(SLOT_ORARI.slice(2)), emoji: '⚡', msg })
    problemiMsgs.push(msg)
  }
  if (noShowCount > 0) {
    const nsMsg = `${noShowCount} no-show nelle prenotazioni della serata`
    problemiMsgs.push(nsMsg)
  }

  // Summary
  section('CHIUSURA & RIEPILOGO')
  await sleep(400)
  fmt('✅', C.green, `Tavoli serviti:   ${C.bold}${tavComp.length}${C.reset}/${tavoli.length}`)
  await sleep(120)
  fmt('👥', C.cyan,  `Coperti totali:   ${C.bold}${copertiTot}${C.reset}`)
  await sleep(120)
  fmt('🚫', C.red,   `No-show:          ${C.bold}${noShowCount}${C.reset}`)
  await sleep(120)
  fmt('⏱️', C.yellow,`Tempo medio svc:  ${C.bold}${tempoMedio} min${C.reset}`)
  await sleep(120)

  const revColor = revTot >= 5000 ? C.green : revTot >= 3000 ? C.yellow : C.red
  fmt('💶', revColor, `REVENUE TOTALE:   ${C.bold}€${revTot.toFixed(2)}${C.reset}`)
  await sleep(200)
  fmt('🏆', C.magenta,`Cameriere top:    ${C.bold}${camerierTop}${C.reset} (€${revenuePerCameriere[camerierTop].toFixed(2)})`)
  await sleep(300)

  logLines.push({ time: '22:30', emoji: '💶', msg: `Chiusura — Revenue: €${revTot.toFixed(2)} · Coperti: ${copertiTot} · Top: ${camerierTop}` })

  // Save to Supabase
  console.log('\n' + C.bold + C.cyan + '  Salvataggio diario su Supabase...' + C.reset)
  const record = {
    data:                     dateStr,
    giorno_settimana:         GIORNI[dayIdx],
    meteo,
    evento_speciale:          evento,
    coperti_totali:           copertiTot,
    tavoli_serviti:           tavComp.length,
    no_show:                  noShowCount,
    revenue_totale:           revTot,
    tempo_medio_servizio_min: tempoMedio,
    cameriere_top:            camerierTop,
    problemi:                 problemiMsgs,
    log_serata:               logLines,
  }
  const { error } = await supabase.from('serate_simulate').insert(record)
  if (error) {
    fmt('❌', C.red, `Errore salvataggio: ${error.message}`)
  } else {
    fmt('💾', C.green, 'Diario serata salvato in serate_simulate ✓')
  }

  console.log('\n' + C.bold + C.bgGreen + '                                                    ' + C.reset)
  console.log(C.bold + C.bgGreen + `   SERATA COMPLETATA — ${new Date().toLocaleTimeString('it-IT')}   ` + C.reset)
  console.log(C.bold + C.bgGreen + '                                                    ' + C.reset + '\n')

  return record
}

// ─── ENTRY POINT ──────────────────────────────────────────────────────────────
runSimulation().catch(err => {
  console.error('\x1b[31mErrore fatale:\x1b[0m', err)
  process.exit(1)
})
