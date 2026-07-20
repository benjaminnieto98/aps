import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPlayerProfile, getMyPlayers, proposeSwap } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { formatMoney, ratingColor } from '../utils/format'

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

function SwapModal({ player, onClose }) {
  const [myPlayers, setMyPlayers] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [cashDir, setCashDir] = useState('none')   // 'none' | 'i_pay' | 'they_pay'
  const [cashAmt, setCashAmt] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchingPlayers, setFetchingPlayers] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    getMyPlayers()
      .then(r => {
        setMyPlayers(r.data)
        if (r.data.length > 0) setSelectedId(r.data[0].id)
      })
      .catch(() => setError('No se pudo cargar tu plantel'))
      .finally(() => setFetchingPlayers(false))
  }, [])

  const handlePropose = async () => {
    if (!selectedId) return setError('Elegí tu jugador')
    setLoading(true); setError('')

    let cash_difference = 0
    const parsed = parseInt(cashAmt, 10) || 0
    if (cashDir === 'i_pay') cash_difference = parsed
    if (cashDir === 'they_pay') cash_difference = -parsed

    try {
      await proposeSwap({
        offered_player_id: selectedId,
        requested_player_id: player.id,
        cash_difference,
      })
      setSuccess('¡Oferta enviada!')
      setTimeout(onClose, 1500)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar')
    } finally {
      setLoading(false)
    }
  }

  const selectedPlayer = myPlayers.find(p => p.id === selectedId)

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl p-5 w-full max-w-md border border-gray-700">
        <h3 className="text-white font-semibold mb-4">Proponer intercambio</h3>

        {fetchingPlayers ? (
          <div className="text-gray-400 text-sm text-center py-4">Cargando plantel...</div>
        ) : myPlayers.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-4">No tenés jugadores para intercambiar</div>
        ) : (
          <>
            {/* Player comparison */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start mb-4">
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-500 text-xs mb-2">Ofrezco</p>
                <select
                  value={selectedId}
                  onChange={e => setSelectedId(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1.5 text-white text-xs focus:outline-none focus:border-purple-500"
                >
                  {myPlayers.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.rating})</option>
                  ))}
                </select>
                {selectedPlayer && (
                  <div className="mt-1.5 text-gray-400 text-xs">{selectedPlayer.position} · {selectedPlayer.nationality}</div>
                )}
              </div>

              <div className="flex items-center justify-center pt-6 text-gray-500 text-lg">⇌</div>

              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-500 text-xs mb-2">Pido</p>
                <p className="text-white font-semibold text-sm">{player.name}</p>
                <p className={`text-sm font-bold ${ratingColor(player.rating)}`}>{player.rating}</p>
                <div className="mt-0.5 text-gray-400 text-xs">{player.position} · {player.nationality}</div>
              </div>
            </div>

            {/* Cash compensation */}
            <div className="mb-4">
              <p className="text-gray-400 text-xs mb-2">Compensación económica</p>
              <div className="flex gap-1.5 mb-2 flex-wrap">
                {[
                  { key: 'none',     label: 'Sin compensación' },
                  { key: 'i_pay',    label: 'Yo pago' },
                  { key: 'they_pay', label: 'El otro paga' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setCashDir(opt.key); setCashAmt('') }}
                    className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                      cashDir === opt.key
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {cashDir !== 'none' && (
                <input
                  type="number"
                  min="0"
                  placeholder="Monto de compensación"
                  value={cashAmt}
                  onChange={e => setCashAmt(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  autoFocus
                />
              )}
              {cashDir === 'i_pay' && parseInt(cashAmt) > 0 && (
                <p className="text-xs text-purple-300 mt-1">Pagás {formatMoney(parseInt(cashAmt))} a {player.owner_username} además del intercambio</p>
              )}
              {cashDir === 'they_pay' && parseInt(cashAmt) > 0 && (
                <p className="text-xs text-purple-300 mt-1">{player.owner_username} te paga {formatMoney(parseInt(cashAmt))} además del intercambio</p>
              )}
            </div>

            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
            {success && <p className="text-green-400 text-xs mb-3">{success}</p>}

            <div className="flex gap-2">
              <button
                onClick={handlePropose}
                disabled={loading || !selectedId}
                className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                {loading ? 'Enviando...' : 'Proponer intercambio'}
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
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

  const { player, history, goals } = data
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
            <h1 className="text-white text-2xl font-bold">{player.name}</h1>
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
