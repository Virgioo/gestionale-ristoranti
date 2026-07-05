'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@supabase/supabase-js'
import type { Sede, Notifica } from '@/types/database'

interface AppState {
  user: User | null
  selectedSede: Sede | null
  isOnline: boolean
  unreadCount: number
  notifiche: Notifica[]
  sidebarCollapsed: boolean
  setUser: (user: User | null) => void
  setSelectedSede: (sede: Sede | null) => void
  setIsOnline: (online: boolean) => void
  setUnreadCount: (count: number) => void
  setNotifiche: (notifiche: Notifica[]) => void
  markAllRead: () => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      selectedSede: null,
      isOnline: true,
      unreadCount: 0,
      notifiche: [],
      sidebarCollapsed: false,
      setUser: (user) => set({ user }),
      setSelectedSede: (sede) => set({ selectedSede: sede }),
      setIsOnline: (isOnline) => set({ isOnline }),
      setUnreadCount: (unreadCount) => set({ unreadCount }),
      setNotifiche: (notifiche) => set({ notifiche }),
      markAllRead: () => set({ unreadCount: 0 }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: 'gestionale-store',
      partialize: (state) => ({
        selectedSede: state.selectedSede,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
)
