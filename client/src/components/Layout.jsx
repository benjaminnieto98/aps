import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { formatMoney } from '../utils/format'

const navItems = [
  { to: '/', label: 'Inicio', icon: '⚽', exact: true },
  { to: '/team', label: 'Mi Equipo', icon: '👕' },
  { to: '/market', label: 'Mercado', icon: '🛒' },
  { to: '/tournaments', label: 'Torneos', icon: '🏆' },
  { to: '/stats', label: 'Estadísticas', icon: '📊' },
  { to: '/transfers', label: 'Transferencias', icon: '🔄' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const NavItems = () => (
    <>
      {navItems.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.exact}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? 'bg-green-500 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`
          }
          onClick={() => setSidebarOpen(false)}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
      {user?.is_admin && (
        <NavLink
          to="/admin"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? 'bg-green-500 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`
          }
          onClick={() => setSidebarOpen(false)}
        >
          <span>⚙️</span>
          <span>Administrar</span>
        </NavLink>
      )}
    </>
  )

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
          <div className="w-9 h-9 bg-green-500 rounded-lg flex items-center justify-center font-bold text-white text-sm">
            APS
          </div>
          <div>
            <div className="font-bold text-white text-sm">Asociación</div>
            <div className="text-gray-400 text-xs">de PES6</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <NavItems />
        </nav>

        {/* User info */}
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
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="font-bold text-white">APS</div>
          <div className="text-green-400 text-sm font-bold">{formatMoney(user?.budget)}</div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
