'use client'

import { useEffect, useState } from 'react'
import { queryDB, updateDB, insertDB, deleteDB } from '@/lib/api'
import toast from 'react-hot-toast'

interface Turni {
  lun: string | null; mar: string | null; mer: string | null
  gio: string | null; ven: string | null; sab: string | null; dom: string | null
}

interface StaffMember {
  id: string
  nome: string; cognome: string; ruolo: string
  email: string | null; telefono: string | null
  attivo: boolean; sede_id: string | null
  note: string | null; turni: Turni | null
  sedi?: { nome: string; citta: string } | null
}

interface Sede { id: string; nome: string; citta: string }

const RUOLI_CUCINA = ['executive chef', 'sous chef', 'chef de partie', 'commis di cucina', 'garde manger', 'pastry chef', 'cassiere', 'economo', 'magazziniere']
const RUOLI_SALA   = ['maitre', 'chef de rang', 'commis di sala', 'runner', 'sommelier', 'hostess', 'barman', 'receptionist']
const ALL_RUOLI    = [...RUOLI_CUCINA, ...RUOLI_SALA]

const RUOLO_COLORS: Record<string, string> = {
  'executive chef':   'bg-red-700 text-white',
  'sous chef':        'bg-red-100 text-red-700',
  'chef de partie':   'bg-orange-100 text-orange-700',
  'commis di cucina': 'bg-amber-100 text-amber-700',
  'garde manger':     'bg-yellow-100 text-yellow-700',
  'pastry chef':      'bg-pink-100 text-pink-700',
  'cassiere':         'bg-amber-50 text-amber-600',
  'economo':          'bg-lime-100 text-lime-700',
  'magazziniere':     'bg-stone-100 text-stone-600',
  'maitre':           'bg-purple-700 text-white',
  'chef de rang':     'bg-blue-100 text-blue-700',
  'commis di sala':   'bg-cyan-100 text-cyan-700',
  'runner':           'bg-teal-100 text-teal-700',
  'sommelier':        'bg-emerald-100 text-emerald-700',
  'hostess':          'bg-indigo-100 text-indigo-700',
  'barman':           'bg-violet-100 text-violet-700',
  'receptionist':     'bg-rose-100 text-rose-600',
}

const GIORNI: { key: keyof Turni; label: string; short: string }[] = [
  { key: 'lun', label: 'Lunedì',    short: 'L' },
  { key: 'mar', label: 'Martedì',   short: 'M' },
  { key: 'mer', label: 'Mercoledì', short: 'M' },
  { key: 'gio', label: 'Giovedì',   short: 'G' },
  { key: 'ven', label: 'Venerdì',   short: 'V' },
  { key: 'sab', label: 'Sabato',    short: 'S' },
  { key: 'dom', label: 'Domenica',  short: 'D' },
]

const TURNI_VUOTI: Turni = { lun: null, mar: null, mer: null, gio: null, ven: null, sab: null, dom: null }

const MOCK_STAFF: StaffMember[] = [
  { id: 's1',  nome: 'Roberto',    cognome: 'Cenci',        ruolo: 'maitre',          email: 'roberto.cenci@scoglieragroup.it',        telefono: '+39 340 1122334', attivo: true,  sede_id: null, note: null, turni: null },
  { id: 's2',  nome: 'Francesca',  cognome: 'Moretti',      ruolo: 'chef de rang',    email: 'francesca.moretti@scoglieragroup.it',    telefono: '+39 347 5566778', attivo: true,  sede_id: null, note: null, turni: null },
  { id: 's3',  nome: 'Simone',     cognome: 'Mastroianni',  ruolo: 'chef de rang',    email: 'simone.mastroianni@scoglieragroup.it',   telefono: '+39 338 9900112', attivo: true,  sede_id: null, note: null, turni: null },
  { id: 's4',  nome: 'Leonardo',   cognome: 'Pace',         ruolo: 'commis di sala',  email: 'leonardo.pace@scoglieragroup.it',        telefono: '+39 345 2233445', attivo: true,  sede_id: null, note: null, turni: null },
  { id: 's5',  nome: 'Valentina',  cognome: 'Greco',        ruolo: 'commis di sala',  email: 'valentina.greco@scoglieragroup.it',      telefono: null,              attivo: true,  sede_id: null, note: null, turni: null },
  { id: 's6',  nome: 'Daniele',    cognome: 'Ricci',        ruolo: 'runner',          email: 'daniele.ricci@scoglieragroup.it',        telefono: '+39 349 3344556', attivo: true,  sede_id: null, note: null, turni: null },
  { id: 's7',  nome: 'Chiara',     cognome: 'Santini',      ruolo: 'runner',          email: 'chiara.santini@scoglieragroup.it',       telefono: null,              attivo: true,  sede_id: null, note: null, turni: null },
  { id: 's8',  nome: 'Mario',      cognome: 'Bellosi',      ruolo: 'executive chef',  email: 'mario.bellosi@scoglieragroup.it',        telefono: '+39 335 4455667', attivo: true,  sede_id: null, note: null, turni: null },
  { id: 's9',  nome: 'Anna',       cognome: 'Rinaldi',      ruolo: 'sous chef',       email: 'anna.rinaldi@scoglieragroup.it',         telefono: '+39 333 5566778', attivo: true,  sede_id: null, note: null, turni: null },
  { id: 's10', nome: 'Enrico',     cognome: 'Silvestri',    ruolo: 'chef de partie',  email: 'enrico.silvestri@scoglieragroup.it',     telefono: null,              attivo: false, sede_id: null, note: null, turni: null },
]

// ─── Sub-components ──────────────────────────────────────────────────────────

function RuoloBadge({ ruolo }: { ruolo: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${RUOLO_COLORS[ruolo] ?? 'bg-gray-100 text-gray-600'}`}>
      {ruolo}
    </span>
  )
}

function TurniDots({ turni }: { turni: Turni | null }) {
  return (
    <div className="flex gap-1 mt-2">
      {GIORNI.map(g => (
        <div
          key={g.key}
          title={`${g.label}: ${turni?.[g.key] ?? 'Riposo'}`}
          className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${turni?.[g.key] ? 'bg-orange-400 text-white' : 'bg-slate-100 text-slate-400'}`}
        >
          {g.short}
        </div>
      ))}
    </div>
  )
}

function StaffCard({ member, onClick }: { member: StaffMember; onClick: () => void }) {
  const initials = `${member.nome[0]}${member.cognome[0]}`
  const sede = member.sedi?.nome ?? null
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border p-5 cursor-pointer hover:border-orange-300 hover:shadow-sm transition ${!member.attivo ? 'opacity-60' : 'border-slate-200'}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-900 truncate">{member.nome} {member.cognome}</p>
            {!member.attivo && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Inattivo</span>}
          </div>
          <RuoloBadge ruolo={member.ruolo} />
        </div>
      </div>
      {sede && <p className="text-xs text-slate-400 mt-2">📍 {sede}</p>}
      {member.email && <p className="text-xs text-slate-400 truncate">✉️ {member.email}</p>}
      {member.telefono && <p className="text-xs text-slate-400">📞 {member.telefono}</p>}
      <TurniDots turni={member.turni} />
    </div>
  )
}

// ─── Slide Panel ─────────────────────────────────────────────────────────────

interface SlidePanelProps {
  member: StaffMember
  sedi: Sede[]
  isMock: boolean
  editTurni: Turni
  setEditTurni: (t: Turni) => void
  editNote: string
  setEditNote: (n: string) => void
  saving: boolean
  confirmDelete: boolean
  setConfirmDelete: (v: boolean) => void
  onClose: () => void
  onSaveTurni: () => void
  onSaveNote: () => void
  onToggleAttivo: () => void
  onDelete: () => void
}

function SlidePanel({
  member, sedi, isMock, editTurni, setEditTurni, editNote, setEditNote,
  saving, confirmDelete, setConfirmDelete, onClose, onSaveTurni, onSaveNote, onToggleAttivo, onDelete
}: SlidePanelProps) {
  const [tab, setTab] = useState<'info' | 'turni' | 'note'>('info')
  const sede = sedi.find(s => s.id === member.sede_id)

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/20" onClick={onClose} />
      <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold shrink-0">
              {member.nome[0]}{member.cognome[0]}
            </div>
            <div>
              <p className="font-bold text-slate-900 text-lg">{member.nome} {member.cognome}</p>
              <RuoloBadge ruolo={member.ruolo} />
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none mt-1">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          {(['info', 'turni', 'note'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium capitalize transition ${tab === t ? 'border-b-2 border-orange-500 text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t === 'info' ? 'Dettagli' : t === 'turni' ? 'Turni' : 'Note'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-5">
          {tab === 'info' && (
            <div className="space-y-4">
              {sede && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1">Sede assegnata</p>
                  <p className="font-medium text-slate-800">📍 {sede.nome}</p>
                  {sede.citta && <p className="text-xs text-slate-500">{sede.citta}</p>}
                </div>
              )}
              <div className="space-y-2">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Contatti</p>
                {member.email && (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="text-slate-400">✉️</span>
                    <a href={`mailto:${member.email}`} className="hover:text-orange-600 hover:underline">{member.email}</a>
                  </div>
                )}
                {member.telefono && (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="text-slate-400">📞</span>
                    <a href={`tel:${member.telefono}`} className="hover:text-orange-600 hover:underline">{member.telefono}</a>
                  </div>
                )}
                {!member.email && !member.telefono && <p className="text-sm text-slate-400">Nessun contatto registrato</p>}
              </div>
              <div className="flex items-center justify-between py-3 border-t border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-800">Stato</p>
                  <p className="text-xs text-slate-400">{member.attivo ? 'Membro attivo' : 'Membro inattivo'}</p>
                </div>
                <button
                  onClick={onToggleAttivo}
                  disabled={isMock}
                  className={`relative w-11 h-6 rounded-full transition-colors ${member.attivo ? 'bg-orange-500' : 'bg-slate-300'} disabled:opacity-50`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${member.attivo ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </div>
          )}

          {tab === 'turni' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">Inserisci l&apos;orario per ogni giorno lavorativo (es: 08:00 - 16:00). Lascia vuoto per giorno di riposo.</p>
              {GIORNI.map(g => {
                const val = editTurni[g.key] ?? ''
                const isWorking = !!val
                return (
                  <div key={g.key} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isWorking ? 'bg-orange-400 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {g.short}
                    </div>
                    <div className="w-16 text-sm text-slate-600 shrink-0">{g.label.slice(0, 3)}</div>
                    <input
                      type="text"
                      value={val}
                      onChange={e => setEditTurni({ ...editTurni, [g.key]: e.target.value || null })}
                      placeholder="Riposo"
                      className="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                  </div>
                )
              })}
              <button
                onClick={onSaveTurni}
                disabled={saving || isMock}
                className="w-full mt-2 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
              >
                {saving ? 'Salvataggio…' : 'Salva turni'}
              </button>
              {isMock && <p className="text-xs text-center text-slate-400">Disponibile con dati DB reali</p>}
            </div>
          )}

          {tab === 'note' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">Note personali, preferenze, informazioni utili per il servizio.</p>
              <textarea
                value={editNote}
                onChange={e => setEditNote(e.target.value)}
                rows={8}
                placeholder="Es: Allergia ai latticini. Preferisce turni serali. Certificazione sommelier FISAR…"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none"
              />
              <button
                onClick={onSaveNote}
                disabled={saving || isMock}
                className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
              >
                {saving ? 'Salvataggio…' : 'Salva note'}
              </button>
              {isMock && <p className="text-xs text-center text-slate-400">Disponibile con dati DB reali</p>}
            </div>
          )}
        </div>

        {/* Footer — delete */}
        <div className="p-5 border-t border-slate-100">
          {confirmDelete ? (
            <div className="flex gap-2">
              <button
                onClick={onDelete}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition"
              >
                Conferma eliminazione
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
              >
                Annulla
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={isMock}
              className="w-full py-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg text-sm font-medium transition disabled:opacity-40"
            >
              🗑 Elimina membro
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Add Staff Modal ──────────────────────────────────────────────────────────

function AddStaffModal({ sedi, onClose, onAdd }: {
  sedi: Sede[]
  onClose: () => void
  onAdd: (v: Record<string, unknown>) => Promise<void>
}) {
  const [form, setForm] = useState({
    nome: '', cognome: '', ruolo: ALL_RUOLI[0], email: '', telefono: '', sede_id: '', attivo: true
  })
  const [saving, setSaving] = useState(false)

  function set(k: string, v: unknown) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim() || !form.cognome.trim()) return
    setSaving(true)
    try {
      await onAdd({
        nome: form.nome.trim(),
        cognome: form.cognome.trim(),
        ruolo: form.ruolo,
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        sede_id: form.sede_id || null,
        attivo: form.attivo,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-lg">Aggiungi Staff</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">Nome *</label>
              <input value={form.nome} onChange={e => set('nome', e.target.value)} required
                className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">Cognome *</label>
              <input value={form.cognome} onChange={e => set('cognome', e.target.value)} required
                className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Ruolo *</label>
            <select value={form.ruolo} onChange={e => set('ruolo', e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white capitalize">
              <optgroup label="🍳 Cucina">
                {RUOLI_CUCINA.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
              </optgroup>
              <optgroup label="🍽 Sala">
                {RUOLI_SALA.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
              </optgroup>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Sede</label>
            <select value={form.sede_id} onChange={e => set('sede_id', e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white">
              <option value="">— Nessuna sede —</option>
              {sedi.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="nome@scoglieragroup.it"
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400" />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Telefono</label>
            <input value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+39 345 1234567"
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400" />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <input type="checkbox" id="attivo" checked={form.attivo} onChange={e => set('attivo', e.target.checked)}
              className="accent-orange-500" />
            <label htmlFor="attivo" className="text-sm text-slate-700">Membro attivo</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-slate-300 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition">
              Annulla
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition">
              {saving ? 'Salvataggio…' : 'Aggiungi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [sedi, setSedi] = useState<Sede[]>([])
  const [loading, setLoading] = useState(true)
  const [isMock, setIsMock] = useState(false)
  const [categoria, setCategoria] = useState<'tutti' | 'cucina' | 'sala'>('tutti')
  const [filtroRuolo, setFiltroRuolo] = useState('tutti')
  const [filtroSede, setFiltroSede] = useState('tutte')
  const [soloAttivi, setSoloAttivi] = useState(true)
  const [selected, setSelected] = useState<StaffMember | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editTurni, setEditTurni] = useState<Turni>(TURNI_VUOTI)
  const [editNote, setEditNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    queryDB<Sede>('sedi', { select: 'id,nome,citta', order: { col: 'nome' } })
      .then(setSedi).catch(() => {})
  }, [])

  useEffect(() => { load() }, [categoria, filtroRuolo, filtroSede, soloAttivi])

  useEffect(() => {
    if (selected) {
      setEditTurni(selected.turni ?? TURNI_VUOTI)
      setEditNote(selected.note ?? '')
      setConfirmDelete(false)
    }
  }, [selected?.id])

  async function load() {
    setLoading(true)
    try {
      const filters: { fn: string; args: unknown[] }[] = []
      if (filtroRuolo !== 'tutti') {
        filters.push({ fn: 'eq', args: ['ruolo', filtroRuolo] })
      } else if (categoria === 'cucina') {
        filters.push({ fn: 'in', args: ['ruolo', RUOLI_CUCINA] })
      } else if (categoria === 'sala') {
        filters.push({ fn: 'in', args: ['ruolo', RUOLI_SALA] })
      }
      if (soloAttivi) filters.push({ fn: 'eq', args: ['attivo', true] })
      if (filtroSede !== 'tutte') filters.push({ fn: 'eq', args: ['sede_id', filtroSede] })

      const data = await queryDB<StaffMember>('staff', {
        select: 'id,nome,cognome,ruolo,email,telefono,attivo,sede_id,note,turni,sedi(nome,citta)',
        filters,
        order: { col: 'cognome' },
      })
      setStaff(data)
      if (selected) {
        const updated = data.find(m => m.id === selected.id)
        if (updated) setSelected(updated)
      }
      setIsMock(false)
    } catch {
      let data = MOCK_STAFF
      if (filtroRuolo !== 'tutti') data = data.filter(m => m.ruolo === filtroRuolo)
      else if (categoria === 'cucina') data = data.filter(m => RUOLI_CUCINA.includes(m.ruolo))
      else if (categoria === 'sala') data = data.filter(m => RUOLI_SALA.includes(m.ruolo))
      if (soloAttivi) data = data.filter(m => m.attivo)
      setStaff([...data].sort((a, b) => a.cognome.localeCompare(b.cognome)))
      setIsMock(true)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveTurni() {
    if (!selected || isMock) return
    setSaving(true)
    try {
      await updateDB('staff', { turni: editTurni }, { id: selected.id })
      setStaff(prev => prev.map(m => m.id === selected.id ? { ...m, turni: editTurni } : m))
      setSelected(prev => prev ? { ...prev, turni: editTurni } : null)
      toast.success('Turni salvati')
    } catch (e: unknown) {
      toast.error(e instanceof Error && e.message.includes('column') ? 'Esegui prima la migrazione SQL per abilitare i turni' : 'Errore')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveNote() {
    if (!selected || isMock) return
    setSaving(true)
    try {
      await updateDB('staff', { note: editNote }, { id: selected.id })
      setStaff(prev => prev.map(m => m.id === selected.id ? { ...m, note: editNote } : m))
      setSelected(prev => prev ? { ...prev, note: editNote } : null)
      toast.success('Note salvate')
    } catch {
      toast.error('Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleAttivo() {
    if (!selected || isMock) return
    const next = !selected.attivo
    try {
      await updateDB('staff', { attivo: next }, { id: selected.id })
      setStaff(prev => prev.map(m => m.id === selected.id ? { ...m, attivo: next } : m))
      setSelected(prev => prev ? { ...prev, attivo: next } : null)
      toast.success(next ? 'Staff attivato' : 'Staff disattivato')
    } catch { toast.error('Errore') }
  }

  async function handleDelete() {
    if (!selected || isMock) return
    try {
      await deleteDB('staff', { id: selected.id })
      setStaff(prev => prev.filter(m => m.id !== selected.id))
      setSelected(null)
      toast.success('Membro eliminato')
    } catch { toast.error('Errore nell\'eliminazione') }
  }

  async function handleAdd(values: Record<string, unknown>) {
    await insertDB('staff', values)
    await load()
    setShowAdd(false)
    toast.success('Staff aggiunto')
  }

  const ruoliPerCategoria = categoria === 'cucina' ? RUOLI_CUCINA : categoria === 'sala' ? RUOLI_SALA : ALL_RUOLI

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff</h1>
          <p className="text-slate-500 text-sm">{staff.length} membri{soloAttivi ? ' attivi' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          {isMock && <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">Dati di esempio</span>}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium text-sm transition"
          >
            + Aggiungi Staff
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex border-b border-slate-200">
        {(['tutti', 'cucina', 'sala'] as const).map(cat => (
          <button
            key={cat}
            onClick={() => { setCategoria(cat); setFiltroRuolo('tutti') }}
            className={`px-5 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
              categoria === cat ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {cat === 'tutti' ? 'Tutti' : cat === 'cucina' ? '🍳 Cucina' : '🍽 Sala'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => setFiltroRuolo('tutti')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filtroRuolo === 'tutti' ? 'bg-orange-500 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:border-orange-300'}`}
        >
          Tutti i ruoli
        </button>
        {ruoliPerCategoria.map(r => (
          <button key={r} onClick={() => setFiltroRuolo(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${filtroRuolo === r ? 'bg-orange-500 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:border-orange-300'}`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <select
          value={filtroSede}
          onChange={e => setFiltroSede(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs border border-slate-300 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
        >
          <option value="tutte">Tutte le sedi</option>
          {sedi.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <button
          onClick={() => setSoloAttivi(!soloAttivi)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${soloAttivi ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-300 hover:border-orange-300'}`}
        >
          Solo attivi
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-slate-200 rounded-xl animate-pulse" />)}
        </div>
      ) : staff.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">Nessun membro trovato</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {staff.map(m => (
            <StaffCard key={m.id} member={m} onClick={() => setSelected(m)} />
          ))}
        </div>
      )}

      {/* Slide Panel */}
      {selected && (
        <SlidePanel
          member={selected}
          sedi={sedi}
          isMock={isMock}
          editTurni={editTurni}
          setEditTurni={setEditTurni}
          editNote={editNote}
          setEditNote={setEditNote}
          saving={saving}
          confirmDelete={confirmDelete}
          setConfirmDelete={setConfirmDelete}
          onClose={() => { setSelected(null); setConfirmDelete(false) }}
          onSaveTurni={handleSaveTurni}
          onSaveNote={handleSaveNote}
          onToggleAttivo={handleToggleAttivo}
          onDelete={handleDelete}
        />
      )}

      {/* Add Modal */}
      {showAdd && (
        <AddStaffModal
          sedi={sedi}
          onClose={() => setShowAdd(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  )
}
