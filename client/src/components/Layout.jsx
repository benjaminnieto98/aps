import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { formatMoney, formatMoneyShort } from '../utils/format'
import { Modal } from './ui'

const navItems = [
  { to: '/', label: 'Inicio', short: 'Inicio', icon: '⚽', exact: true },
  { to: '/team', label: 'Mi Equipo', short: 'Equipo', icon: '👕' },
  { to: '/market', label: 'Mercado', short: 'Mercado', icon: '🛒' },
  { to: '/tournaments', label: 'Torneos', short: 'Torneos', icon: '🏆' },
  { to: '/stats', label: 'Estadísticas', icon: '📊' },
  { to: '/transfers', label: 'Transferencias', icon: '🔄' },
]

// First 4 go in the mobile bottom bar; the rest live under "Más"
const bottomItems = navItems.slice(0, 4)
const moreItems = navItems.slice(4)

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const handleLogout = () => {
    setMoreOpen(false)
    logout()
    navigate('/login')
  }

  const allMore = user?.is_admin
    ? [...moreItems, { to: '/admin', label: 'Administrar', icon: '⚙️' }]
    : moreItems
  const moreActive = allMore.some(i => location.pathname.startsWith(i.to))

  const initials = (user?.username || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const SidebarLink = ({ to, exact, icon, label }) => (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive ? 'bg-green-500/10 text-green-400' : 'text-gray-400 hover:bg-gray-800/70 hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-green-500" />}
          <span className="w-6 text-center text-base">{icon}</span>
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )

  return (
    <div className="flex h-dvh bg-gray-950 overflow-hidden">
      {/* Sidebar (desktop only) */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-gray-900/80 border-r border-gray-800 flex-col">
        <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-800">
          <div className="w-9 h-9 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center font-black text-white text-xs shadow-lg shadow-green-500/20">
            APS
          </div>
          <div className="leading-tight">
            <div className="font-bold text-white text-sm">Asociación</div>
            <div className="text-gray-500 text-xs">de PES6</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-600">Menú</p>
          <div className="space-y-0.5">
            {navItems.map(item => <SidebarLink key={item.to} {...item} />)}
          </div>
          {!!user?.is_admin && (
            <>
              <p className="px-3 mt-6 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-600">Administración</p>
              <SidebarLink to="/admin" icon="⚙️" label="Administrar" />
            </>
          )}
        </nav>

        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-3 rounded-xl bg-gray-800/60 border border-gray-700/50 p-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white font-semibold text-sm truncate">{user?.username}</div>
              {user?.team_name && <div className="text-gray-500 text-xs truncate">{user.team_name}</div>}
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="p-2 -mr-1 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-700/60 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
          <div className="mt-2 px-3 flex items-baseline justify-between">
            <span className="text-gray-500 text-xs">Presupuesto</span>
            <span className="text-green-400 text-sm font-bold tabular-nums">{formatMoney(user?.budget)}</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden pt-safe bg-gray-900 border-b border-gray-800">
          <div className="flex items-center justify-between px-4 h-12">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 bg-green-500 rounded-md flex items-center justify-center font-bold text-white text-[10px] shrink-0">
                APS
              </div>
              <span className="text-white text-sm font-semibold truncate">{user?.team_name || user?.username}</span>
            </div>
            <div className="text-green-400 text-sm font-bold shrink-0">{formatMoneyShort(user?.budget)}</div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8">
          <div className="lg:max-w-7xl lg:mx-auto">
            <Outlet />
          </div>
        </main>

        {/* Bottom nav (mobile) */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-gray-900/95 backdrop-blur border-t border-gray-800 pb-safe">
          <div className="grid grid-cols-5 h-16">
            {bottomItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                    isActive ? 'text-green-400' : 'text-gray-500 active:text-white'
                  }`
                }
              >
                <span className="text-xl leading-none">{item.icon}</span>
                <span>{item.short}</span>
              </NavLink>
            ))}
            <button
              onClick={() => setMoreOpen(true)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                moreActive ? 'text-green-400' : 'text-gray-500 active:text-white'
              }`}
            >
              <span className="text-xl leading-none">☰</span>
              <span>Más</span>
            </button>
          </div>
        </nav>
      </div>

      {/* "Más" sheet (mobile) */}
      {moreOpen && (
        <Modal onClose={() => setMoreOpen(false)} padded={false}>
          <div className="px-4 pt-2 pb-3 border-b border-gray-800">
            <div className="text-white font-semibold">{user?.username}</div>
            {user?.team_name && <div className="text-gray-400 text-xs mt-0.5">{user.team_name}</div>}
            <div className="text-green-400 text-sm font-bold mt-1">{formatMoney(user?.budget)}</div>
          </div>
          <div className="p-2">
            {allMore.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3.5 rounded-lg text-[15px] font-medium ${
                    isActive ? 'bg-green-500/15 text-green-400' : 'text-gray-200 active:bg-gray-800'
                  }`
                }
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-lg text-[15px] font-medium text-red-400 active:bg-gray-800"
            >
              <span className="text-lg">🚪</span>
              <span>Cerrar sesión</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
