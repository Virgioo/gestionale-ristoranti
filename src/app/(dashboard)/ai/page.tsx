'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGERIMENTI = [
  'Quante prenotazioni abbiamo oggi?',
  'Suggerisci piatti del menu adatti ai cani',
  'Come posso aumentare le prenotazioni nel weekend?',
  'Analizza il comportamento dei clienti VIP',
  'Crea un messaggio per una campagna email',
]

export default function AiPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text?: string) {
    const content = text ?? input.trim()
    if (!content || loading) return

    setInput('')
    const newMessages: Message[] = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${data.error ?? 'Errore API sconosciuto'}` }])
      } else {
        const reply = data.content?.[0]?.text ?? 'Risposta vuota.'
        setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Connessione all\'API fallita. Verifica che il server sia attivo.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200 bg-white">
        <h1 className="text-2xl font-bold text-slate-900">AI Assistant</h1>
        <p className="text-slate-500 text-sm">Assistente intelligente per la gestione del ristorante</p>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🤖</div>
            <h2 className="text-xl font-semibold text-slate-700 mb-2">Come posso aiutarti?</h2>
            <p className="text-slate-400 text-sm mb-8">Sono specializzato nella gestione di ristoranti italiani con menu cani</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
              {SUGGERIMENTI.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-full text-sm text-slate-600 hover:border-orange-400 hover:text-orange-600 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-sm shrink-0 mr-3 mt-0.5">
                🤖
              </div>
            )}
            <div className={cn(
              'max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
              m.role === 'user'
                ? 'bg-orange-500 text-white rounded-tr-sm'
                : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
            )}>
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-sm shrink-0">🤖</div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200 bg-white">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage() }}
          className="flex gap-3 max-w-4xl mx-auto"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Scrivi un messaggio..."
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition"
          >
            Invia
          </button>
        </form>
      </div>
    </div>
  )
}
