'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { createClient } from '@/lib/supabase'
import { countDB } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  LayoutDashboard, Users, CalendarDays, TrendingUp,
  Building2, UtensilsCrossed, UserCheck, Star,
  Megaphone, Bell, Sparkles, LogOut, ChevronLeft, ChevronRight, LayoutGrid, Package, ClipboardList, ChefHat, PlayCircle,
} from 'lucide-react'
import { isAdmin } from '@/lib/roles'

const NAV = [
  { href: '/dashboard',    label: 'Dashboard',    Icon: LayoutDashboard },
  { href: '/clienti',      label: 'Clienti',       Icon: Users },
  { href: '/prenotazioni', label: 'Prenotazioni',  Icon: CalendarDays },
  { href: '/tavoli',       label: 'Disposizione tavoli', Icon: LayoutGrid },
  { href: '/comande',      label: 'Comande',       Icon: ClipboardList },
  { href: '/cucina',       label: 'Cucina (KDS)',  Icon: ChefHat },
  { href: '/revenue',      label: 'Revenue',       Icon: TrendingUp },
  { href: '/sedi',         label: 'Sedi',          Icon: Building2 },
  { href: '/menu',         label: 'Menu',          Icon: UtensilsCrossed },
  { href: '/staff',        label: 'Staff',         Icon: UserCheck },
  { href: '/economato',    label: 'Economato',     Icon: Package },
  { href: '/eventi',       label: 'Eventi',        Icon: Star },
  { href: '/marketing',    label: 'Marketing',     Icon: Megaphone },
  { href: '/notifiche',    label: 'Notifiche',     Icon: Bell },
  { href: '/ai',           label: 'AI Assistant',  Icon: Sparkles },
]

const NAV_ADMIN = [
  { href: '/simulazione', label: 'Simulazione', Icon: PlayCircle },
]

export default function Sidebar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const { sidebarCollapsed, toggleSidebar, unreadCount } = useAppStore()
  const [occupiedTavoli, setOccupiedTavoli] = useState(0)
  const [adminUser,      setAdminUser]      = useState(false)

  useEffect(() => {
    async function fetchOccupied() {
      try {
        const n = await countDB('stato_tavoli', [{ fn: 'eq', args: ['stato', 'occupato'] }])
        setOccupiedTavoli(n)
      } catch {}
    }
    fetchOccupied()
    const id = setInterval(fetchOccupied, 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setAdminUser(isAdmin(data?.user ?? null)))
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Disconnesso')
    router.push('/login')
    router.refresh()
  }

  const collapsed = sidebarCollapsed

  return (
    <aside
      style={{ width: collapsed ? 56 : 220 }}
      className="fixed left-0 top-0 h-full bg-gray-900 flex flex-col transition-[width] duration-200 z-40 overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 h-12 border-b border-gray-800 shrink-0">
        <div className="w-7 h-7 rounded-md bg-[#1D9E75] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">GR</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold leading-tight truncate">Gestionale</p>
            <p className="text-gray-400 text-[10px] leading-tight">Ristoranti</p>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="ml-auto text-gray-500 hover:text-gray-300 transition shrink-0"
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : <ChevronLeft  className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={[
                'flex items-center gap-2.5 rounded-md px-2 py-2 text-xs font-medium transition-colors relative',
                'border-l-2',
                active
                  ? 'bg-gray-800 text-white border-[#1D9E75]'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white border-transparent',
              ].join(' ')}
            >
              <span className="relative shrink-0">
                <Icon className="w-4 h-4" />
                {label === 'Notifiche' && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
                {label === 'Comande' && occupiedTavoli > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold leading-none">
                    {occupiedTavoli > 9 ? '9+' : occupiedTavoli}
                  </span>
                )}
              </span>
              {!collapsed && (
                <span className="truncate flex-1">{label}</span>
              )}
              {!collapsed && label === 'Comande' && occupiedTavoli > 0 && (
                <span className="ml-auto bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0">
                  {occupiedTavoli}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Admin nav */}
      {adminUser && (
        <>
          <div className="mx-2 my-1 border-t border-gray-800" />
          {NAV_ADMIN.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={[
                  'flex items-center gap-2.5 rounded-md px-2 py-2 text-xs font-medium transition-colors relative',
                  'border-l-2',
                  active
                    ? 'bg-gray-800 text-white border-violet-500'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white border-transparent',
                ].join(' ')}
              >
                <span className="relative shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                {!collapsed && (
                  <span className="truncate flex-1">{label}</span>
                )}
                {!collapsed && (
                  <span className="ml-auto text-[8px] font-bold px-1 py-0.5 rounded bg-violet-900 text-violet-300 leading-none shrink-0">
                    ADMIN
                  </span>
                )}
              </Link>
            )
          })}
        </>
      )}

      {/* Footer */}
      <div className="px-2 py-2 border-t border-gray-800 shrink-0">
        <button
          onClick={handleLogout}
          title={collapsed ? 'Esci' : undefined}
          className="flex items-center gap-2.5 w-full rounded-md px-2 py-2 text-xs font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Esci</span>}
        </button>
      </div>
    </aside>
  )
}
