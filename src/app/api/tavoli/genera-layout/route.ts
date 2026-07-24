import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const MARGIN = 20
const MIN_DIST = 80
const CORRIDOR_HALF = 60 // corridoio centrale di 120px sempre libero per il passaggio del personale
const ROW_GAP = 100 // corridoio minimo tra le file di tavoli da 4

interface Pt { x: number; y: number }
interface BoundsRect { minX: number; minY: number; maxX: number; maxY: number }
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

interface ManifestItem { capienza: number; forma: Forma; larghezza: number; altezza: number; speciale?: string }
interface TavoloOut { nome: string; forma: string; capienza: number; larghezza: number; altezza: number; pos_x: number; pos_y: number; rotazione: number; note: string | null }

const SPECIALE_INFO: Record<string, { capienza: number; larghezza: number; altezza: number; forma: Forma; label: string; hint: string }> = {
  romantico_angolo: { capienza: 2, larghezza: 60, altezza: 60, forma: 'rotondo', label: 'romantico', hint: 'Tavolo romantico: posizionato in un angolo appartato della sala.' },
  chef_table: { capienza: 6, larghezza: 140, altezza: 90, forma: 'rettangolare', label: "chef's table", hint: "Chef's table: posizione di rilievo, punto focale della sala." },
  bancone: { capienza: 4, larghezza: 200, altezza: 50, forma: 'rettangolare', label: 'bancone', hint: 'Bancone: addossato a una parete lunga della sala.' },
  prive: { capienza: 4, larghezza: 110, altezza: 90, forma: 'rettangolare', label: 'privé', hint: 'Tavolo privé: appartato in un angolo, separato dal flusso principale della sala.' },
  lungo_sociale: { capienza: 10, larghezza: 240, altezza: 90, forma: 'rettangolare', label: 'tavolo sociale', hint: 'Tavolo lungo sociale/comunitario: posizionato in fondo alla sala.' },
}

const LAYOUT_HINT: Record<FormInput['layoutPref'], string> = {
  classico: 'Disposizione CLASSICA: tavoli in file ordinate e regolari, come una griglia classica da ristorante.',
  dinamico: 'Disposizione DINAMICA: gruppi misti e organici, meno a griglia, più naturale e vario.',
  massimizza: 'MASSIMIZZA LO SPAZIO: incastra il maggior numero possibile di tavoli, riducendo al minimo gli spazi vuoti (senza mai scendere sotto i vincoli minimi di distanza).',
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

// ── Geometria di base ─────────────────────────────────────────────────────
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

function polygonBounds(poly: Pt[]): BoundsRect {
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

function clampNum(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback
  return Math.min(max, Math.max(min, v))
}

// ── STEP 2 — disposizione di base deterministica per zone ──────────────────
// Perimetro (tavoli da 2) → centro in file ordinate (tavoli da 4, corridoio
// centrale escluso) → fondo sala (6+/8) → angoli (tavoli speciali).
function generaPuntiPerimetro(x0: number, y0: number, x1: number, y1: number, n: number, midX: number): Pt[] {
  if (n <= 0) return []
  const w = x1 - x0, h = y1 - y0
  const perimetro = 2 * (w + h)
  const passo = perimetro / n
  const punti: Pt[] = []
  for (let k = 0; k < n; k++) {
    const dd = (passo / 2 + k * passo) % perimetro
    let x: number, y: number
    if (dd < w) { x = x0 + dd; y = y0 }
    else if (dd < w + h) { x = x1; y = y0 + (dd - w) }
    else if (dd < 2 * w + h) { x = x1 - (dd - w - h); y = y1 }
    else { x = x0; y = y1 - (dd - 2 * w - h) }
    // lascia libera la "bocca" del corridoio centrale sui bordi orizzontali
    if ((Math.abs(y - y0) < 1 || Math.abs(y - y1) < 1) && Math.abs(x - midX) < CORRIDOR_HALF) {
      x = x < midX ? midX - CORRIDOR_HALF - 15 : midX + CORRIDOR_HALF + 15
    }
    punti.push({ x, y })
  }
  return punti
}

function layoutGrigliaBlocco(items: ManifestItem[], x0: number, x1: number, yStart: number, colGap: number): Pt[] {
  if (items.length === 0) return []
  const larghezza = items[0].larghezza, altezza = items[0].altezza
  const cols = Math.max(1, Math.floor((x1 - x0 + colGap) / (larghezza + colGap)))
  return items.map((_, k) => {
    const row = Math.floor(k / cols), col = k % cols
    return { x: x0 + col * (larghezza + colGap) + larghezza / 2, y: yStart + row * (altezza + ROW_GAP) + altezza / 2 }
  })
}

function posizioniDeterministiche(
  manifest: ManifestItem[], bounds: BoundsRect, layoutPref: FormInput['layoutPref']
): Array<{ pos_x: number; pos_y: number; rotazione: number }> {
  const { minX, minY, maxX, maxY } = bounds
  const midX = (minX + maxX) / 2

  const conIndice = manifest.map((m, i) => ({ m, i }))
  const perimetrali = conIndice.filter(({ m }) => m.capienza <= 2 && !m.speciale)
  const centrali    = conIndice.filter(({ m }) => m.capienza > 2 && m.capienza < 6 && !m.speciale)
  const fondoSala   = conIndice.filter(({ m }) => m.capienza >= 6 && !m.speciale)
  const speciali    = conIndice.filter(({ m }) => !!m.speciale)

  const pos: Record<number, { pos_x: number; pos_y: number; rotazione: number }> = {}
  // il gap orizzontale non può mai scendere sotto MIN_DIST (80px): è un vincolo
  // rigido, non regolabile dalla preferenza di layout (che agisce solo sopra il minimo)
  const colGap = layoutPref === 'massimizza' ? MIN_DIST : layoutPref === 'dinamico' ? 100 : 90

  // 1. Tavoli da 2: lungo il perimetro, distanziati uniformemente
  const inset = 20
  const puntiPerimetro = generaPuntiPerimetro(minX + inset, minY + inset, maxX - inset, maxY - inset, perimetrali.length, midX)
  perimetrali.forEach(({ i, m }, k) => {
    const p = puntiPerimetro[k]
    pos[i] = { pos_x: p.x - m.larghezza / 2, pos_y: p.y - m.altezza / 2, rotazione: 0 }
  })

  // 2. Tavoli da 4: al centro, in file ordinate, corridoio centrale libero (blocco sinistro + destro)
  const centroTop = minY + 110
  const leftX0 = minX + 100, leftX1 = midX - CORRIDOR_HALF
  const rightX0 = midX + CORRIDOR_HALF, rightX1 = maxX - 100
  const meta = Math.ceil(centrali.length / 2)
  const puntiSx = layoutGrigliaBlocco(centrali.slice(0, meta).map(c => c.m), leftX0, leftX1, centroTop, colGap)
  const puntiDx = layoutGrigliaBlocco(centrali.slice(meta).map(c => c.m), rightX0, rightX1, centroTop, colGap)
  centrali.forEach(({ i, m }, k) => {
    const p = k < meta ? puntiSx[k] : puntiDx[k - meta]
    pos[i] = { pos_x: p.x - m.larghezza / 2, pos_y: p.y - m.altezza / 2, rotazione: 0 }
  })

  // 3. Tavoli da 6+: fondo sala, posizione privilegiata, corridoio libero
  const fondoY = maxY - 90
  let fondoX = midX - (fondoSala.reduce((s, { m }) => s + m.larghezza + colGap, -colGap)) / 2
  fondoSala.forEach(({ i, m }) => {
    let cx = fondoX + m.larghezza / 2
    if (Math.abs(cx - midX) < CORRIDOR_HALF) { fondoX += CORRIDOR_HALF * 2; cx = fondoX + m.larghezza / 2 }
    pos[i] = { pos_x: cx - m.larghezza / 2, pos_y: fondoY - m.altezza / 2, rotazione: 0 }
    fondoX += m.larghezza + colGap
  })

  // 4. Tavoli speciali (romantico, privé, ...): angoli della sala
  const angoli = [
    { x: minX + 55, y: minY + 55 },
    { x: maxX - 55, y: minY + 55 },
    { x: maxX - 55, y: maxY - 55 },
    { x: minX + 55, y: maxY - 55 },
  ]
  speciali.forEach(({ i, m }, k) => {
    const angolo = angoli[k % 4]
    const extra = Math.floor(k / 4) * (m.larghezza + 20)
    const versoX = angolo.x < midX ? 1 : -1
    pos[i] = { pos_x: angolo.x - m.larghezza / 2 + versoX * extra, pos_y: angolo.y - m.altezza / 2, rotazione: 0 }
  })

  return manifest.map((_, i) => pos[i] ?? { pos_x: minX + 60, pos_y: minY + 60, rotazione: 0 })
}

// ── STEP 2 (rifinitura) — l'AI aggiunge solo un tocco creativo entro un raggio
// contenuto dalla posizione già assegnata: non può spostare un tavolo fuori zona. ──
async function raffinaConAI(
  sede: SedeInput, sala: SalaInput, manifest: ManifestItem[], form: FormInput,
  base: Array<{ pos_x: number; pos_y: number; rotazione: number }>
): Promise<Array<{ pos_x: number; pos_y: number; rotazione: number }> | null> {
  if (!process.env.GROQ_API_KEY) return null

  const maxJitter = form.layoutPref === 'dinamico' ? 35 : form.layoutPref === 'massimizza' ? 10 : 5

  const elenco = manifest.map((m, i) => {
    const b = base[i]
    const zona = m.speciale ? SPECIALE_INFO[m.speciale].label : m.capienza <= 2 ? 'perimetro' : m.capienza < 6 ? 'centro' : 'fondo sala'
    return `${i}: capienza ${m.capienza}, zona "${zona}", posizione assegnata (${Math.round(b.pos_x)},${Math.round(b.pos_y)})`
  }).join('\n')

  const systemPrompt = `Sei un interior designer di ristoranti. Hai già ricevuto una disposizione di base corretta e verificata: i tavoli piccoli (da 2) sono lungo il perimetro, quelli medi (da 4) al centro in file ordinate, quelli grandi (6+) in fondo alla sala, quelli speciali negli angoli. Il tuo compito è SOLO una rifinitura leggera: per ciascun tavolo puoi proporre uno spostamento (dx, dy) di al massimo ${maxJitter}px dalla posizione assegnata e una piccola rotazione in gradi, per rendere la disposizione più naturale — NON allontanare mai un tavolo dalla zona già assegnata.

Sede: ${sede.nome} (${sede.tipo ?? 'tipo non specificato'}). Sala: ${sala.nome}.
Preferenza di stile: ${LAYOUT_HINT[form.layoutPref]}
Note del ristoratore: ${form.note?.trim() || 'nessuna'}

Rispondi SOLO con un oggetto JSON nel formato {"aggiustamenti":[{"dx":n,"dy":n,"rotazione":n}, ...]}, con ESATTAMENTE un elemento per ogni tavolo dell'elenco, nello stesso identico ordine, dx/dy compresi tra -${maxJitter} e ${maxJitter}.`

  const userPrompt = `Disposizione di base:\n${elenco}`

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2000,
        temperature: 0.5,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })
    if (!response.ok) return null
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return null
    const parsed = JSON.parse(content)
    const aggiustamenti = parsed?.aggiustamenti
    if (!Array.isArray(aggiustamenti)) return null

    return base.map((b, i) => {
      const a = aggiustamenti[i] ?? {}
      const dx = clampNum(a.dx, -maxJitter, maxJitter, 0)
      const dy = clampNum(a.dy, -maxJitter, maxJitter, 0)
      const rot = clampNum(a.rotazione, -15, 15, 0)
      return { pos_x: b.pos_x + dx, pos_y: b.pos_y + dy, rotazione: rot }
    })
  } catch {
    return null
  }
}

// ── STEP 3 — validazione: ogni tavolo piazzato uno alla volta con ricerca a
// spirale attorno alla posizione desiderata, verificato contro i tavoli già
// piazzati. Garantisce per costruzione niente sovrapposizioni/uscite dai
// confini/invasioni del corridoio centrale, anche se la fase precedente
// (deterministica o AI) avesse proposto qualcosa di non valido. ──────────────
function posizioneValida(
  t: { pos_x: number; pos_y: number; larghezza: number; altezza: number },
  piazzati: TavoloOut[], poligono: Pt[] | null, corridor: { minX: number; maxX: number } | null, canvas: { w: number; h: number }
): boolean {
  if (t.pos_x < MARGIN || t.pos_y < MARGIN) return false
  if (t.pos_x + t.larghezza > canvas.w - MARGIN || t.pos_y + t.altezza > canvas.h - MARGIN) return false
  if (corridor && t.pos_x < corridor.maxX && t.pos_x + t.larghezza > corridor.minX) return false
  if (poligono) {
    const center = { x: t.pos_x + t.larghezza / 2, y: t.pos_y + t.altezza / 2 }
    if (!pointInPolygon(center, poligono)) return false
  }
  for (const p of piazzati) if (rectDistance(t, p) < MIN_DIST) return false
  return true
}

function trovaPosizione(
  desiderata: { pos_x: number; pos_y: number; larghezza: number; altezza: number },
  piazzati: TavoloOut[], poligono: Pt[] | null, corridor: { minX: number; maxX: number } | null,
  bounds: BoundsRect, canvas: { w: number; h: number }
): { pos_x: number; pos_y: number } | null {
  const base = { ...desiderata }
  clampToCanvas(base, canvas)
  if (posizioneValida(base, piazzati, poligono, corridor, canvas)) return { pos_x: base.pos_x, pos_y: base.pos_y }

  for (let radius = 24; radius <= 900; radius += 24) {
    const steps = Math.max(10, Math.floor(radius / 8))
    for (let k = 0; k < steps; k++) {
      const angle = (k / steps) * Math.PI * 2
      const cand = { ...desiderata, pos_x: desiderata.pos_x + Math.cos(angle) * radius, pos_y: desiderata.pos_y + Math.sin(angle) * radius }
      clampToCanvas(cand, canvas)
      if (posizioneValida(cand, piazzati, poligono, corridor, canvas)) return { pos_x: cand.pos_x, pos_y: cand.pos_y }
    }
  }

  const step = 30
  for (let y = bounds.minY; y <= bounds.maxY - desiderata.altezza; y += step) {
    for (let x = bounds.minX; x <= bounds.maxX - desiderata.larghezza; x += step) {
      const cand = { ...desiderata, pos_x: x, pos_y: y }
      if (posizioneValida(cand, piazzati, poligono, corridor, canvas)) return { pos_x: x, pos_y: y }
    }
  }
  return null
}

// I tavoli con un vincolo di posizione più rigido vanno piazzati per primi (hanno
// meno alternative valide: un angolo preciso, il fondo sala), lasciando ai tavoli
// più flessibili (perimetro, e soprattutto il blocco centrale, il più numeroso)
// il compito di adattarsi intorno a chi ha meno margine di manovra.
function priorita(t: TavoloOut): number {
  if (t.note) return 0          // tavoli speciali: angolo specifico
  if (t.capienza >= 6) return 1 // fondo sala
  if (t.capienza <= 2) return 2 // perimetro
  return 3                       // centro: i più numerosi e flessibili, per ultimi
}

function validateAndFix(
  proposta: TavoloOut[], poligono: Pt[] | null, corridor: { minX: number; maxX: number } | null, canvas: { w: number; h: number }
): { tavoli: TavoloOut[]; warnings: string[] } {
  const bounds = poligono ? polygonBounds(poligono) : { minX: MARGIN, minY: MARGIN, maxX: canvas.w - MARGIN, maxY: canvas.h - MARGIN }
  const ordine = proposta
    .map((t, i) => ({ t, i }))
    .sort((a, b) => priorita(a.t) - priorita(b.t))

  const piazzati: TavoloOut[] = []
  const risultato: TavoloOut[] = new Array(proposta.length)
  let spostati = 0
  let irrisolti = 0

  for (const { t, i } of ordine) {
    const pos = trovaPosizione(t, piazzati, poligono, corridor, bounds, canvas)
    let finale: TavoloOut
    if (pos) {
      if (Math.abs(pos.pos_x - t.pos_x) > 0.5 || Math.abs(pos.pos_y - t.pos_y) > 0.5) spostati++
      finale = { ...t, pos_x: pos.pos_x, pos_y: pos.pos_y }
    } else {
      irrisolti++
      finale = { ...t }
      clampToCanvas(finale, canvas)
    }
    risultato[i] = finale
    piazzati.push(finale)
  }

  const warnings: string[] = []
  if (spostati > 0) warnings.push(`${spostati} tavolo/i riposizionato/i automaticamente per rispettare confini, corridoio centrale e distanza minima di 80px.`)
  if (irrisolti > 0) warnings.push(`${irrisolti} tavolo/i non hanno trovato posto rispettando tutti i vincoli: la sala potrebbe essere troppo piccola per questo numero di tavoli. Prova a ridurre il numero di tavoli o a ingrandire il contorno della sala.`)

  return { tavoli: risultato, warnings }
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
    const bounds = poligono ? polygonBounds(poligono) : { minX: MARGIN, minY: MARGIN, maxX: canvas.w - MARGIN, maxY: canvas.h - MARGIN }
    const midX = (bounds.minX + bounds.maxX) / 2
    const corridor = { minX: midX - CORRIDOR_HALF, maxX: midX + CORRIDOR_HALF }

    const base = posizioniDeterministiche(manifest, bounds, body.form.layoutPref)
    const raffinate = await raffinaConAI(body.sede, body.sala, manifest, body.form, base)
    const posizioni = raffinate ?? base

    const proposta: TavoloOut[] = manifest.map((m, i) => {
      const p = posizioni[i]
      return {
        nome: nomi[i] + (m.speciale ? ` (${SPECIALE_INFO[m.speciale].label})` : ''),
        forma: m.forma,
        capienza: m.capienza,
        larghezza: m.larghezza,
        altezza: m.altezza,
        pos_x: p.pos_x,
        pos_y: p.pos_y,
        rotazione: p.rotazione,
        note: m.speciale ? SPECIALE_INFO[m.speciale].hint : null,
      }
    })

    const { tavoli, warnings } = validateAndFix(proposta, poligono, corridor, canvas)
    if (!raffinate) warnings.unshift('Rifinitura AI non disponibile: disposizione generata con zone deterministiche (perimetro / centro / fondo sala).')

    return Response.json({ tavoli, warnings })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
