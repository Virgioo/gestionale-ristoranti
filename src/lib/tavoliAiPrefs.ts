import type { AIFormValues } from '@/components/GeneraAIFormModal'

const LS_KEY = 'tavoli-ai-prefs'
const MAX_STORICO = 30
const MIN_OSSERVAZIONI_PER_SUGGERIMENTO = 2
const MIN_STORICO_PER_SUGGERIMENTO = 3

interface Generazione { form: AIFormValues; editCount: number; ts: number }
interface Prefs { lastUsed?: AIFormValues; storico: Generazione[] }

function leggi(): Prefs {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { storico: [] }
    const parsed = JSON.parse(raw)
    return { lastUsed: parsed.lastUsed, storico: Array.isArray(parsed.storico) ? parsed.storico : [] }
  } catch {
    return { storico: [] }
  }
}

function scrivi(p: Prefs) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)) } catch {}
}

/** Firma di una configurazione per raggrupparla nello storico: stile di layout
 *  + mix percentuale arrotondato al 10% più vicino (ignora numTavoli/speciali/note,
 *  che sono più legati alla singola sala che allo "stile" da imparare). */
function firma(form: AIFormValues): string {
  const arrotonda = (n: number) => Math.round(n / 10) * 10
  return `${form.layoutPref}|${arrotonda(form.mix.due)}|${arrotonda(form.mix.quattro)}|${arrotonda(form.mix.seiPiu)}`
}

/** Ultima configurazione usata, per precompilare il form. */
export function ultimaConfigurazione(): AIFormValues | null {
  return leggi().lastUsed ?? null
}

/** Configurazione che in passato ha richiesto meno modifiche manuali dopo la
 *  generazione (media più bassa di editCount), se ci sono abbastanza dati. */
export function configurazioneSuggerita(): AIFormValues | null {
  const { storico } = leggi()
  if (storico.length < MIN_STORICO_PER_SUGGERIMENTO) return null

  const gruppi: Record<string, { somma: number; n: number; ultimo: AIFormValues }> = {}
  for (const g of storico) {
    const f = firma(g.form)
    if (!gruppi[f]) gruppi[f] = { somma: 0, n: 0, ultimo: g.form }
    gruppi[f].somma += g.editCount
    gruppi[f].n++
    gruppi[f].ultimo = g.form
  }

  let migliore: { media: number; form: AIFormValues } | null = null
  for (const g of Object.values(gruppi)) {
    if (g.n < MIN_OSSERVAZIONI_PER_SUGGERIMENTO) continue
    const media = g.somma / g.n
    if (!migliore || media < migliore.media) migliore = { media, form: g.ultimo }
  }
  return migliore?.form ?? null
}

/** Registra l'esito di una generazione: quanto è stata modificata manualmente
 *  prima di essere confermata (editCount) — usato per imparare nel tempo. */
export function registraGenerazione(form: AIFormValues, editCount: number) {
  const prefs = leggi()
  prefs.lastUsed = form
  prefs.storico = [...prefs.storico, { form, editCount, ts: Date.now() }].slice(-MAX_STORICO)
  scrivi(prefs)
}
