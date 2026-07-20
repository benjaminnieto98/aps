import React, { useState, useEffect } from 'react'
import { getMyPlayers, proposeSwap } from '../api'
import { formatMoney, ratingColor } from '../utils/format'

export default function SwapModal({ player, onClose, onSuccess }) {
  const [myPlayers, setMyPlayers]       = useState([])
  const [selectedId, setSelectedId]     = useState('')
  const [cashDir, setCashDir]           = useState('none')
  const [cashAmt, setCashAmt]           = useState('')
  const [loading, setLoading]           = useState(false)
  const [fetchingPlayers, setFetchingPlayers] = useState(true)
  const [error, setError]               = useState('')
  const [success, setSuccess]           = useState('')

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
    if (cashDir === 'i_pay')    cash_difference =  parsed
    if (cashDir === 'they_pay') cash_difference = -parsed

    try {
      await proposeSwap({
        offered_player_id:   selectedId,
        requested_player_id: player.id,
        cash_difference,
      })
      setSuccess('¡Oferta enviada!')
      onSuccess?.()
      setTimeout(onClose, 1200)
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
        <h3 className="text-white font-semibold mb-1">Proponer intercambio</h3>
        <p className="text-gray-500 text-xs mb-4">
          Dueño actual: <span className="text-gray-300">{player.owner_username}</span>
        </p>

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
                <p className="text-xs text-purple-300 mt-1">
                  Pagás {formatMoney(parseInt(cashAmt))} a {player.owner_username} además del intercambio
                </p>
              )}
              {cashDir === 'they_pay' && parseInt(cashAmt) > 0 && (
                <p className="text-xs text-purple-300 mt-1">
                  {player.owner_username} te paga {formatMoney(parseInt(cashAmt))} además del intercambio
                </p>
              )}
            </div>

            {error   && <p className="text-red-400   text-xs mb-3">{error}</p>}
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
