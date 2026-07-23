'use client'

import { ALLERGENI } from '@/lib/allergeni'

export default function AllergenSelector({ value, onChange, compact }: {
  value: string[]
  onChange: (next: string[]) => void
  compact?: boolean
}) {
  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key])
  }

  return (
    <div>
      <label className="text-xs font-medium text-slate-600">Allergie e intolleranze</label>
      <div className={`mt-1.5 grid grid-cols-2 ${compact ? 'gap-1.5' : 'gap-2'}`}>
        {ALLERGENI.map(a => {
          const selected = value.includes(a.key)
          return (
            <label
              key={a.key}
              className={`flex items-start gap-2 rounded-lg border cursor-pointer transition px-2.5 ${compact ? 'py-1.5' : 'py-2.5'} ${
                selected ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggle(a.key)}
                className={`shrink-0 rounded accent-green-600 ${compact ? 'w-4 h-4 mt-0.5' : 'w-5 h-5 mt-0.5'}`}
              />
              <span className={compact ? 'text-sm leading-none shrink-0' : 'text-lg leading-none shrink-0'}>{a.emoji}</span>
              <span className="min-w-0">
                <span className={`block font-medium ${compact ? 'text-xs' : 'text-sm'} ${selected ? 'text-green-800' : 'text-slate-700'}`}>
                  {a.label}
                </span>
                {!compact && a.desc && (
                  <span className="block text-[11px] text-slate-400">{a.desc}</span>
                )}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
