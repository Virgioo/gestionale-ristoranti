'use client'

import { useEffect, useState } from 'react'
import { queryDB, updateDB } from '@/lib/api'
import { useAppStore } from '@/store'
import type { Sede } from '@/types/database'
import toast from 'react-hot-toast'

export default function SediPage() {
  const [sedi, setSedi] = useState<Sede[]>([])
  const [loading, setLoading] = useState(true)
  const { selectedSede, setSelectedSede } = useAppStore()

  useEffect(() => {
    async function load() {
      const data = await queryDB<Sede>('sedi', { order: { col: 'nome' } })
      setSedi(data)
      setLoading(false)
    }
    load()
  }, [])

  async function toggleAttiva(id: string, attiva: boolean) {
    try {
      await updateDB('sedi', { attiva }, { id })
      setSedi(prev => prev.map(s => s.id === id ? { ...s, attiva } : s))
      toast.success(attiva ? 'Sede attivata' : 'Sede disattivata')
    } catch {
      toast.error('Errore')
    }
  }

  function selezionaSede(sede: Sede) {
    setSelectedSede(sede)
    toast.success(`Sede selezionata: ${sede.nome}`)
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sedi</h1>
        <p className="text-slate-500 text-sm">{sedi.length} sedi configurate</p>
      </div>

      {selectedSede && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📍</span>
            <div>
              <p className="text-sm font-semibold text-orange-900">Sede attiva: {selectedSede.nome}</p>
              <p className="text-xs text-orange-600">{selectedSede.indirizzo}, {selectedSede.citta}</p>
            </div>
          </div>
          <button onClick={() => setSelectedSede(null)} className="text-xs text-orange-400 hover:text-orange-600">Deseleziona</button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-slate-200 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {sedi.map(sede => (
            <div key={sede.id} className={`bg-white rounded-xl border p-5 transition ${selectedSede?.id === sede.id ? 'border-orange-400 ring-2 ring-orange-200' : 'border-slate-200 hover:border-orange-200'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{sede.nome}</h3>
                  <p className="text-sm text-slate-500">{sede.citta}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sede.attiva ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {sede.attiva ? 'Attiva' : 'Inattiva'}
                </span>
              </div>

              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">📍</span>
                  <span>{sede.indirizzo}</span>
                </div>
                {sede.telefono && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">📞</span>
                    <span>{sede.telefono}</span>
                  </div>
                )}
                {sede.email && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">✉️</span>
                    <span>{sede.email}</span>
                  </div>
                )}
                {sede.coperti_totali != null && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">💺</span>
                    <span>{sede.coperti_totali} coperti</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                <button
                  onClick={() => selezionaSede(sede)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${selectedSede?.id === sede.id ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                >
                  {selectedSede?.id === sede.id ? '✓ Selezionata' : 'Seleziona'}
                </button>
                <button
                  onClick={() => toggleAttiva(sede.id, !sede.attiva)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 text-slate-600 hover:border-orange-300 transition"
                >
                  {sede.attiva ? 'Disattiva' : 'Attiva'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
