import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const CW = 1000
const CH = 680

interface SalaInput { id: string; nome: string }
interface Body {
  sede: { nome: string; tipo: string | null; coperti_totali: number | null }
  sale: SalaInput[]
}
interface TavoloSpec {
  nome: string; forma: 'rotondo' | 'rettangolare'; capienza: number
  larghezza: number; altezza: number
}
interface TavoloPosizionato extends TavoloSpec {
  sala_id: string; pos_x: number; pos_y: number; rotazione: number
}

function isTerrazza(nome: string) {
  return /terrazza|estern|giardino|dehor|veranda/i.test(nome)
}

/** Numero di tavoli per fascia di capienza, in base ai coperti da coprire — vedi esempio
 *  nella richiesta: 120 coperti ≈ 20 tavoli da 4-6 + 4 tavoli da 2 + 2 tavoli da 8. */
function pianificaTavoli(salaNome: string, coperti: number): TavoloSpec[] {
  const prefix = isTerrazza(salaNome) ? 'TR' : 'T'
  const nPiccoli = Math.max(2, Math.round((coperti * 0.07) / 2))
  const nGrandi = Math.max(1, Math.round((coperti * 0.13) / 8))
  const copertiRestanti = Math.max(0, coperti - nPiccoli * 2 - nGrandi * 8)
  const nMedi = Math.max(2, Math.round(copertiRestanti / 5))

  const specs: TavoloSpec[] = []
  let n = 1
  for (let i = 0; i < nPiccoli; i++) {
    specs.push({ nome: `${prefix}${n++}`, forma: 'rotondo', capienza: 2, larghezza: 60, altezza: 60 })
  }
  for (let i = 0; i < nMedi; i++) {
    const capienza = i % 3 === 2 ? 6 : 4
    const grande = capienza > 4
    specs.push({
      nome: `${prefix}${n++}`,
      forma: grande ? 'rettangolare' : 'rotondo',
      capienza,
      larghezza: grande ? 120 : 80,
      altezza: grande ? 80 : 80,
    })
  }
  for (let i = 0; i < nGrandi; i++) {
    specs.push({ nome: `${prefix}${n++}`, forma: 'rettangolare', capienza: 8, larghezza: 160, altezza: 90 })
  }
  return specs
}

/** Layout deterministico di riserva: usato se la chiamata AI fallisce o è mancante/invalida. */
function fallbackPosizioni(specs: TavoloSpec[]): { pos_x: number; pos_y: number; rotazione: number }[] {
  const margin = 30
  const piccoli = specs.map((s, i) => ({ s, i })).filter(x => x.s.capienza <= 2)
  const grandi = specs.map((s, i) => ({ s, i })).filter(x => x.s.capienza >= 8)
  const medi = specs.map((s, i) => ({ s, i })).filter(x => x.s.capienza > 2 && x.s.capienza < 8)

  const pos: Record<number, { pos_x: number; pos_y: number; rotazione: number }> = {}

  piccoli.forEach(({ i }, k) => {
    if (k % 2 === 0) pos[i] = { pos_x: margin + (k / 2) * 100, pos_y: margin, rotazione: 0 }
    else pos[i] = { pos_x: margin, pos_y: margin + 90 + Math.floor(k / 2) * 90, rotazione: 0 }
  })

  const centerX = CW / 2, centerY = CH / 2
  grandi.forEach(({ s, i }, k) => {
    pos[i] = {
      pos_x: Math.max(margin, centerX - s.larghezza / 2 + (k - grandi.length / 2) * 180),
      pos_y: centerY - s.altezza / 2,
      rotazione: 0,
    }
  })

  const cols = 5
  medi.forEach(({ i }, k) => {
    const col = k % cols, row = Math.floor(k / cols)
    pos[i] = { pos_x: 180 + col * 140, pos_y: 150 + row * 130, rotazione: 0 }
  })

  return specs.map((_, i) => pos[i] ?? { pos_x: 100 + ((i * 40) % 800), pos_y: 100 + Math.floor(i / 10) * 80, rotazione: 0 })
}

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback
  return Math.min(max, Math.max(min, v))
}

async function posizionaConAI(
  salaNome: string, sedeNome: string, sedeTipo: string | null, specs: TavoloSpec[]
): Promise<{ pos_x: number; pos_y: number; rotazione: number }[]> {
  if (!process.env.GROQ_API_KEY) return fallbackPosizioni(specs)

  const systemPrompt = `Sei un interior designer esperto di ristoranti. Ricevi un elenco di tavoli già dimensionati (forma, capienza, larghezza, altezza in pixel) per una sala di un ristorante, e devi assegnare a ciascuno una posizione (pos_x, pos_y, angolo alto-sinistra in pixel) e una rotazione in gradi (di norma 0, usa 90 solo se un tavolo va addossato a una parete laterale) su una pianta rettangolare di ${CW}x${CH} pixel.

Regole:
- Margine di sicurezza di almeno 20px dai bordi della pianta (pos_x + larghezza <= ${CW - 20}, pos_y + altezza <= ${CH - 20}, pos_x >= 20, pos_y >= 20).
- I tavoli da 2 persone (romantici) vanno vicino alle pareti/finestre o negli angoli della pianta.
- I tavoli grandi (8+ persone) vanno vicino al centro della sala, per lasciare spazio di passaggio libero.
- I tavoli medi (4-6 persone) vanno distribuiti nello spazio restante, con una disposizione ordinata ma leggermente irregolare per sembrare naturale (non una griglia perfetta).
- Evita sovrapposizioni: lascia almeno 25px di spazio tra un tavolo e l'altro.
- Rispondi SOLO con un oggetto JSON nel formato {"posizioni":[{"pos_x":n,"pos_y":n,"rotazione":n}, ...]}, con ESATTAMENTE un elemento per ogni tavolo ricevuto, nello stesso identico ordine dell'elenco fornito. Nessun testo fuori dal JSON.`

  const userPrompt = JSON.stringify({
    sede: sedeNome, tipo_sede: sedeTipo, sala: salaNome,
    tavoli: specs.map((s, i) => ({ indice: i, nome: s.nome, forma: s.forma, capienza: s.capienza, larghezza: s.larghezza, altezza: s.altezza })),
  })

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2048,
        temperature: 0.6,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })
    if (!response.ok) return fallbackPosizioni(specs)

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return fallbackPosizioni(specs)

    const parsed = JSON.parse(content)
    const posizioni = parsed?.posizioni
    if (!Array.isArray(posizioni) || posizioni.length !== specs.length) return fallbackPosizioni(specs)

    return specs.map((s, i) => {
      const p = posizioni[i] ?? {}
      return {
        pos_x: clamp(p.pos_x, 20, CW - 20 - s.larghezza, 100),
        pos_y: clamp(p.pos_y, 20, CH - 20 - s.altezza, 100),
        rotazione: clamp(p.rotazione, -180, 180, 0),
      }
    })
  } catch {
    return fallbackPosizioni(specs)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body
    if (!body?.sede || !Array.isArray(body.sale) || body.sale.length === 0) {
      return Response.json({ error: 'Sede o sale mancanti' }, { status: 400 })
    }
    const copertiTotali = Math.max(4, Number(body.sede.coperti_totali) || 40)
    const nSale = body.sale.length

    const risultati = await Promise.all(
      body.sale.map(async (sala): Promise<TavoloPosizionato[]> => {
        const copertiSala = Math.round(copertiTotali / nSale)
        const specs = pianificaTavoli(sala.nome, copertiSala)
        const posizioni = await posizionaConAI(sala.nome, body.sede.nome, body.sede.tipo, specs)
        return specs.map((s, i) => ({ ...s, ...posizioni[i], sala_id: sala.id }))
      })
    )

    return Response.json({ tavoli: risultati.flat() })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
