'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { queryDB } from '@/lib/api'
import type { Sede } from '@/types/database'
import PrenotaForm from '@/components/PrenotaForm'

export default function PrenotaPage() {
  const { slug } = useParams<{ slug: string }>()
  const [sede, setSede] = useState<Sede | null>(null)
  const [loading, setLoading] = useState(true)

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

      <div className="mt-6 px-6">
        <PrenotaForm sede={sede} />
      </div>
    </div>
  )
}
