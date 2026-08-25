import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPlayerProfile } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { formatMoney, ratingColor } from '../utils/format'
import SwapModal from '../components/SwapModal'

const TYPE_LABELS = {
  compra:       { label: 'Compra',       color: 'text-blue-400' },
  liberacion:   { label: 'Liberación',   color: 'text-red-400' },
  asignacion:   { label: 'Asignación',   color: 'text-green-400' },
  reset:        { label: 'Reset',        color: 'text-gray-400' },
  intercambio:  { label: 'Intercambio',  color: 'text-purple-400' },
}

const POS_COLORS = {
  GK:  'bg-yellow-500/20 text-yellow-300',
  CB:  'bg-blue-500/20 text-blue-300', LB: 'bg-blue-500/20 text-blue-300',
  CDM: 'bg-purple-500/20 text-purple-300', CM: 'bg-purple-500/20 text-purple-300', CAM: 'bg-purple-500/20 text-purple-300',
  LW:  'bg-green-500/20 text-green-300', ST: 'bg-green-500/20 text-green-300',
}

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function PlayerProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showSwapModal, setShowSwapModal] = useState(false)

  useEffect(() => {
    getPlayerProfile(id)
      .then(r => setData(r.data))
      .catch(() => setError('Jugador no encontrado'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-gray-400 text-center py-20">Cargando...</div>
  if (error) return (
    <div className="text-center py-20">
      <div className="text-gray-500 text-lg mb-4">{error}</div>
      <button onClick={() => navigate(-1)} className="text-green-400 hover:text-green-300 text-sm underline">Volver</button>
    </div>
  )

  const { player, history, goals, goals_by_team = [] } = data
  const posColor = POS_COLORS[player.position] || 'bg-gray-700 text-gray-300'
  const canPropose = user && player.owner_id && player.owner_id !== user.id

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors"
      >
        ← Volver
      </button>

      {/* Player header */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-white text-2xl font-bold">{player.name}</h1>
              {player.raised_count > 0 && (
                <span className="text-orange-400 text-xs bg-orange-400/10 border border-orange-400/30 px-2 py-1 rounded-lg" title={`Cláusula subida ${player.raised_count} ${player.raised_count === 1 ? 'vez' : 'veces'}`}>
                  📈 ×{player.raised_count}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-sm font-semibold px-2.5 py-1 rounded-lg ${posColor}`}>
                {player.position}
              </span>
              <span className="text-gray-400 text-sm">{player.nationality}</span>
              {player.age && <span className="text-gray-500 text-sm">{player.age} años</span>}
              {player.foot && (
                <span className="text-gray-500 text-xs bg-gray-800 px-2 py-0.5 rounded">
                  {player.foot === 'Right' ? 'Pie derecho' : player.foot === 'Left' ? 'Pie izquierdo' : 'Ambidiestro'}
                </span>
              )}
            </div>
            <div className="text-gray-500 text-sm mt-1">{player.pes_team || 'Sin equipo original'}</div>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${ratingColor(player.rating)}`}>{player.rating}</div>
            <div className="text-gray-500 text-xs mt-1">OVR</div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <div className="text-green-400 text-2xl font-bold">{goals}</div>
            <div className="text-gray-500 text-xs mt-0.5">Goles</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <div className="text-blue-400 text-2xl font-bold">{history.filter(h => h.type === 'compra').length}</div>
            <div className="text-gray-500 text-xs mt-0.5">Traspasos</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <div className="text-white text-sm font-semibold truncate">
              {player.owner_username || <span className="text-gray-500">Libre</span>}
            </div>
            <div className="text-gray-500 text-xs mt-0.5">Dueño actual</div>
          </div>
        </div>

        {/* Swap button */}
        {canPropose && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <button
              onClick={() => setShowSwapModal(true)}
              className="w-full bg-purple-700 hover:bg-purple-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              ⇌ Proponer intercambio con {player.owner_username}
            </button>
          </div>
        )}
      </div>

      {/* Goals breakdown */}
      {goals > 0 && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-white font-semibold">Goles</h2>
          </div>
          <div className="p-4 space-y-4">
            {/* By team */}
            {goals_by_team.length > 0 && (
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Por equipo</p>
                <div className="space-y-1.5">
                  {goals_by_team.map(({ team, goals: g }) => (
                    <div key={team} className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden h-6 relative">
                        <div
                          className="absolute inset-y-0 left-0 bg-green-500/30 rounded-lg"
                          style={{ width: `${Math.round((g / goals) * 100)}%` }}
                        />
                        <span className="absolute inset-0 flex items-center px-2.5 text-xs text-gray-300">{team}</span>
                      </div>
                      <span className="text-green-400 font-bold text-sm w-6 text-right">{g}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Transfer history */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">Historial</h2>
        </div>
        {history.length === 0 ? (
          <div className="text-gray-500 text-center py-10">Sin movimientos registrados</div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {history.map(t => {
              const typeInfo = TYPE_LABELS[t.type] || { label: t.type, color: 'text-gray-400' }
              return (
                <div key={t.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
                      {t.from_username && (
                        <>
                          <span className="text-gray-600">de</span>
                          <span className="text-gray-300">{t.from_username}</span>
                        </>
                      )}
                      {t.to_username && (
                        <>
                          <span className="text-gray-600">→</span>
                          <span className="text-gray-300">{t.to_username}</span>
                        </>
                      )}
                      {!t.to_username && t.type === 'liberacion' && (
                        <>
                          <span className="text-gray-600">→</span>
                          <span className="text-gray-500 italic">Agente libre</span>
                        </>
                      )}
                    </div>
                    <div className="text-gray-600 text-xs mt-0.5">{formatDate(t.created_at)}</div>
                  </div>
                  {t.price != null && (
                    <div className={`text-sm font-bold ${t.type === 'compra' ? 'text-green-400' : 'text-red-400'}`}>
                      {formatMoney(t.price)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showSwapModal && (
        <SwapModal player={player} onClose={() => setShowSwapModal(false)} />
      )}
    </div>
  )
}
