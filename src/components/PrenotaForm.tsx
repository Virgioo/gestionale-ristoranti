'use client'

import { useEffect, useState } from 'react'
import type { Sede } from '@/types/database'
import AllergenSelector from './AllergenSelector'
import { stringifyAllergie } from '@/lib/allergeni'
import { queryDB } from '@/lib/api'

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

interface SalaOpt { id: string; nome: string }
interface TavoloOpt { id: string; nome: string; capienza: number }

export default function PrenotaForm({ sede, compact }: { sede: Sede; compact?: boolean }) {
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
  const [allergie, setAllergie] = useState<string[]>([])
  const [occasione, setOccasione] = useState('')
  const [note, setNote] = useState('')

  const [sale, setSale] = useState<SalaOpt[]>([])
  const [zonaId, setZonaId] = useState('')
  const [tavoli, setTavoli] = useState<TavoloOpt[]>([])
  const [tavoloId, setTavoloId] = useState('')
  const [tavoliOccupati, setTavoliOccupati] = useState<Set<string>>(new Set())

  const accent = sede.colore_hex || '#f97316'

  // Zone/sale disponibili per questa sede (opzionale, il cliente può non scegliere)
  useEffect(() => {
    queryDB<SalaOpt>('sale', { select: 'id,nome', filters: [{ fn: 'eq', args: ['sede_id', sede.id] }], order: { col: 'ordine' } })
      .then(setSale).catch(() => setSale([]))
  }, [sede.id])

  // Tavoli della zona scelta
  useEffect(() => {
    setTavoloId('')
    if (!zonaId) { setTavoli([]); return }
    queryDB<TavoloOpt>('tavoli', { select: 'id,nome,capienza', filters: [{ fn: 'eq', args: ['sala_id', zonaId] }] })
      .then(setTavoli).catch(() => setTavoli([]))
  }, [zonaId])

  // Tavoli già occupati per data/ora scelte, per segnalarli come non disponibili
  useEffect(() => {
    if (!zonaId || !data || !ora) { setTavoliOccupati(new Set()); return }
    queryDB<{ tavolo_id: string }>('prenotazioni', {
      select: 'tavolo_id',
      filters: [
        { fn: 'eq', args: ['sede_id', sede.id] },
        { fn: 'eq', args: ['data_prenotazione', data] },
        { fn: 'eq', args: ['ora_arrivo', ora] },
        { fn: 'not', args: ['tavolo_id', 'is', null] },
        { fn: 'neq', args: ['stato', 'cancellata'] },
      ],
    }).then(rows => setTavoliOccupati(new Set(rows.map(r => r.tavolo_id)))).catch(() => setTavoliOccupati(new Set()))
  }, [sede.id, zonaId, data, ora])

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
          allergie: stringifyAllergie(allergie) ?? undefined,
          occasione, note,
          zona: sale.find(s => s.id === zonaId)?.nome,
          tavolo_id: tavoloId || undefined,
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
    setNome(''); setTelefono(''); setEmail(''); setNote(''); setAllergie([]); setOccasione('')
    setConAnimale(false); setCoperti(2); setZonaId(''); setTavoloId('')
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

      {sale.length > 0 && (
        <div>
          <label className="text-xs font-medium text-slate-600">Zona preferita <span className="text-slate-400">(opzionale)</span></label>
          <select value={zonaId} onChange={e => setZonaId(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 bg-white">
            <option value="">Nessuna preferenza</option>
            {sale.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
      )}

      {zonaId && tavoli.length > 0 && (
        <div>
          <label className="text-xs font-medium text-slate-600">Tavolo preferito <span className="text-slate-400">(opzionale, se libero)</span></label>
          <select value={tavoloId} onChange={e => setTavoloId(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 bg-white">
            <option value="">Nessuna preferenza</option>
            {tavoli.map(t => (
              <option key={t.id} value={t.id} disabled={tavoliOccupati.has(t.id)}>
                {t.nome} ({t.capienza} posti){tavoliOccupati.has(t.id) ? ' — non disponibile' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <AllergenSelector value={allergie} onChange={setAllergie} compact={compact} />

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
