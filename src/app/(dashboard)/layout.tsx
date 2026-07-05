'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/store'
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, setIsOnline } = useAppStore()

  useEffect(() => {
    const on  = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [setIsOnline])

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  const offset = sidebarCollapsed ? 56 : 220

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main
        className="flex-1 min-w-0 transition-[margin] duration-200"
        style={{ marginLeft: offset }}
      >
        {children}
      </main>
    </div>
  )
}
