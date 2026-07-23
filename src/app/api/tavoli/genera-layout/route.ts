import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const MARGIN = 20
const MIN_DIST = 80

interface Pt { x: number; y: number }
interface SedeInput { nome: string; tipo: string | null }
interface SalaInput { nome: string; larghezza_metri: number | null; altezza_metri: number | null; punti_poligono: Pt[] | null }
interface FormInput {
  numTavoli: number
  mix: { due: number; quattro: number; seiPiu: number }
  speciali: string[]
  layoutPref: 'classico' | 'dinamico' | 'massimizza'
  note: string
}
interface Body { sede: SedeInput; sala: SalaInput; canvas?: { w: number; h: number }; form: FormInput }

type Forma = 'rotondo' | 'rettangolare' | 'ovale' | 'quadrato'
const FORME_VALIDE: Forma[] = ['rotondo', 'rettangolare', 'ovale', 'quadrato']

interface ManifestItem { capienza: number; forma: Forma; larghezza: number; altezza: number; speciale?: string }
interface TavoloOut { nome: string; forma: string; capienza: number; larghezza: number; altezza: number; pos_x: number; pos_y: number; rotazione: number; note: string | null }

const SPECIALE_INFO: Record<string, { capienza: number; larghezza: number; altezza: number; forma: Forma; label: string; hint: string }> = {
  romantico_angolo: { capienza: 2, larghezza: 60, altezza: 60, forma: 'rotondo', label: 'romantico', hint: 'Tavolo romantico: posizionato in un angolo appartato della sala.' },
  chef_table: { capienza: 6, larghezza: 140, altezza: 90, forma: 'rettangolare', label: "chef's table", hint: "Chef's table: posizione di rilievo, punto focale della sala." },
  bancone: { capienza: 4, larghezza: 200, altezza: 50, forma: 'rettangolare', label: 'bancone', hint: 'Bancone: addossato a una parete lunga della sala.' },
  prive: { capienza: 4, larghezza: 110, altezza: 90, forma: 'rettangolare', label: 'privé', hint: 'Tavolo privé: appartato, separato dal flusso principale della sala.' },
  lungo_sociale: { capienza: 10, larghezza: 240, altezza: 90, forma: 'rettangolare', label: 'tavolo sociale', hint: 'Tavolo lungo sociale/comunitario: posizionato in fondo alla sala.' },
}

const LAYOUT_HINT: Record<FormInput['layoutPref'], string> = {
  classico: 'Disposizione CLASSICA: tavoli in file ordinate e regolari, come una griglia classica da ristorante.',
  dinamico: 'Disposizione DINAMICA: gruppi misti e organici, meno a griglia, più naturale e vario.',
  massimizza: 'MASSIMIZZA LO SPAZIO: incastra il maggior numero possibile di tavoli, riducendo al minimo gli spazi vuoti, rispettando comunque la distanza minima di sicurezza.',
}

function isTerrazza(nome: string) { return /terrazza|estern|giardino|dehor|veranda/i.test(nome) }

function sizeFor(capienza: number): { larghezza: number; altezza: number; forma: Forma } {
  if (capienza <= 2) return { larghezza: 60, altezza: 60, forma: 'rotondo' }
  if (capienza <= 4) return { larghezza: 80, altezza: 80, forma: 'rotondo' }
  if (capienza <= 6) return { larghezza: 120, altezza: 80, forma: 'rettangolare' }
  if (capienza <= 8) return { larghezza: 160, altezza: 90, forma: 'rettangolare' }
  return { larghezza: 220, altezza: 90, forma: 'rettangolare' }
}

function buildManifest(form: FormInput): ManifestItem[] {
  const nTotal = Math.max(1, Math.round(form.numTavoli) || 1)
  const totMix = form.mix.due + form.mix.quattro + form.mix.seiPiu || 100
  const nDue = Math.round((nTotal * form.mix.due) / totMix)
  const nQuattro = Math.round((nTotal * form.mix.quattro) / totMix)
  const nSeiPiu = Math.max(0, nTotal - nDue - nQuattro)

  const manifest: ManifestItem[] = []
  for (let i = 0; i < nDue; i++) manifest.push({ capienza: 2, ...sizeFor(2) })
  for (let i = 0; i < nQuattro; i++) manifest.push({ capienza: 4, ...sizeFor(4) })
  for (let i = 0; i < nSeiPiu; i++) {
    const cap = i % 2 === 0 ? 6 : 8
    manifest.push({ capienza: cap, ...sizeFor(cap) })
  }
  for (const key of form.speciali ?? []) {
    const info = SPECIALE_INFO[key]
    if (!info) continue
    manifest.push({ capienza: info.capienza, forma: info.forma, larghezza: info.larghezza, altezza: info.altezza, speciale: key })
  }
  return manifest
}

function assignNomi(manifest: ManifestItem[], salaNome: string): string[] {
  const prefix = isTerrazza(salaNome) ? 'TR' : 'T'
  let n = 1
  return manifest.map(() => `${prefix}${n++}`)
}

// ── Geometria ─────────────────────────────────────────────────────────────
function pointInPolygon(pt: Pt, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y
    const xj = poly[j].x, yj = poly[j].y
    const intersect = (yi > pt.y) !== (yj > pt.y) && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function polygonBounds(poly: Pt[]) {
  const xs = poly.map(p => p.x), ys = poly.map(p => p.y)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

function rectDistance(a: { pos_x: number; pos_y: number; larghezza: number; altezza: number }, b: typeof a): number {
  const ax1 = a.pos_x, ay1 = a.pos_y, ax2 = a.pos_x + a.larghezza, ay2 = a.pos_y + a.altezza
  const bx1 = b.pos_x, by1 = b.pos_y, bx2 = b.pos_x + b.larghezza, by2 = b.pos_y + b.altezza
  const dx = Math.max(bx1 - ax2, ax1 - bx2, 0)
  const dy = Math.max(by1 - ay2, ay1 - by2, 0)
  return Math.hypot(dx, dy)
}

function clampToCanvas(t: { pos_x: number; pos_y: number; larghezza: number; altezza: number }, canvas: { w: number; h: number }) {
  t.pos_x = Math.min(Math.max(t.pos_x, MARGIN), Math.max(MARGIN, canvas.w - MARGIN - t.larghezza))
  t.pos_y = Math.min(Math.max(t.pos_y, MARGIN), Math.max(MARGIN, canvas.h - MARGIN - t.altezza))
}

function posizioneValida(
  t: { pos_x: number; pos_y: number; larghezza: number; altezza: number },
  piazzati: TavoloOut[], poligono: Pt[] | null, canvas: { w: number; h: number }
): boolean {
  if (t.pos_x < MARGIN || t.pos_y < MARGIN) return false
  if (t.pos_x + t.larghezza > canvas.w - MARGIN || t.pos_y + t.altezza > canvas.h - MARGIN) return false
  if (poligono) {
    const center = { x: t.pos_x + t.larghezza / 2, y: t.pos_y + t.altezza / 2 }
    if (!pointInPolygon(center, poligono)) return false
  }
  for (const p of piazzati) if (rectDistance(t, p) < MIN_DIST) return false
  return true
}

/** Cerca la posizione valida più vicina a quella desiderata: prima la desiderata stessa,
 *  poi una ricerca a spirale attorno ad essa, infine una scansione a griglia esaustiva
 *  della sala. Ritorna null se non esiste alcuna posizione valida (sala satura). */
function trovaPosizione(
  desiderata: { pos_x: number; pos_y: number; larghezza: number; altezza: number },
  piazzati: TavoloOut[], poligono: Pt[] | null, bounds: { minX: number; minY: number; maxX: number; maxY: number }, canvas: { w: number; h: number }
): { pos_x: number; pos_y: number } | null {
  const base = { ...desiderata }
  clampToCanvas(base, canvas)
  if (posizioneValida(base, piazzati, poligono, canvas)) return { pos_x: base.pos_x, pos_y: base.pos_y }

  for (let radius = 24; radius <= 900; radius += 24) {
    const steps = Math.max(10, Math.floor(radius / 8))
    for (let k = 0; k < steps; k++) {
      const angle = (k / steps) * Math.PI * 2
      const cand = { ...desiderata, pos_x: desiderata.pos_x + Math.cos(angle) * radius, pos_y: desiderata.pos_y + Math.sin(angle) * radius }
      clampToCanvas(cand, canvas)
      if (posizioneValida(cand, piazzati, poligono, canvas)) return { pos_x: cand.pos_x, pos_y: cand.pos_y }
    }
  }

  const step = 30
  for (let y = bounds.minY; y <= bounds.maxY - desiderata.altezza; y += step) {
    for (let x = bounds.minX; x <= bounds.maxX - desiderata.larghezza; x += step) {
      const cand = { ...desiderata, pos_x: x, pos_y: y }
      if (posizioneValida(cand, piazzati, poligono, canvas)) return { pos_x: x, pos_y: y }
    }
  }
  return null
}

/** STEP 3 — valida la disposizione proposta e corregge automaticamente eventuali problemi
 *  (fuori dai confini della sala, tavoli troppo vicini), senza interpellare l'utente.
 *  Piazza i tavoli uno alla volta nell'ordine ricevuto: ogni nuovo tavolo viene verificato
 *  contro tutti quelli già piazzati, così i vincoli non vengono mai violati per costruzione
 *  (a differenza di un aggiustamento simultaneo, che può oscillare senza convergere). */
function validateAndFix(
  proposta: TavoloOut[], poligono: Pt[] | null, canvas: { w: number; h: number }
): { tavoli: TavoloOut[]; warnings: string[] } {
  const bounds = poligono ? polygonBounds(poligono) : { minX: MARGIN, minY: MARGIN, maxX: canvas.w - MARGIN, maxY: canvas.h - MARGIN }
  const piazzati: TavoloOut[] = []
  let spostati = 0
  let irrisolti = 0

  for (const t of proposta) {
    const pos = trovaPosizione(t, piazzati, poligono, bounds, canvas)
    if (pos) {
      if (Math.abs(pos.pos_x - t.pos_x) > 0.5 || Math.abs(pos.pos_y - t.pos_y) > 0.5) spostati++
      piazzati.push({ ...t, pos_x: pos.pos_x, pos_y: pos.pos_y })
    } else {
      // sala satura: nessuna posizione rispetta tutti i vincoli, piazza comunque il tavolo
      // (clampato al canvas) e segnala il problema invece di perderlo silenziosamente.
      irrisolti++
      const fallback = { ...t }
      clampToCanvas(fallback, canvas)
      piazzati.push(fallback)
    }
  }

  const warnings: string[] = []
  if (spostati > 0) warnings.push(`${spostati} tavolo/i riposizionato/i automaticamente per rispettare i confini della sala e la distanza minima di 80px.`)
  if (irrisolti > 0) warnings.push(`${irrisolti} tavolo/i non hanno trovato posto rispettando tutti i vincoli: la sala potrebbe essere troppo piccola per questo numero di tavoli. Prova a ridurre il numero di tavoli o a ingrandire il contorno della sala.`)

  return { tavoli: piazzati, warnings }
}

// ── Fallback deterministico (nessuna AI configurata, o risposta non valida) ──
function fallbackPosizioni(manifest: ManifestItem[], poligono: Pt[] | null, canvas: { w: number; h: number }) {
  const bounds = poligono ? polygonBounds(poligono) : { minX: MARGIN, minY: MARGIN, maxX: canvas.w - MARGIN, maxY: canvas.h - MARGIN }
  const cols = Math.max(1, Math.floor((bounds.maxX - bounds.minX) / 150))
  return manifest.map((m, i) => {
    const col = i % cols, row = Math.floor(i / cols)
    return {
      pos_x: Math.min(bounds.maxX - m.larghezza - MARGIN, bounds.minX + MARGIN + col * 150),
      pos_y: Math.min(bounds.maxY - m.altezza - MARGIN, bounds.minY + MARGIN + row * 140),
      rotazione: 0,
      forma: m.forma,
    }
  })
}

function clampNum(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback
  return Math.min(max, Math.max(min, v))
}

interface PosizioneAI { pos_x: number; pos_y: number; rotazione: number; forma: Forma }

async function posizionaConAI(
  sede: SedeInput, sala: SalaInput, canvas: { w: number; h: number },
  manifest: ManifestItem[], form: FormInput, poligono: Pt[] | null
): Promise<{ posizioni: PosizioneAI[]; warning?: string } | null> {
  if (!process.env.GROQ_API_KEY) return null

  const elenco = manifest.map((m, i) => {
    const base = `${i}: capienza ${m.capienza}, forma suggerita ${m.forma}, ${m.larghezza}x${m.altezza}px`
    return m.speciale ? `${base} — SPECIALE: ${SPECIALE_INFO[m.speciale].hint}` : base
  }).join('\n')

  const poligonoTxt = poligono
    ? `Il perimetro della sala è questo poligono (coordinate pixel, stesso sistema del canvas): ${JSON.stringify(poligono)}. Ogni tavolo deve stare COMPLETAMENTE dentro questo poligono.`
    : `Nessun contorno sala disegnato: usa l'intero canvas con un margine di sicurezza di ${MARGIN}px dai bordi.`

  const systemPrompt = `Sei un interior designer esperto di ristoranti. Ricevi un elenco numerato di tavoli già dimensionati (capienza, forma suggerita, dimensioni in pixel) per una sala di un ristorante, e devi assegnare a ciascuno una posizione (pos_x, pos_y = angolo alto-sinistra in pixel), una rotazione in gradi e confermare o correggere la forma (uno tra: rotondo, rettangolare, ovale, quadrato).

Dati sala:
- Sede: ${sede.nome} (tipo: ${sede.tipo ?? 'non specificato'})
- Sala: ${sala.nome}${sala.larghezza_metri && sala.altezza_metri ? ` — dimensioni reali ${sala.larghezza_metri}x${sala.altezza_metri} metri` : ''}
- Canvas: ${canvas.w}x${canvas.h} pixel
- ${poligonoTxt}

Preferenza di layout: ${LAYOUT_HINT[form.layoutPref]}
Note aggiuntive dal ristoratore: ${form.note?.trim() || 'nessuna'}

Regole vincolanti:
- Margine di sicurezza di almeno ${MARGIN}px da pareti/bordi.
- Distanza minima di ${MIN_DIST}px tra un tavolo e l'altro (bordo a bordo, non centro a centro).
- I tavoli con indicazione SPECIALE vanno posizionati seguendo l'indicazione data (angolo, punto focale, parete, fondo sala, zona appartata).
- I tavoli normali vanno distribuiti seguendo la preferenza di layout indicata sopra.
- Rispondi SOLO con un oggetto JSON nel formato {"posizioni":[{"pos_x":n,"pos_y":n,"rotazione":n,"forma":"rotondo|rettangolare|ovale|quadrato"}, ...]}, con ESATTAMENTE un elemento per ogni tavolo dell'elenco, nello stesso identico ordine. Nessun testo fuori dal JSON.`

  const userPrompt = `Elenco tavoli da posizionare:\n${elenco}`

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 3000,
        temperature: 0.6,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })
    if (!response.ok) { console.error('[genera-layout] groq http error', response.status); return null }
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return null
    const parsed = JSON.parse(content)
    const grezze = parsed?.posizioni
    if (!Array.isArray(grezze) || grezze.length === 0) return null

    // I modelli a volte sbagliano il conteggio esatto (es. 17 invece di 16): non scartiamo
    // tutta la risposta, tronchiamo l'eccesso o completiamo le mancanti col fallback a griglia.
    let warning: string | undefined
    let allineate = grezze
    if (grezze.length !== manifest.length) {
      warning = `L'AI ha proposto ${grezze.length} posizioni invece di ${manifest.length}: aggiustate automaticamente.`
      if (grezze.length > manifest.length) {
        allineate = grezze.slice(0, manifest.length)
      } else {
        const fb = fallbackPosizioni(manifest, poligono, canvas)
        allineate = [...grezze, ...fb.slice(grezze.length)]
      }
    }

    const posizioni = manifest.map((m, i) => {
      const p = allineate[i] ?? {}
      const forma = FORME_VALIDE.includes(p.forma) ? (p.forma as Forma) : m.forma
      return {
        pos_x: clampNum(p.pos_x, 0, canvas.w, 100),
        pos_y: clampNum(p.pos_y, 0, canvas.h, 100),
        rotazione: clampNum(p.rotazione, -180, 180, 0),
        forma,
      }
    })
    return { posizioni, warning }
  } catch (e) {
    console.error('[genera-layout] exception', e)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body
    if (!body?.sede || !body?.sala || !body?.form) {
      return Response.json({ error: 'Dati mancanti (sede, sala o form)' }, { status: 400 })
    }
    const canvas = body.canvas ?? { w: 1000, h: 680 }
    const manifest = buildManifest(body.form)
    if (manifest.length === 0) {
      return Response.json({ error: 'Nessun tavolo da generare: controlla numero e mix' }, { status: 400 })
    }
    const nomi = assignNomi(manifest, body.sala.nome)
    const poligono = body.sala.punti_poligono && body.sala.punti_poligono.length >= 3 ? body.sala.punti_poligono : null

    const aiResult = await posizionaConAI(body.sede, body.sala, canvas, manifest, body.form, poligono)
    const posizioni = aiResult ? aiResult.posizioni : fallbackPosizioni(manifest, poligono, canvas)

    const proposta: TavoloOut[] = manifest.map((m, i) => {
      const p = posizioni[i]
      return {
        nome: nomi[i] + (m.speciale ? ` (${SPECIALE_INFO[m.speciale].label})` : ''),
        forma: p.forma,
        capienza: m.capienza,
        larghezza: m.larghezza,
        altezza: m.altezza,
        pos_x: p.pos_x,
        pos_y: p.pos_y,
        rotazione: p.rotazione,
        note: m.speciale ? SPECIALE_INFO[m.speciale].hint : null,
      }
    })

    const { tavoli, warnings } = validateAndFix(proposta, poligono, canvas)
    if (!aiResult) warnings.unshift('AI non disponibile: disposizione generata con layout a griglia di riserva.')
    else if (aiResult.warning) warnings.unshift(aiResult.warning)

    return Response.json({ tavoli, warnings })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
