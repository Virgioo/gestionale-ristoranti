// I 14 allergeni a dichiarazione obbligatoria UE (Reg. 1169/2011, allegato II)
export interface AllergeneDef { key: string; label: string; emoji: string; desc: string }

export const ALLERGENI: AllergeneDef[] = [
  { key: 'glutine',       emoji: '🌾', label: 'Glutine',          desc: 'grano, orzo, segale, avena' },
  { key: 'crostacei',     emoji: '🦐', label: 'Crostacei',        desc: 'gamberi, granchi, aragoste' },
  { key: 'uova',          emoji: '🥚', label: 'Uova',             desc: '' },
  { key: 'pesce',         emoji: '🐟', label: 'Pesce',            desc: '' },
  { key: 'arachidi',      emoji: '🥜', label: 'Arachidi',         desc: '' },
  { key: 'soia',          emoji: '🫘', label: 'Soia',             desc: '' },
  { key: 'latte',         emoji: '🥛', label: 'Latte',            desc: 'incluso lattosio' },
  { key: 'frutta_guscio', emoji: '🌰', label: 'Frutta a guscio',  desc: 'noci, mandorle, nocciole, anacardi, pistacchi' },
  { key: 'sedano',        emoji: '🥬', label: 'Sedano',           desc: '' },
  { key: 'senape',        emoji: '🌿', label: 'Senape',           desc: '' },
  { key: 'sesamo',        emoji: '🌱', label: 'Sesamo',           desc: '' },
  { key: 'solfiti',       emoji: '🍷', label: 'Solfiti',          desc: 'anidride solforosa, vino, aceto' },
  { key: 'lupini',        emoji: '🌼', label: 'Lupini',           desc: '' },
  { key: 'molluschi',     emoji: '🦑', label: 'Molluschi',        desc: 'cozze, vongole, polpo, calamari' },
]

const KNOWN_KEYS = new Set(ALLERGENI.map(a => a.key))

// Alias per compatibilità con i dati testuali già presenti nel DB (seed precedenti)
const LEGACY_ALIASES: Record<string, string> = {
  lattosio: 'latte',
  noci: 'frutta_guscio',
  'frutta a guscio': 'frutta_guscio',
  'frutta secca': 'frutta_guscio',
  mandorle: 'frutta_guscio',
}

function normalizeKey(raw: string): string {
  const k = raw.trim().toLowerCase()
  if (!k) return ''
  if (KNOWN_KEYS.has(k)) return k
  if (LEGACY_ALIASES[k]) return LEGACY_ALIASES[k]
  return k
}

/** Converte il valore grezzo salvato in DB (JSON array, o testo libero legacy) in un array di chiavi normalizzate. */
export function parseAllergie(raw: string | string[] | null | undefined): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return [...new Set(raw.map(v => normalizeKey(String(v))).filter(Boolean))]
  const trimmed = raw.trim()
  if (!trimmed) return []
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return [...new Set(parsed.map(v => normalizeKey(String(v))).filter(Boolean))]
  } catch {}
  // testo libero legacy, es. "glutine, crostacei"
  return [...new Set(trimmed.split(',').map(normalizeKey).filter(Boolean))]
}

/** Serializza le chiavi selezionate per il salvataggio nel campo testo del DB. Null se nessuna selezione. */
export function stringifyAllergie(keys: string[]): string | null {
  const clean = [...new Set(keys.filter(Boolean))]
  return clean.length ? JSON.stringify(clean) : null
}

export function getAllergeneDef(key: string): AllergeneDef | undefined {
  return ALLERGENI.find(a => a.key === key)
}

export function allergeneLabel(key: string): string {
  const def = getAllergeneDef(key)
  return def ? `${def.emoji} ${def.label}` : key
}
