'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { queryDB } from '@/lib/api'
import type { Sede } from '@/types/database'
import PrenotaForm from '@/components/PrenotaForm'

// Versione minimale del form, pensata per essere incorporata in un iframe
// nel sito del ristorante: nessun header, nessun footer, sfondo neutro.
export default function WidgetPage() {
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
      <div className="p-6 text-center">
        <span className="animate-pulse text-slate-400 text-sm">Caricamento…</span>
      </div>
    )
  }

  if (!sede || !sede.attiva) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-slate-500">Prenotazioni non disponibili.</p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-white">
      <PrenotaForm sede={sede} />
    </div>
  )
}
