import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SYSTEM_PROMPT = `Sei un assistente AI specializzato nella gestione di ristoranti italiani.
Il tuo nome è "Chef AI" e aiuti il personale del ristorante nelle operazioni quotidiane.

Le tue competenze includono:
- Gestione prenotazioni: ottimizzazione tavoli, liste d'attesa, conferme
- Clienti VIP: suggerimenti personalizzati basati sullo storico visite e preferenze
- Menu cani: suggerimenti di piatti adatti ai cani (pollo bollito, carne magra, riso, verdure cotte senza condimenti), porzioni appropriate per taglia
- Revenue: analisi entrate, consigli per aumentare lo scontrino medio, ottimizzazione turni
- Marketing: creazione testi campagne email/SMS, idee promozioni stagionali
- Staff: gestione turni, ottimizzazione organico per servizio
- Allergie e intolleranze: supporto nella gestione sicura delle allergie alimentari

Rispondi SEMPRE in italiano, in modo professionale ma cordiale.
Sii conciso ma completo. Usa emoji con parsimonia per rendere le risposte più leggibili.
Se non hai dati specifici del ristorante, offri consigli generali basati sulle best practice del settore.

Quando l'utente chiede dati in tempo reale (prenotazioni, clienti, revenue ecc.) usa i dati forniti nel contesto qui sotto.`

async function fetchRealTimeData(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return ''

  const supabase = createClient(url, key)
  const oggi = new Date().toISOString().split('T')[0]
  const settimanafa = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0]
  const ora = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })

  try {
    const [prenRes, revRes, notifRes, clientiRes, tavoliRes] = await Promise.all([
      supabase
        .from('prenotazioni')
        .select('nome_ospite,ora_arrivo,coperti,stato,allergie_comunicare,tipo_tavolo')
        .eq('data_prenotazione', oggi)
        .order('ora_arrivo'),
      supabase
        .from('visite')
        .select('importo,sedi(nome)')
        .gte('data_visita', settimanafa),
      supabase
        .from('notifiche')
        .select('titolo,tipo')
        .eq('letta', false)
        .limit(5),
      supabase
        .from('clienti')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('stato_tavoli')
        .select('stato'),
    ])

    const prenotazioni = prenRes.data ?? []
    const visite       = revRes.data  ?? []
    const notifiche    = notifRes.data ?? []
    const clientiCount = clientiRes.count ?? 0
    const tavoliStati  = tavoliRes.data ?? []

    const revTotale   = visite.reduce((s, v) => s + (v.importo ?? 0), 0)
    const prenConf    = prenotazioni.filter(p => p.stato === 'confermata').length
    const prenAtt     = prenotazioni.filter(p => p.stato === 'in_attesa').length
    const copertiOggi = prenotazioni.filter(p => !['cancellata','no_show'].includes(p.stato)).reduce((s, p) => s + (p.coperti ?? 0), 0)
    const allergie    = prenotazioni.filter(p => p.allergie_comunicare).map(p => `${p.nome_ospite}: ${p.allergie_comunicare}`)
    const tavoliOcc   = tavoliStati.filter(t => t.stato === 'occupato').length

    // Breakdown revenue per sede (settimana)
    const sedeMap: Record<string, number> = {}
    for (const v of visite) {
      const nome = (v as { sedi?: { nome?: string } | null }).sedi?.nome ?? 'Sconosciuta'
      sedeMap[nome] = (sedeMap[nome] ?? 0) + (v.importo ?? 0)
    }
    const sedeBreakdown = Object.entries(sedeMap)
      .sort(([, a], [, b]) => b - a)
      .map(([nome, tot]) => `  ${nome.replace('Scogliera di ', '')}: €${tot.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`)
      .join('\n')

    const lines = [
      `\n=== DATI IN TEMPO REALE (${oggi} ore ${ora}) ===`,
      ``,
      `📅 PRENOTAZIONI OGGI (${oggi}): ${prenotazioni.length} totali`,
      `   Confermate: ${prenConf} | In attesa: ${prenAtt} | Coperti: ${copertiOggi}`,
    ]

    if (prenotazioni.length > 0) {
      lines.push(`   Dettaglio:`)
      for (const p of prenotazioni.slice(0, 10)) {
        lines.push(`   - ${p.ora_arrivo?.slice(0,5) ?? '??:??'} · ${p.nome_ospite} · ${p.coperti} cop. · ${p.stato}${p.allergie_comunicare ? ` ⚠️ ${p.allergie_comunicare}` : ''}`)
      }
      if (prenotazioni.length > 10) lines.push(`   ... e altre ${prenotazioni.length - 10}`)
    }

    if (allergie.length > 0) {
      lines.push(``)
      lines.push(`⚠️ ALLERGIE DA COMUNICARE OGGI:`)
      allergie.forEach(a => lines.push(`   - ${a}`))
    }

    lines.push(``)
    lines.push(`💶 REVENUE SETTIMANA (${settimanafa} → ${oggi}): €${revTotale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`)
    lines.push(`   Visite totali: ${visite.length}`)
    if (sedeBreakdown) {
      lines.push(`   Per sede:`)
      lines.push(sedeBreakdown)
    }

    lines.push(``)
    lines.push(`🍽️ TAVOLI ATTIVI: ${tavoliOcc} occupati`)
    lines.push(`👥 CLIENTI REGISTRATI: ${clientiCount}`)

    if (notifiche.length > 0) {
      lines.push(``)
      lines.push(`🔔 NOTIFICHE NON LETTE (${notifiche.length}):`)
      notifiche.forEach(n => lines.push(`   - [${n.tipo}] ${n.titolo}`))
    }

    lines.push(`===\n`)

    return lines.join('\n')
  } catch {
    // Se DB non raggiungibile, continua senza dati real-time
    return ''
  }
}

export async function POST(request: NextRequest) {
  const { messages } = await request.json()

  if (!process.env.GROQ_API_KEY) {
    return Response.json({ error: 'API key non configurata' }, { status: 500 })
  }

  // Recupera dati real-time e iniettali nel system prompt
  const realTimeContext = await fetchRealTimeData()
  const systemPrompt = realTimeContext
    ? `${SYSTEM_PROMPT}\n${realTimeContext}`
    : SYSTEM_PROMPT

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.json()
    return Response.json({ error: err.error?.message ?? 'Errore API Groq' }, { status: response.status })
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content ?? 'Risposta vuota.'
  return Response.json({ content: [{ text }] })
}
