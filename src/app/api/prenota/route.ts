import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

interface PrenotaBody {
  slug: string
  nome: string
  telefono: string
  email?: string
  data: string
  ora: string
  coperti: number
  con_animale?: boolean
  allergie?: string
  occasione?: string
  note?: string
}

function emailHtml(opts: {
  sede: { nome: string; telefono: string | null; email: string | null }
  nome: string; data: string; ora: string; coperti: number; numero: string
}) {
  const { sede, nome, data, ora, coperti, numero } = opts
  const dataFmt = new Date(data + 'T00:00:00').toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const contatti = [sede.telefono, sede.email].filter(Boolean).join(' · ')
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1e293b">
    <div style="background:#f97316;color:#fff;padding:24px;border-radius:12px 12px 0 0;text-align:center">
      <h1 style="margin:0;font-size:20px">${sede.nome}</h1>
      <p style="margin:6px 0 0;font-size:13px;opacity:.85">Richiesta di prenotazione ricevuta</p>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 12px 12px">
      <p style="font-size:14px">Ciao <strong>${nome}</strong>,</p>
      <p style="font-size:14px">abbiamo ricevuto la tua richiesta di prenotazione. Ti contatteremo per la conferma definitiva.</p>
      <table style="width:100%;font-size:14px;margin:16px 0;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#64748b">Numero prenotazione</td><td style="padding:6px 0;text-align:right"><strong>${numero}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Data</td><td style="padding:6px 0;text-align:right"><strong>${dataFmt}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Ora</td><td style="padding:6px 0;text-align:right"><strong>${ora.slice(0, 5)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Persone</td><td style="padding:6px 0;text-align:right"><strong>${coperti}</strong></td></tr>
      </table>
      <p style="font-size:13px;color:#64748b">Per modifiche o cancellazioni contattaci: <strong>${contatti || 'vedi sito'}</strong> citando il numero di prenotazione.</p>
    </div>
  </div>`
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PrenotaBody
    const nome = body.nome?.trim()
    const coperti = Math.min(30, Math.max(1, Number(body.coperti) || 0))
    if (!body.slug || !nome || !body.telefono?.trim() || !body.data || !body.ora || !Number(body.coperti)) {
      return Response.json({ error: 'Campi obbligatori mancanti' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.data) || !/^\d{2}:\d{2}/.test(body.ora)) {
      return Response.json({ error: 'Data o ora non valide' }, { status: 400 })
    }

    const { data: sedi } = await admin
      .from('sedi').select('id,nome,telefono,email,attiva')
      .eq('slug', body.slug).eq('attiva', true).limit(1)
    const sede = sedi?.[0]
    if (!sede) return Response.json({ error: 'Sede non trovata' }, { status: 404 })

    const { data: rows, error } = await admin.from('prenotazioni').insert({
      sede_id: sede.id,
      nome_ospite: nome,
      telefono_ospite: body.telefono.trim(),
      data_prenotazione: body.data,
      ora_arrivo: body.ora,
      coperti,
      con_animale: !!body.con_animale,
      allergie_comunicare: body.allergie?.trim() || null,
      occasione_speciale: body.occasione?.trim() || null,
      note_speciali: body.note?.trim() || null,
      stato: 'in_attesa',
      origine: 'web',
    }).select('id')
    if (error || !rows?.[0]) {
      return Response.json({ error: error?.message ?? 'Errore inserimento' }, { status: 400 })
    }

    const numero = rows[0].id.slice(0, 8).toUpperCase()

    // Invio email best-effort: la prenotazione resta valida anche se l'email fallisce
    let emailInviata = false
    const emailCliente = body.email?.trim()
    if (emailCliente && process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        const { error: mailErr } = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Prenotazioni <onboarding@resend.dev>',
          to: emailCliente,
          subject: `Richiesta prenotazione ${sede.nome} — n. ${numero}`,
          html: emailHtml({ sede, nome, data: body.data, ora: body.ora, coperti, numero }),
        })
        emailInviata = !mailErr
      } catch {}
    }

    return Response.json({ id: rows[0].id, numero, emailInviata })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
