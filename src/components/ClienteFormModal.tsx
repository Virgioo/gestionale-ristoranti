'use client'

import { useEffect, useState } from 'react'
import { queryDB, insertDB, updateDB } from '@/lib/api'
import toast from 'react-hot-toast'
import AllergenSelector from './AllergenSelector'
import { parseAllergie, stringifyAllergie } from '@/lib/allergeni'

interface SedeOpt { id: string; nome: string }

// Il tipo esatto della riga cliente non è rilevante qui: il modale legge/scrive
// solo per nome di colonna, coerente con lo schema reale esposto da queryDB.
export type ClienteRecord = Record<string, unknown> & { id?: string }

const inputCls = 'mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  )
}

export default function ClienteFormModal({ cliente, onClose, onSaved }: {
  cliente?: ClienteRecord | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!cliente?.id
  const [sedi, setSedi] = useState<SedeOpt[]>([])
  const [saving, setSaving] = useState(false)

  const [nome, setNome] = useState(String(cliente?.nome ?? ''))
  const [cognome, setCognome] = useState(String(cliente?.cognome ?? ''))
  const [email, setEmail] = useState(String(cliente?.email ?? ''))
  const [telefono, setTelefono] = useState(String(cliente?.telefono ?? ''))
  const [whatsapp, setWhatsapp] = useState(Boolean(cliente?.whatsapp_attivo ?? false))
  const [tier, setTier] = useState(String(cliente?.tier ?? ''))
  const [sedeId, setSedeId] = useState(String(cliente?.sede_principale_id ?? ''))
  const [dataNascita, setDataNascita] = useState(String(cliente?.data_nascita ?? ''))
  const [allergie, setAllergie] = useState<string[]>(parseAllergie(cliente?.allergie as string | null))
  const [preferenze, setPreferenze] = useState(String(cliente?.preferenze_tavolo ?? ''))
  const [bevande, setBevande] = useState(String(cliente?.bevande_preferite ?? ''))
  const [noteCucina, setNoteCucina] = useState(String(cliente?.note_cucina ?? ''))
  const [noteInterne, setNoteInterne] = useState(String(cliente?.note_interne ?? ''))
  const [attivo, setAttivo] = useState(Boolean(cliente?.attivo ?? true))

  useEffect(() => {
    queryDB<SedeOpt>('sedi', { select: 'id,nome', order: { col: 'nome' } }).then(setSedi).catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim() || !cognome.trim()) { toast.error('Nome e cognome sono obbligatori'); return }
    setSaving(true)
    const values = {
      nome: nome.trim(),
      cognome: cognome.trim(),
      email: email.trim() || null,
      telefono: telefono.trim() || null,
      whatsapp_attivo: whatsapp,
      tier: tier || null,
      sede_principale_id: sedeId || null,
      data_nascita: dataNascita || null,
      allergie: stringifyAllergie(allergie),
      preferenze_tavolo: preferenze.trim() || null,
      bevande_preferite: bevande.trim() || null,
      note_cucina: noteCucina.trim() || null,
      note_interne: noteInterne.trim() || null,
      attivo,
    }
    try {
      if (isEdit) await updateDB('clienti', values, { id: cliente!.id as string })
      else await insertDB('clienti', values)
      toast.success(isEdit ? 'Cliente aggiornato' : 'Cliente creato')
      onSaved()
      onClose()
    } catch {
      toast.error('Errore nel salvataggio del cliente')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">{isEdit ? 'Modifica cliente' : 'Nuovo cliente'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome *">
              <input required autoFocus value={nome} onChange={e => setNome(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Cognome *">
              <input required value={cognome} onChange={e => setCognome(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Telefono">
              <input value={telefono} onChange={e => setTelefono(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tier">
              <select value={tier} onChange={e => setTier(e.target.value)} className={inputCls}>
                <option value="">—</option>
                <option value="Gold">Gold</option>
                <option value="Platinum">Platinum</option>
                <option value="Diamante">Diamante</option>
              </select>
            </Field>
            <Field label="Sede principale">
              <select value={sedeId} onChange={e => setSedeId(e.target.value)} className={inputCls}>
                <option value="">—</option>
                {sedi.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data di nascita">
              <input type="date" value={dataNascita} onChange={e => setDataNascita(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Preferenze tavolo">
              <input value={preferenze} onChange={e => setPreferenze(e.target.value)} placeholder="terrazza, prive…" className={inputCls} />
            </Field>
          </div>

          <AllergenSelector value={allergie} onChange={setAllergie} compact />

          <Field label="Bevande preferite">
            <input value={bevande} onChange={e => setBevande(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Note cucina">
            <textarea value={noteCucina} onChange={e => setNoteCucina(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </Field>
          <Field label="Note interne">
            <textarea value={noteInterne} onChange={e => setNoteInterne(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </Field>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={whatsapp} onChange={e => setWhatsapp(e.target.checked)} className="rounded" />
              WhatsApp attivo
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={attivo} onChange={e => setAttivo(e.target.checked)} className="rounded" />
              Cliente attivo
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-600 hover:border-slate-400 transition">
              Annulla
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-lg text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 transition disabled:opacity-60">
              {saving ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Crea cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
