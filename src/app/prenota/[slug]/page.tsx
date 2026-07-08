'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { queryDB, insertDB } from '@/lib/api'
import type { Sede } from '@/types/database'

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export default function PrenotaPage() {
  const { slug } = useParams<{ slug: string }>()
  const [sede, setSede] = useState<Sede | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviata, setInviata] = useState(false)
  const [inviando, setInviando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [telefono, setTelefono] = useState('')
  const [data, setData] = useState(todayISO())
  const [ora, setOra] = useState('20:00')
  const [coperti, setCoperti] = useState(2)
  const [conAnimale, setConAnimale] = useState(false)
  const [allergie, setAllergie] = useState('')
  const [occasione, setOccasione] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    async function load() {
      const rows = await queryDB<Sede>('sedi', {
        filters: [{ fn: 'eq', args: ['slug', slug] }],
        limit: 1,
      })
      setSede(rows[0] ?? null)
      setLoading(false)
    }
    load()
  }, [slug])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!sede) return
    setErrore(null)
    setInviando(true)
    try {
      await insertDB('prenotazioni', {
        sede_id: sede.id,
        nome_ospite: nome.trim(),
        telefono_ospite: telefono.trim() || null,
        data_prenotazione: data,
        ora_arrivo: ora,
        coperti,
        con_animale: conAnimale,
        allergie_comunicare: allergie.trim() || null,
        occasione_speciale: occasione.trim() || null,
        note_speciali: note.trim() || null,
        stato: 'in_attesa',
        origine: 'web',
      })
      setInviata(true)
    } catch {
      setErrore('Non siamo riusciti a registrare la prenotazione. Riprova o chiamaci telefonicamente.')
    } finally {
      setInviando(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-400 text-sm">Caricamento…</div>
      </div>
    )
  }

  if (!sede || !sede.attiva) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-sm">
          <p className="text-3xl mb-3">🍽️</p>
          <h1 className="text-lg font-semibold text-slate-900">Sede non trovata</h1>
          <p className="text-sm text-slate-500 mt-1">Il link che hai seguito non corrisponde a nessuna sede attiva.</p>
        </div>
      </div>
    )
  }

  const accent = sede.colore_hex || '#f97316'

  if (inviata) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-sm bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <p className="text-4xl mb-3">✅</p>
          <h1 className="text-lg font-semibold text-slate-900">Richiesta inviata!</h1>
          <p className="text-sm text-slate-500 mt-2">
            Abbiamo ricevuto la tua richiesta di prenotazione per <strong>{sede.nome}</strong>.
            Ti contatteremo al numero indicato per la conferma.
          </p>
          <button
            onClick={() => { setInviata(false); setNome(''); setTelefono(''); setNote(''); setAllergie(''); setOccasione(''); setConAnimale(false); setCoperti(2) }}
            className="mt-5 text-xs font-medium hover:underline"
            style={{ color: accent }}
          >
            Fai un'altra prenotazione
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <div className="px-6 pt-10 pb-6 text-center text-white" style={{ backgroundColor: accent }}>
        <h1 className="text-xl font-bold">{sede.nome}</h1>
        {sede.tipo && <p className="text-sm text-white/80">{sede.tipo}</p>}
        <p className="text-xs text-white/70 mt-2">{sede.indirizzo}, {sede.citta}</p>
        <div className="flex items-center justify-center gap-3 mt-2 text-xs text-white/80 flex-wrap">
          {sede.orari_pranzo && <span>🍽️ Pranzo {sede.orari_pranzo}</span>}
          {sede.orari_cena && <span>🌙 Cena {sede.orari_cena}</span>}
          {sede.pet_friendly && <span>🐕 Pet friendly</span>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-6 px-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Prenota un tavolo</h2>

        <div>
          <label className="text-xs font-medium text-slate-600">Nome e cognome *</label>
          <input required value={nome} onChange={e => setNome(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': accent } as React.CSSProperties} />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600">Telefono *</label>
          <input required type="tel" value={telefono} onChange={e => setTelefono(e.target.value)}
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
    </div>
  )
}
