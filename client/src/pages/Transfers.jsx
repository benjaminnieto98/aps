import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTransfers } from '../api'
import { formatMoney } from '../utils/format'

const TYPE_LABELS = {
  compra:     { label: 'Compra',     color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  liberacion: { label: 'Liberación', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  asignacion: { label: 'Asignación', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  reset:      { label: 'Reset',      color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
}

const POS_COLORS = {
  GK: 'text-yellow-400', CB: 'text-blue-400', LB: 'text-blue-400',
  CDM: 'text-purple-400', CM: 'text-purple-400', CAM: 'text-purple-400',
  LW: 'text-green-400', ST: 'text-green-400',
}

function TypeBadge({ type }) {
  const t = TYPE_LABELS[type] || { label: type, color: 'bg-gray-700 text-gray-400' }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${t.color}`}>
      {t.label}
    </span>
  )
}

function formatDate(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

const PAGE_SIZE = 30

export default function Transfers() {
  const navigate = useNavigate()
  const [data, setData] = useState({ total: 0, transfers: [] })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState({ type: '', player: '', user: '' })
  const [pending, setPending] = useState(filters)

  const fetch = useCallback((f, p) => {
    setLoading(true)
    const params = { limit: PAGE_SIZE, offset: p * PAGE_SIZE }
    if (f.type)   params.type   = f.type
    if (f.player) params.player = f.player
    if (f.user)   params.user   = f.user
    getTransfers(params)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetch(filters, page) }, [filters, page, fetch])

  const applyFilters = () => {
    setFilters(pending)
    setPage(0)
  }

  const clearFilters = () => {
    const empty = { type: '', player: '', user: '' }
    setPending(empty)
    setFilters(empty)
    setPage(0)
  }

  const totalPages = Math.ceil(data.total / PAGE_SIZE)
  const hasFilters = filters.type || filters.player || filters.user

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-white text-2xl font-bold">Historial de Transferencias</h1>
        <p className="text-gray-400 text-sm mt-1">{data.total} movimientos en total</p>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-gray-500 text-xs block mb-1">Tipo</label>
            <select
              value={pending.type}
              onChange={e => setPending(prev => ({ ...prev, type: e.target.value }))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
            >
              <option value="">Todos</option>
              <option value="compra">Compra</option>
              <option value="liberacion">Liberación</option>
              <option value="asignacion">Asignación</option>
              <option value="reset">Reset</option>
            </select>
          </div>
          <div>
            <label className="text-gray-500 text-xs block mb-1">Jugador</label>
            <input
              type="text"
              placeholder="Nombre..."
              value={pending.player}
              onChange={e => setPending(prev => ({ ...prev, player: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 w-40"
            />
          </div>
          <div>
            <label className="text-gray-500 text-xs block mb-1">Usuario</label>
            <input
              type="text"
              placeholder="Manager..."
              value={pending.user}
              onChange={e => setPending(prev => ({ ...prev, user: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 w-40"
            />
          </div>
          <button
            onClick={applyFilters}
            className="bg-green-500 hover:bg-green-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Buscar
          </button>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-2 rounded-lg transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="text-gray-400 text-center py-16">Cargando...</div>
        ) : data.transfers.length === 0 ? (
          <div className="text-gray-500 text-center py-16">
            {hasFilters ? 'No hay resultados para ese filtro.' : 'Todavía no hay transferencias registradas.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800 bg-gray-800/50">
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Jugador</th>
                  <th className="px-4 py-3 text-left">De</th>
                  <th className="px-4 py-3 text-left">A</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {data.transfers.map(t => (
                  <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(t.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={t.type} />
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center gap-2 cursor-pointer group"
                        onClick={() => t.player_id && navigate(`/player/${t.player_id}`)}
                      >
                        <span className={`text-xs font-bold ${POS_COLORS[t.player_position] || 'text-gray-400'}`}>
                          {t.player_position}
                        </span>
                        <span className="text-white font-medium group-hover:text-green-400 transition-colors">{t.player_name}</span>
                        <span className="text-yellow-400 text-xs font-bold">{t.player_rating}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {t.from_username ? (
                        <span className="text-gray-300">{t.from_username}</span>
                      ) : (
                        <span className="text-gray-600 italic text-xs">Agente libre</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {t.to_username ? (
                        <span className="text-gray-300">{t.to_username}</span>
                      ) : (
                        <span className="text-gray-600 italic text-xs">Liberado</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.price != null ? (
                        <span className={`font-bold ${t.type === 'compra' ? 'text-green-400' : 'text-red-400'}`}>
                          {formatMoney(t.price)}
                        </span>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-gray-500 text-sm">
            Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data.total)} de {data.total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              ← Anterior
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-400">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
