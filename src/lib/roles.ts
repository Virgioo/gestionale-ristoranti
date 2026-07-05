import type { User } from '@supabase/supabase-js'

export function isAdmin(user: User | null): boolean {
  if (!user) return false
  if (user.app_metadata?.role === 'admin') return true
  const list = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return list.includes((user.email ?? '').toLowerCase())
}
