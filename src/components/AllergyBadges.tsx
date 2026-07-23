import { parseAllergie, getAllergeneDef } from '@/lib/allergeni'

/** Badge di sola lettura per mostrare gli allergeni selezionati (liste, schede cliente, prenotazioni). */
export default function AllergyBadges({ value, size = 'md' }: {
  value: string | string[] | null | undefined
  size?: 'sm' | 'md'
}) {
  const keys = parseAllergie(value)
  if (keys.length === 0) return null
  const isSm = size === 'sm'

  return (
    <span className="inline-flex flex-wrap gap-1">
      {keys.map(k => {
        const def = getAllergeneDef(k)
        return (
          <span
            key={k}
            title={def ? `${def.label}${def.desc ? ' — ' + def.desc : ''}` : k}
            className={`inline-flex items-center gap-0.5 rounded-full font-medium ${
              isSm ? 'text-[10px] px-1 py-0' : 'text-[11px] px-1.5 py-0.5'
            } ${def ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}
          >
            <span>{def?.emoji ?? '⚠️'}</span>
            {!isSm && <span>{def?.label ?? k}</span>}
          </span>
        )
      })}
    </span>
  )
}
