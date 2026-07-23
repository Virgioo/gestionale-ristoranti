import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { ALLERGENI, stringifyAllergie } from '@/lib/allergeni'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Helpers generici ─────────────────────────────────────────────────────────
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function randFloat(min: number, max: number) {
  return Math.random() * (max - min) + min
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]
}
function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr]
  const out: T[] = []
  while (copy.length && out.length < n) {
    out.push(copy.splice(randInt(0, copy.length - 1), 1)[0])
  }
  return out
}
function round2(n: number) {
  return Math.round(n * 100) / 100
}
function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(d: Date, n: number) {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}
function timeSlot(isPranzo: boolean) {
  const [startH, startM, endH, endM] = isPranzo ? [12, 30, 14, 30] : [19, 30, 22, 0]
  const startMin = startH * 60 + startM
  const endMin = endH * 60 + endM
  const slots: number[] = []
  for (let m = startMin; m <= endMin; m += 15) slots.push(m)
  const m = pick(slots)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
function randPhone() {
  return `+39 3${randInt(10, 99)} ${randInt(1000000, 9999999)}`
}

// ── Dati anagrafici per walk-in ───────────────────────────────────────────────
const NOMI = [
  'Luca', 'Anna', 'Paolo', 'Sara', 'Marco', 'Giulia', 'Andrea', 'Roberta', 'Francesco', 'Monica',
  'Matteo', 'Laura', 'Simone', 'Elisa', 'Davide', 'Claudia', 'Massimo', 'Serena', 'Nicolò', 'Federica',
  'Stefano', 'Alessia', 'Giorgio', 'Vanessa', 'Fabio', 'Chiara', 'Alessandro', 'Valentina', 'Elena', 'Roberto',
]
const COGNOMI = [
  'Ferrari', 'Moretti', 'Greco', 'Fontana', 'Vitale', 'Serra', 'Costi', 'Pini', 'Riva', 'Gallo',
  'Bruno', 'Fiore', 'Leone', 'Caruso', 'Neri', 'Rosa', 'Fabbri', 'Gatti', 'Amato', 'Longo',
  'Villa', 'Russo', 'Costa', 'Dati', 'Rossi', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino',
]
const TIPI_TAVOLO = ['sala', 'terrazza', 'prive', 'esterno']
const ORIGINI = ['telefono', 'online', 'app', 'walk-in', 'booking', 'whatsapp']
const OCCASIONI = ['compleanno', 'anniversario', 'cena romantica', 'evento corporate']

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']

type Stagione = 'estate' | 'inverno' | 'altro'
function getStagione(mese: number): Stagione {
  if ([5, 6, 7].includes(mese)) return 'estate'
  if ([11, 0, 1].includes(mese)) return 'inverno'
  return 'altro'
}

interface Sede { id: string; nome: string; tipo: string | null }

function countPrenotazioni(dow: number, sede: Sede, stagione: Stagione): number {
  let min: number, max: number
  if (dow === 1 || dow === 2) [min, max] = [3, 5]
  else if (dow === 3 || dow === 4) [min, max] = [6, 9]
  else if (dow === 5 || dow === 6) [min, max] = [12, 18]
  else [min, max] = [8, 12] // domenica
  let mult = 1
  if (stagione === 'estate') {
    mult *= 1.3
    if (sede.tipo === 'Mare') mult *= 1.25
  } else if (stagione === 'inverno') {
    if (sede.tipo === 'Montagna') mult *= 1.45
    else if (sede.tipo === 'Mare') mult *= 0.6
  }
  return Math.max(1, Math.round(randInt(min, max) * mult))
}

function scontrinoRange(sede: Sede): [number, number] {
  if (sede.nome.includes('Rimini') || sede.nome.includes('Cortina')) return [120, 320]
  if (sede.nome.includes('Pesaro')) return [80, 200]
  return [90, 240]
}

interface ClienteVip { id: string; nome: string; cognome: string; telefono: string | null; sede_principale_id: string | null; data_nascita: string | null }

async function runDailySeed(trigger: 'cron' | 'manuale') {
  const log: string[] = []
  const now = new Date()
  const oggiStr = toISODate(now)
  const ieriStr = toISODate(addDays(now, -1))
  const dow = now.getDay()
  const mese = now.getMonth()
  const giornoNome = GIORNI[dow]
  const stagione = getStagione(mese)

  log.push(`Avvio seed per ${giornoNome} ${oggiStr} (stagione: ${stagione})`)

  const [{ data: sedi }, { data: clienti }, { data: prodotti }] = await Promise.all([
    admin.from('sedi').select('id,nome,tipo').eq('attiva', true),
    admin.from('clienti').select('id,nome,cognome,telefono,sede_principale_id,data_nascita').eq('attivo', true).limit(300),
    admin.from('prodotti_economato').select('id,nome,qta_attuale,qta_minima'),
  ])
  const sediList: Sede[] = sedi ?? []
  const clientiList: ClienteVip[] = clienti ?? []

  if (sediList.length === 0) {
    log.push('⚠️ Nessuna sede attiva trovata: seed interrotto.')
    return { data: oggiStr, giorno_settimana: giornoNome, stagione, trigger, prenotazioni_inserite: 0, no_show_aggiornati: 0, visite_inserite: 0, revenue_aggiunto: 0, notifiche_generate: 0, log }
  }

  // ── 1. Prenotazioni di oggi ────────────────────────────────────────────────
  const nuovePrenotazioni: Record<string, unknown>[] = []
  for (const sede of sediList) {
    const count = countPrenotazioni(dow, sede, stagione)
    for (let i = 0; i < count; i++) {
      const useVip = clientiList.length > 0 && Math.random() < 0.4
      const suoiClienti = useVip ? clientiList.filter(c => c.sede_principale_id === sede.id) : []
      const vip = useVip ? pick(suoiClienti.length ? suoiClienti : clientiList) : null
      const isPranzo = Math.random() < 0.3
      const nomeOspite = vip ? `${vip.nome} ${vip.cognome}` : `${pick(NOMI)} ${pick(COGNOMI)}`
      const telefono = vip ? vip.telefono : randPhone()
      const allergie = Math.random() < 0.2 ? stringifyAllergie(pickN(ALLERGENI.map(a => a.key), randInt(1, 2))) : null

      nuovePrenotazioni.push({
        sede_id: sede.id,
        cliente_id: vip?.id ?? null,
        nome_ospite: nomeOspite,
        telefono_ospite: telefono,
        data_prenotazione: oggiStr,
        ora_arrivo: timeSlot(isPranzo),
        coperti: randInt(1, vip ? 8 : 6),
        tipo_tavolo: pick(TIPI_TAVOLO),
        stato: Math.random() < 0.85 ? 'confermata' : 'in_attesa',
        allergie_comunicare: allergie,
        con_animale: Math.random() < 0.08,
        occasione_speciale: Math.random() < 0.1 ? pick(OCCASIONI) : null,
        origine: pick(ORIGINI),
      })
    }
    log.push(`📅 ${sede.nome}: ${count} prenotazioni generate per oggi`)
  }
  let prenotazioniInserite = 0
  if (nuovePrenotazioni.length > 0) {
    const { data: inserted, error } = await admin.from('prenotazioni').insert(nuovePrenotazioni).select('id')
    if (error) log.push(`❌ Errore inserimento prenotazioni: ${error.message}`)
    else prenotazioniInserite = inserted?.length ?? 0
  }
  log.push(`✅ ${prenotazioniInserite} prenotazioni totali inserite per oggi`)

  // ── 2. No-show casuali tra le prenotazioni di ieri ────────────────────────
  let noShowAggiornati = 0
  const { data: prenIeri } = await admin
    .from('prenotazioni').select('id')
    .eq('data_prenotazione', ieriStr).in('stato', ['confermata', 'in_attesa'])
  if (prenIeri && prenIeri.length > 0) {
    const scelti = pickN(prenIeri, randInt(1, 2))
    for (const p of scelti) {
      const { error } = await admin.from('prenotazioni').update({ stato: 'no_show' }).eq('id', p.id)
      if (!error) noShowAggiornati++
    }
    log.push(`🚫 ${noShowAggiornati} no-show applicati alle prenotazioni di ieri (${ieriStr})`)
  } else {
    log.push(`ℹ️ Nessuna prenotazione di ieri disponibile per generare no-show`)
  }

  // ── 3. Visite di ieri (revenue) ────────────────────────────────────────────
  let visiteInserite = 0
  let revenueAggiunto = 0
  if (clientiList.length > 0) {
    const nVisite = randInt(2, 3)
    const righeVisite: Record<string, unknown>[] = []
    for (let i = 0; i < nVisite; i++) {
      const c = pick(clientiList)
      const sede = (c.sede_principale_id && sediList.find(s => s.id === c.sede_principale_id)) || pick(sediList)
      const [min, max] = scontrinoRange(sede)
      const coperti = randInt(1, 6)
      const scontrinoBase = randFloat(min, max)
      const importo = round2(coperti * scontrinoBase * randFloat(0.85, 1.15))
      righeVisite.push({
        cliente_id: c.id,
        sede_id: sede.id,
        data_visita: ieriStr,
        servizio: Math.random() < 0.3 ? 'pranzo' : 'cena',
        coperti,
        tipo_tavolo: pick(TIPI_TAVOLO),
        importo: round2(importo),
        con_animale: Math.random() < 0.06,
      })
    }
    const { data: inserted, error } = await admin.from('visite').insert(righeVisite).select('importo')
    if (error) {
      log.push(`❌ Errore inserimento visite: ${error.message}`)
    } else {
      visiteInserite = inserted?.length ?? 0
      revenueAggiunto = round2((inserted ?? []).reduce((s: number, v: { importo: number }) => s + (v.importo ?? 0), 0))
      log.push(`💶 ${visiteInserite} visite inserite per ieri, revenue +€${revenueAggiunto.toFixed(2)}`)
    }
  } else {
    log.push('ℹ️ Nessun cliente in anagrafica: visite non generate (richiedono cliente_id)')
  }

  // ── 4. Notifiche ────────────────────────────────────────────────────────────
  let notificheGenerate = 0
  const settimanaFa = toISODate(addDays(now, -7))

  // 4a. Compleanni VIP entro 7 giorni
  for (const c of clientiList) {
    if (!c.data_nascita) continue
    const d = new Date(c.data_nascita + 'T00:00:00')
    const oggiMidnight = new Date(oggiStr + 'T00:00:00')
    let target = new Date(oggiMidnight.getFullYear(), d.getMonth(), d.getDate())
    if (target < oggiMidnight) target = new Date(oggiMidnight.getFullYear() + 1, d.getMonth(), d.getDate())
    const diffGiorni = Math.round((target.getTime() - oggiMidnight.getTime()) / 86_400_000)
    if (diffGiorni < 0 || diffGiorni > 7) continue

    const { data: esistenti } = await admin.from('notifiche').select('id')
      .eq('tipo', 'compleanno').eq('cliente_id', c.id).gte('created_at', settimanaFa)
    if (esistenti && esistenti.length > 0) continue

    const dataCompleanno = target.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
    const { error } = await admin.from('notifiche').insert({
      tipo: 'compleanno',
      titolo: `Compleanno VIP — ${c.nome} ${c.cognome} il ${dataCompleanno}`,
      messaggio: `${c.nome} ${c.cognome} festeggia il compleanno il ${dataCompleanno}. Valuta un piccolo omaggio o un tavolo dedicato.`,
      sede_id: c.sede_principale_id,
      cliente_id: c.id,
      letta: false,
    })
    if (error) log.push(`❌ Errore notifica compleanno per ${c.nome} ${c.cognome}: ${error.message}`)
    else { notificheGenerate++; log.push(`🎂 Notifica compleanno per ${c.nome} ${c.cognome}`) }
  }

  // 4b. Clienti a rischio abbandono (>45 giorni senza visita)
  const { data: clientiRischio } = await admin
    .from('clienti').select('id,nome,cognome,sede_principale_id,ultima_visita,giorni_inattivita')
    .eq('attivo', true)
    .or(`a_rischio.eq.true,giorni_inattivita.gt.45`)
    .limit(5)
  for (const c of clientiRischio ?? []) {
    const { data: esistenti } = await admin.from('notifiche').select('id')
      .eq('tipo', 'rischio_abbandono').eq('cliente_id', c.id).gte('created_at', settimanaFa)
    if (esistenti && esistenti.length > 0) continue

    const giorni = c.giorni_inattivita ?? '45+'
    const { error } = await admin.from('notifiche').insert({
      tipo: 'rischio_abbandono',
      titolo: `Cliente a rischio — ${c.cognome} inattivo da ${giorni} giorni`,
      messaggio: `${c.nome} ${c.cognome} non visita da ${giorni} giorni (ultima visita: ${c.ultima_visita ?? 'sconosciuta'}). Considerare una campagna di re-engagement.`,
      sede_id: c.sede_principale_id,
      cliente_id: c.id,
      letta: false,
    })
    if (error) log.push(`❌ Errore notifica rischio abbandono per ${c.nome} ${c.cognome}: ${error.message}`)
    else { notificheGenerate++; log.push(`⚠️ Notifica rischio abbandono per ${c.nome} ${c.cognome}`) }
  }

  // 4c. Alert scorte economato sotto soglia minima
  const sottoScorta = (prodotti ?? []).filter(p => p.qta_attuale < p.qta_minima)
  if (sottoScorta.length > 0) {
    const { data: esistenti } = await admin.from('notifiche').select('id')
      .eq('tipo', 'alert').gte('created_at', `${oggiStr}T00:00:00`)
    const giaNotificatoOggi = (esistenti ?? []).length > 0
    if (!giaNotificatoOggi) {
      const elenco = sottoScorta.slice(0, 6).map(p => p.nome).join(', ')
      const { error } = await admin.from('notifiche').insert({
        tipo: 'scorte_basse',
        titolo: `Scorte in esaurimento — ${sottoScorta.length} prodott${sottoScorta.length === 1 ? 'o' : 'i'} sotto soglia`,
        messaggio: `Prodotti sotto la scorta minima: ${elenco}${sottoScorta.length > 6 ? '…' : ''}. Programmare riordino.`,
        sede_id: null,
        cliente_id: null,
        letta: false,
      })
      if (error) log.push(`❌ Errore notifica scorte (${error.message}). Esegui la migration supabase/migrations/20260722_add_notifica_tipo_scorte.sql`)
      else { notificheGenerate++; log.push(`📦 Notifica scorte: ${sottoScorta.length} prodotti sotto soglia`) }
    }
  }

  log.push(`🔔 ${notificheGenerate} notifiche generate in totale`)

  // ── 5. Salva lo storico dell'esecuzione ────────────────────────────────────
  const risultato = {
    data: oggiStr,
    giorno_settimana: giornoNome,
    stagione,
    trigger,
    prenotazioni_inserite: prenotazioniInserite,
    no_show_aggiornati: noShowAggiornati,
    visite_inserite: visiteInserite,
    revenue_aggiunto: revenueAggiunto,
    notifiche_generate: notificheGenerate,
    log,
  }

  const { error: storicoError } = await admin.from('cron_runs').insert(risultato)
  if (storicoError) {
    log.push(`⚠️ Impossibile salvare lo storico in cron_runs (${storicoError.message}). Esegui la migration supabase/migrations/20260722_create_cron_runs.sql`)
  }

  return risultato
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Non autorizzato' }, { status: 401 })
  }
  try {
    const result = await runDailySeed('cron')
    return Response.json(result)
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}

// Trigger manuale dalla pagina /simulazione (accesso già filtrato lato UI agli admin)
export async function POST() {
  try {
    const result = await runDailySeed('manuale')
    return Response.json(result)
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
