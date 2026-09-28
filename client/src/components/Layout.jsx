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

  const sidebarLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
      isActive ? 'bg-green-500 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
    }`

  return (
    <div className="flex h-dvh bg-gray-950 overflow-hidden">
      {/* Sidebar (desktop only) */}
      <aside className="hidden lg:flex w-64 bg-gray-900 border-r border-gray-800 flex-col">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
          <div className="w-9 h-9 bg-green-500 rounded-lg flex items-center justify-center font-bold text-white text-sm">
            APS
          </div>
          <div>
            <div className="font-bold text-white text-sm">Asociación</div>
            <div className="text-gray-400 text-xs">de PES6</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.exact} className={sidebarLinkClass}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
          {!!user?.is_admin && (
            <NavLink to="/admin" className={sidebarLinkClass}>
              <span>⚙️</span>
              <span>Administrar</span>
            </NavLink>
          )}
        </nav>

        <div className="px-4 py-4 border-t border-gray-800">
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-white font-semibold text-sm truncate">{user?.username}</div>
            {user?.team_name && (
              <div className="text-gray-400 text-xs truncate mt-0.5">{user.team_name}</div>
            )}
            <div className="text-green-400 text-sm font-bold mt-1">{formatMoney(user?.budget)}</div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-2 w-full text-left px-3 py-2 text-gray-400 hover:text-red-400 text-sm rounded-lg hover:bg-gray-800 transition-colors"
          >
            Cerrar sesión
          </button>
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

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-6">
          <Outlet />
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
