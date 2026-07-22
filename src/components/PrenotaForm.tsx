'use client'

import { useState } from 'react'
import type { Sede } from '@/types/database'

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export default function PrenotaForm({ sede }: { sede: Sede }) {
  const [inviata, setInviata] = useState(false)
  const [inviando, setInviando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [numero, setNumero] = useState<string | null>(null)
  const [emailInviata, setEmailInviata] = useState(false)

  const [nome, setNome] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [data, setData] = useState(todayISO())
  const [ora, setOra] = useState('20:00')
  const [coperti, setCoperti] = useState(2)
  const [conAnimale, setConAnimale] = useState(false)
  const [allergie, setAllergie] = useState('')
  const [occasione, setOccasione] = useState('')
  const [note, setNote] = useState('')

  const accent = sede.colore_hex || '#f97316'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrore(null)
    setInviando(true)
    try {
      const res = await fetch('/api/prenota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: sede.slug,
          nome, telefono, email: email.trim() || undefined,
          data, ora, coperti,
          con_animale: conAnimale,
          allergie, occasione, note,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setNumero(json.numero)
      setEmailInviata(!!json.emailInviata)
      setInviata(true)
    } catch {
      setErrore('Non siamo riusciti a registrare la prenotazione. Riprova o chiamaci telefonicamente.')
    } finally {
      setInviando(false)
    }
  }

  function reset() {
    setInviata(false); setNumero(null); setEmailInviata(false)
    setNome(''); setTelefono(''); setEmail(''); setNote(''); setAllergie(''); setOccasione('')
    setConAnimale(false); setCoperti(2)
  }

  if (inviata) {
    return (
      <div className="text-center max-w-sm mx-auto bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        <p className="text-4xl mb-3">✅</p>
        <h1 className="text-lg font-semibold text-slate-900">Richiesta inviata!</h1>
        {numero && (
          <p className="text-sm text-slate-600 mt-2">
            Numero prenotazione: <strong className="text-slate-900">{numero}</strong>
          </p>
        )}
        <p className="text-sm text-slate-500 mt-2">
          Abbiamo ricevuto la tua richiesta per <strong>{sede.nome}</strong>.
          Ti contatteremo al numero indicato per la conferma.
        </p>
        {emailInviata && (
          <p className="text-xs text-slate-400 mt-2">Ti abbiamo inviato un riepilogo via email.</p>
        )}
        <button onClick={reset} className="mt-5 text-xs font-medium hover:underline" style={{ color: accent }}>
          Fai un&apos;altra prenotazione
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
      <h2 className="text-sm font-semibold text-slate-900">Prenota un tavolo</h2>

      <div>
        <label className="text-xs font-medium text-slate-600">Nome e cognome *</label>
        <input required value={nome} onChange={e => setNome(e.target.value)}
          className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2" />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600">Telefono *</label>
        <input required type="tel" value={telefono} onChange={e => setTelefono(e.target.value)}
          className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2" />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600">Email <span className="text-slate-400">(per ricevere il riepilogo)</span></label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600">Data *</label>
          <input required type="date" min={todayISO()} value={data} onChange={e => setData(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Ora *</label>
          <input required type="time" value={ora} onChange={e => setOra(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2" />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600">Numero persone *</label>
        <input required type="number" min={1} max={30} value={coperti}
          onChange={e => setCoperti(parseInt(e.target.value) || 1)}
          className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2" />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={conAnimale} onChange={e => setConAnimale(e.target.checked)} className="rounded" />
        Verrò con il mio cane 🐕
      </label>

      <div>
        <label className="text-xs font-medium text-slate-600">Allergie o intolleranze da comunicare</label>
        <input value={allergie} onChange={e => setAllergie(e.target.value)}
          className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2" />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600">Occasione speciale</label>
        <input value={occasione} onChange={e => setOccasione(e.target.value)} placeholder="Compleanno, anniversario…"
          className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2" />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600">Note</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
          className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 resize-none" />
      </div>

      {errore && <p className="text-xs text-red-500">{errore}</p>}

      <button type="submit" disabled={inviando}
        className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition disabled:opacity-60"
        style={{ backgroundColor: accent }}>
        {inviando ? 'Invio in corso…' : 'Richiedi prenotazione'}
      </button>

      <p className="text-[11px] text-slate-400 text-center">
        La richiesta non è una conferma automatica: il ristorante ti contatterà per confermare disponibilità.
      </p>
    </form>
  )
}
