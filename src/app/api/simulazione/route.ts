import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─── Simulation config ────────────────────────────────────────────────────────
const GIORNI      = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
const GIORNO_MULT = [1.2, 0.5, 0.65, 0.75, 0.90, 1.45, 1.55]
const METEO       = ['Sereno ☀️', 'Nuvoloso ⛅', 'Pioggia 🌧️', 'Temporale ⛈️', 'Caldo afoso 🥵', 'Brezza marina 🌬️']
const METEO_MULT: Record<string, number> = {
  'Sereno ☀️': 1.2, 'Nuvoloso ⛅': 1.0, 'Pioggia 🌧️': 0.7,
  'Temporale ⛈️': 0.5, 'Caldo afoso 🥵': 1.1, 'Brezza marina 🌬️': 0.95,
}
const EVENTI_SPECIALI = [
  null, null, null, null,
  'Anniversario di coppia 💑', 'Compleanno VIP 🎂',
  'Gruppo aziendale 💼', 'Degustazione vini privata 🍷',
]
const CAMERIERI = ['Marco', 'Laura', 'Antonio', 'Federica', 'Simone']
const SLOT_ORARI = ['19:30', '20:00', '20:30', '21:00', '21:30', '22:00']
const SLOT_PESI  = [0.12, 0.25, 0.30, 0.18, 0.10, 0.05]
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
interface MenuItem { nome: string; cat: string; prezzo: number; allergene?: string }
const MENU_ITEMS: MenuItem[] = [
  { nome: 'Antipasto della casa',        cat: 'antipasti', prezzo: 12 },
  { nome: 'Carpaccio di branzino',       cat: 'antipasti', prezzo: 16 },
  { nome: 'Tartare di tonno',            cat: 'antipasti', prezzo: 18 },
  { nome: 'Frittura di gamberi',         cat: 'antipasti', prezzo: 14, allergene: 'crostacei' },
  { nome: 'Tagliatelle al ragù',         cat: 'primi',     prezzo: 14, allergene: 'glutine' },
  { nome: 'Spaghetti alle vongole',      cat: 'primi',     prezzo: 16, allergene: 'molluschi' },
  { nome: 'Risotto ai funghi porcini',   cat: 'primi',     prezzo: 15 },
  { nome: 'Gnocchi al tartufo',          cat: 'primi',     prezzo: 18, allergene: 'glutine' },
  { nome: "Paccheri all'astice",         cat: 'primi',     prezzo: 22, allergene: 'crostacei' },
  { nome: 'Branzino alla griglia',       cat: 'secondi',   prezzo: 24 },
  { nome: 'Tagliata di manzo',           cat: 'secondi',   prezzo: 26 },
  { nome: 'Grigliata mista di pesce',    cat: 'secondi',   prezzo: 28 },
  { nome: 'Costata di manzo 400g',       cat: 'secondi',   prezzo: 32 },
  { nome: 'Polpo alla brace',            cat: 'secondi',   prezzo: 22 },
  { nome: 'Tiramisù',                    cat: 'dolci',     prezzo: 7,  allergene: 'glutine' },
  { nome: 'Panna cotta ai frutti rossi', cat: 'dolci',     prezzo: 6,  allergene: 'lattosio' },
  { nome: 'Tortino al cioccolato caldo', cat: 'dolci',     prezzo: 8 },
  { nome: 'Vino della casa (calice)',    cat: 'vini',      prezzo: 5 },
  { nome: 'Bottiglia Sangiovese DOC',    cat: 'vini',      prezzo: 22 },
  { nome: 'Bottiglia Vermentino',        cat: 'vini',      prezzo: 24 },
  { nome: 'Champagne (bottiglia)',       cat: 'vini',      prezzo: 65 },
  { nome: 'Acqua minerale',             cat: 'bevande',   prezzo: 3 },
]

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// ─── GET — history ────────────────────────────────────────────────────────────
export async function GET() {
  const { data, error } = await admin
    .from('serate_simulate')
    .select('id,data,giorno_settimana,meteo,evento_speciale,coperti_totali,tavoli_serviti,no_show,revenue_totale,tempo_medio_servizio_min,cameriere_top,problemi,created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ data })
}

// ─── POST — run simulation with SSE streaming ─────────────────────────────────
export async function POST(_req: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(ctrl) {
      function send(emoji: string, msg: string, type = 'log') {
        const ts = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ type, emoji, msg, ts })}\n\n`))
      }

      try {
        // Setup
        const oggi   = new Date()
        const dayIdx = oggi.getDay()
        const meteo  = pick(METEO)
        const evento = pick(EVENTI_SPECIALI)
        const gMult  = GIORNO_MULT[dayIdx]
        const mMult  = METEO_MULT[meteo] ?? 1.0
        const eMult  = evento ? 1.35 : 1.0
        const dateStr = oggi.toISOString().split('T')[0]

        send('📅', `Giorno: ${GIORNI[dayIdx]} (×${gMult})`)
        await delay(80)
        send('🌤️', `Meteo: ${meteo} (×${mMult})`)
        await delay(80)
        send(evento ? '⭐' : '📋', evento ? `Evento: ${evento}` : 'Nessun evento speciale')
        await delay(80)

        const baseCoperti = rand(25, 45)
        const targetCoperti = Math.round(baseCoperti * gMult * mMult * eMult)

        // VIP from DB
        let vipNames: string[] = []
        try {
          const { data } = await admin.from('clienti')
            .select('nome,cognome,tier').in('tier', ['Platinum', 'Diamante']).limit(8)
          vipNames = (data ?? []).map((c: { nome: string; cognome: string }) => `${c.nome} ${c.cognome}`)
        } catch {}

        const totalTavoli = Math.max(4, Math.round(targetCoperti / 3.2))
        send('👥', `Tavoli previsti: ${totalTavoli} · Coperti stimati: ~${targetCoperti}`)
        await delay(100)

        interface Tavolo {
          num: number; slot: string; coperti: number;
          cameriere: string; nome: string; isVip: boolean;
          revenue: number; tempoMin: number; noShow?: boolean
        }

        const tavoli: Tavolo[] = []
        let tNum = 1
        for (let si = 0; si < SLOT_ORARI.length; si++) {
          const count = Math.max(1, Math.round(totalTavoli * SLOT_PESI[si]))
          for (let i = 0; i < count; i++) {
            const coperti = rand(2, 6)
            const isVip   = vipNames.length > 0 && Math.random() < 0.3
            const nome    = isVip ? pick(vipNames) : `${pick(NOMI)} ${pick(COGNOMI)}`
            tavoli.push({ num: tNum++, slot: SLOT_ORARI[si], coperti, cameriere: pick(CAMERIERI), nome, isVip, revenue: 0, tempoMin: rand(55, 95) })
          }
        }

        // Pick 2-4 problems
        type ProblemFn = (nome: string, t: Tavolo) => { tipo: string; msg: string }
        const PROBLEMI_POOL: ProblemFn[] = [
          (nome, t) => ({ tipo: 'no_show',  msg: `No-show: ${nome || t.nome} (${t.coperti} coperti). T${t.num} rilasciato.` }),
          (_, t)    => ({ tipo: 'allergia', msg: `⚠️ ALLERGIA: T${t.num} rivela allergia ai ${pick(['crostacei','lattosio','glutine'])} dopo aver ordinato. Piatto sostituito.` }),
          (_, t)    => ({ tipo: 'errore',   msg: `❌ ERRORE ${pick(CAMERIERI)}: servito piatto sbagliato al T${t.num}. Riordine in cucina (+12 min).` }),
          (_, t)    => ({ tipo: 'lento',    msg: `🐌 T${t.num} a tavola da 2h15. Attesa per prossima prenotazione.` }),
          (_, __)   => ({ tipo: 'esaurito', msg: `📛 Paccheri all'astice esauriti alle ${pick(['20:45','21:00'])}. Chef improvvisa piatto alternativo.` }),
          (_, t)    => ({ tipo: 'speciale', msg: `✨ Richiesta dieta vegana non comunicata al T${t.num}. Chef improvvisa ad hoc. Cliente entusiasta.` }),
        ]

        const numProblemi = rand(2, 4)
        const problemiIdx = new Set<number>()
        while (problemiIdx.size < numProblemi) problemiIdx.add(rand(0, PROBLEMI_POOL.length - 1))

        const noShowTavoli = new Set<number>()
        if (problemiIdx.has(0)) {
          const nonVip = tavoli.filter(t => !t.isVip)
          if (nonVip.length) noShowTavoli.add(pick(nonVip).num)
        }

        const revenuePerCameriere: Record<string, number> = {}
        CAMERIERI.forEach(c => { revenuePerCameriere[c] = 0 })

        // Calculate revenue per table
        for (const t of tavoli) {
          if (noShowTavoli.has(t.num)) { t.noShow = true; continue }
          let rev = 0
          for (let p = 0; p < t.coperti; p++) {
            rev += 2.5
            if (Math.random() < 0.70) rev += pick(MENU_ITEMS.filter(m => m.cat === 'antipasti')).prezzo
            if (Math.random() < 0.88) rev += pick(MENU_ITEMS.filter(m => m.cat === 'primi')).prezzo
            if (Math.random() < 0.92) rev += pick(MENU_ITEMS.filter(m => m.cat === 'secondi')).prezzo
            if (Math.random() < 0.48) rev += pick(MENU_ITEMS.filter(m => m.cat === 'dolci')).prezzo
            const wineRoll = Math.random()
            if (wineRoll < 0.25) rev += pick(MENU_ITEMS.filter(m => m.cat === 'vini' && m.prezzo > 10)).prezzo
            else if (wineRoll < 0.65) rev += 5 * Math.ceil(t.coperti / 2)
            rev += 3
          }
          if (t.isVip) rev = +(rev * 1.25).toFixed(2)
          if (evento && Math.random() < 0.4) rev += rand(15, 45)
          t.revenue = +rev.toFixed(2)
          revenuePerCameriere[t.cameriere] = +(revenuePerCameriere[t.cameriere] + rev).toFixed(2)
        }

        // Stream timeline
        let curSlot = ''
        const logSerata: { time: string; emoji: string; msg: string }[] = []

        for (const t of tavoli) {
          if (t.slot !== curSlot) {
            curSlot = t.slot
            send('🕐', `─── Slot ${t.slot} ───`)
            logSerata.push({ time: t.slot, emoji: '🕐', msg: `── Slot ${t.slot} ──` })
            await delay(150)
          }
          await delay(60)

          if (t.noShow) {
            send('🚫', `T${t.num} NO-SHOW: ${t.nome} (${t.coperti} coperti) — tavolo rilasciato`)
            logSerata.push({ time: t.slot, emoji: '🚫', msg: `No-show: ${t.nome} (${t.coperti} cop.)` })
          } else {
            const vipTag = t.isVip ? '★VIP ' : ''
            send(t.isVip ? '⭐' : '🪑', `T${t.num}: ${vipTag}${t.nome} · ${t.coperti} cop. · ${t.cameriere} · €${t.revenue}`)
            logSerata.push({ time: t.slot, emoji: t.isVip ? '⭐' : '🪑', msg: `T${t.num}: ${t.nome} (${t.coperti} cop.) → €${t.revenue}` })
          }
        }

        // Stream problems
        await delay(200)
        send('⚡', '─── Imprevisti di serata ───')
        const problemiMsgs: string[] = []

        for (const idx of problemiIdx) {
          if (idx === 0) continue
          const fakeTavolo = pick(tavoli.filter(t => !t.noShow))
          await delay(200)
          const { msg } = PROBLEMI_POOL[idx]('', fakeTavolo)
          send('⚡', msg)
          logSerata.push({ time: pick(SLOT_ORARI.slice(2)), emoji: '⚡', msg })
          problemiMsgs.push(msg)
        }

        const noShowCount = tavoli.filter(t => t.noShow).length
        if (noShowCount > 0) {
          const nsMsg = `${noShowCount} no-show nella serata`
          problemiMsgs.push(nsMsg)
        }

        // Stats
        const tavComp    = tavoli.filter(t => !t.noShow)
        const revTot     = +tavoli.reduce((s, t) => s + (t.revenue || 0), 0).toFixed(2)
        const copertiTot = tavComp.reduce((s, t) => s + t.coperti, 0)
        const tempoMedio = Math.round(tavComp.reduce((s, t) => s + t.tempoMin, 0) / Math.max(1, tavComp.length))
        const camerierTop = Object.entries(revenuePerCameriere).sort((a, b) => b[1] - a[1])[0][0]

        await delay(200)
        send('💶', `REVENUE TOTALE: €${revTot.toFixed(2)}`)
        send('👥', `Coperti serviti: ${copertiTot}`)
        send('⏱️', `Tempo medio servizio: ${tempoMedio} min`)
        send('🏆', `Cameriere top: ${camerierTop} (€${revenuePerCameriere[camerierTop].toFixed(2)})`)

        logSerata.push({ time: '22:30', emoji: '💶', msg: `Chiusura — €${revTot.toFixed(2)} · ${copertiTot} coperti · Top: ${camerierTop}` })

        // Save
        await delay(150)
        send('💾', 'Salvataggio diario su Supabase...')
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
          log_serata:               logSerata,
        }

        const { data: saved, error } = await admin.from('serate_simulate').insert(record).select().single()
        if (error) {
          send('❌', `Errore salvataggio: ${error.message}`)
        } else {
          send('✅', 'Diario serata salvato!')
          ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', record: saved ?? record })}\n\n`))
        }
      } catch (err) {
        ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', msg: String(err) })}\n\n`))
      } finally {
        ctrl.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
