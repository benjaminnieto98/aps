import React, { useState, useEffect } from 'react'
import { getMyPlayers, listPlayer, unlistPlayer, setClause, removeClause, releasePlayer, getConfig, getReceivedOffers, acceptOffer, raiseClauseOffer, rejectOffer } from '../api'
import { formatMoney, positionOrder, positionLabel, ratingColor } from '../utils/format'

// Position → group mapping (mirrors server logic)
const POSITION_GROUP = {
  GK: 'gk', CB: 'def', LB: 'def',
  CDM: 'mid', CM: 'mid', CAM: 'mid',
  LW: 'fwd', ST: 'fwd'
}

function calcPrice(player, config) {
  if (!config) return null
  const group = POSITION_GROUP[player.position] || 'mid'
  const multKey = { gk: 'posMultGk', def: 'posMultDef', mid: 'posMultMid', fwd: 'posMultFwd' }[group]
  const posMult = parseFloat(config[multKey] ?? 1)
  return Math.round(player.rating * player.rating * config.priceMultiplier * posMult)
}

function PlayerCard({ player, onRefresh, config, rosterCount, minRoster }) {
  const [showListModal, setShowListModal] = useState(false)
  const [showClauseModal, setShowClauseModal] = useState(false)
  const [showReleaseModal, setShowReleaseModal] = useState(false)
  const [price, setPrice] = useState('')
  const [clauseAmount, setClauseAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const basePrice = calcPrice(player, config)
  const releasePayout = basePrice && config ? Math.round(basePrice * config.releasePct / 100) : null
  const atMinRoster = rosterCount <= minRoster

  const handleList = async () => {
    if (!price || isNaN(price) || Number(price) <= 0) return setError('Precio inválido')
    setLoading(true)
    setError('')
    try {
      await listPlayer(player.id, parseInt(price))
      setShowListModal(false)
      setPrice('')
      onRefresh()
    } catch (err) {
      setError(err.response?.data?.error || 'Error')
    } finally {
      setLoading(false)
    }
  }

  const handleUnlist = async () => {
    setLoading(true)
    try {
      await unlistPlayer(player.id)
      onRefresh()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSetClause = async () => {
    if (!clauseAmount || isNaN(clauseAmount) || Number(clauseAmount) <= 0) return setError('Monto inválido')
    setLoading(true)
    setError('')
    try {
      await setClause(player.id, parseInt(clauseAmount))
      setShowClauseModal(false)
      setClauseAmount('')
      onRefresh()
    } catch (err) {
      setError(err.response?.data?.error || 'Error')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveClause = async () => {
    setLoading(true)
    try {
      await removeClause(player.id)
      onRefresh()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRelease = async () => {
    setLoading(true)
    setError('')
    try {
      await releasePlayer(player.id)
      setShowReleaseModal(false)
      onRefresh()
    } catch (err) {
      setError(err.response?.data?.error || 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm truncate">{player.name}</div>
          <div className="text-gray-400 text-xs">{player.nationality}</div>
        </div>
        <div className={`text-lg font-bold ml-2 ${ratingColor(player.rating)}`}>{player.rating}</div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded font-medium">
          {player.position}
        </span>
        <span className="text-gray-500 text-xs">{player.foot === 'Right' ? 'D' : player.foot === 'Left' ? 'I' : 'A'}</span>
      </div>

      {(player.listed_price || player.release_clause) && (
        <div className="mb-2 space-y-1">
          {player.listed_price && (
            <div className="text-xs text-blue-400">
              En venta: {formatMoney(player.listed_price)}
            </div>
          )}
          {player.release_clause && (
            <div className="text-xs text-orange-400">
              Cláusula: {formatMoney(player.release_clause)}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {!player.listed_price ? (
          <button
            onClick={() => { setShowListModal(true); setError('') }}
            disabled={atMinRoster}
            title={atMinRoster ? `Mínimo ${minRoster} jugadores` : ''}
            className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-2 py-1 rounded-md transition-colors"
          >
            Poner en venta
          </button>
        ) : (
          <button
            onClick={handleUnlist}
            disabled={loading}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded-md transition-colors"
          >
            Quitar del mercado
          </button>
        )}

        {!player.release_clause ? (
          <button
            onClick={() => { setShowClauseModal(true); setError('') }}
            className="text-xs bg-orange-600 hover:bg-orange-500 text-white px-2 py-1 rounded-md transition-colors"
          >
            Agregar cláusula
          </button>
        ) : (
          <button
            onClick={handleRemoveClause}
            disabled={loading}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded-md transition-colors"
          >
            Quitar cláusula
          </button>
        )}

        <button
          onClick={() => { setShowReleaseModal(true); setError('') }}
          disabled={atMinRoster}
          title={atMinRoster ? `Mínimo ${minRoster} jugadores` : `Recibís ${releasePayout ? formatMoney(releasePayout) : '...'}`}
          className="text-xs bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-2 py-1 rounded-md transition-colors"
        >
          Liberar
        </button>
      </div>

      {/* List modal */}
      {showListModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-5 w-full max-w-sm border border-gray-700">
            <h3 className="text-white font-semibold mb-3">Poner en venta a {player.name}</h3>
            <input
              type="number"
              placeholder="Precio de venta"
              value={price}
              onChange={e => setPrice(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 mb-2"
              autoFocus
            />
            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleList}
                disabled={loading}
                className="flex-1 bg-green-500 hover:bg-green-400 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                Confirmar
              </button>
              <button
                onClick={() => { setShowListModal(false); setError('') }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clause modal */}
      {showClauseModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-5 w-full max-w-sm border border-gray-700">
            <h3 className="text-white font-semibold mb-3">Cláusula de {player.name}</h3>
            <input
              type="number"
              placeholder="Monto de la cláusula"
              value={clauseAmount}
              onChange={e => setClauseAmount(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 mb-2"
              autoFocus
            />
            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleSetClause}
                disabled={loading}
                className="flex-1 bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                Establecer
              </button>
              <button
                onClick={() => { setShowClauseModal(false); setError('') }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Release modal */}
      {showReleaseModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-5 w-full max-w-sm border border-gray-700">
            <h3 className="text-white font-semibold mb-1">Liberar a {player.name}</h3>
            <p className="text-gray-400 text-sm mb-4">
              El jugador quedará como agente libre. Recibirás el{' '}
              <span className="text-green-400 font-bold">{config?.releasePct ?? 60}% del valor base</span>:
            </p>
            <div className="bg-gray-800 rounded-lg px-4 py-3 mb-4 flex justify-between items-center">
              <span className="text-gray-400 text-sm">Valor base</span>
              <span className="text-white font-medium">{basePrice ? formatMoney(basePrice) : '...'}</span>
            </div>
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 mb-4 flex justify-between items-center">
              <span className="text-green-400 text-sm font-medium">Recibís</span>
              <span className="text-green-400 font-bold text-lg">{releasePayout ? formatMoney(releasePayout) : '...'}</span>
            </div>
            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleRelease}
                disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {loading ? 'Liberando...' : 'Confirmar liberación'}
              </button>
              <button
                onClick={() => { setShowReleaseModal(false); setError('') }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReceivedOffers({ onRefresh }) {
  const [offers, setOffers] = useState([])
  const [raiseInputs, setRaiseInputs] = useState({})
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const fetch = () => getReceivedOffers().then(r => setOffers(r.data)).catch(console.error)
  useEffect(() => { fetch() }, [])

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 4000) }

  const handleAccept = async (id) => {
    setLoading(true)
    try {
      await acceptOffer(id)
      flash('Transferencia aceptada')
      fetch(); onRefresh()
    } catch (err) { flash(err.response?.data?.error || 'Error') }
    finally { setLoading(false) }
  }

  const handleRaise = async (id) => {
    const val = raiseInputs[id]
    if (!val || isNaN(val) || Number(val) <= 0) return flash('Ingresá un monto válido')
    setLoading(true)
    try {
      const res = await raiseClauseOffer(id, parseInt(val))
      flash(`Cláusula subida a ${formatMoney(res.data.newClause)}. Pagaste ${formatMoney(res.data.paid)}.`)
      setRaiseInputs(prev => ({ ...prev, [id]: '' }))
      fetch(); onRefresh()
    } catch (err) { flash(err.response?.data?.error || 'Error') }
    finally { setLoading(false) }
  }

  const handleReject = async (id) => {
    setLoading(true)
    try {
      await rejectOffer(id)
      flash('Oferta rechazada')
      fetch()
    } catch (err) { flash(err.response?.data?.error || 'Error') }
    finally { setLoading(false) }
  }

  if (offers.length === 0) return null

  return (
    <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 space-y-3">
      <h2 className="text-orange-300 font-semibold text-sm flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
        Ofertas de cláusula recibidas ({offers.length})
      </h2>
      {msg && <div className="text-green-400 text-xs bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">{msg}</div>}
      {offers.map(o => (
        <div key={o.id} className="bg-gray-900 rounded-xl p-4 border border-gray-700 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">{o.player_name}</span>
                <span className="text-yellow-400 text-xs font-bold">{o.player_rating}</span>
                <span className="bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded">{o.player_position}</span>
              </div>
              <div className="text-gray-400 text-xs mt-0.5">
                Oferta de <span className="text-white">{o.buyer_username}</span> · cláusula {formatMoney(o.clause_amount)}
              </div>
            </div>
            <div className="text-orange-400 font-bold text-lg">{formatMoney(o.clause_amount)}</div>
          </div>

          {/* Raise clause input */}
          <div className="flex gap-2">
            <input
              type="number"
              placeholder={`Subir cláusula (actual: ${o.clause_amount.toLocaleString()})`}
              value={raiseInputs[o.id] || ''}
              onChange={e => setRaiseInputs(prev => ({ ...prev, [o.id]: e.target.value }))}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-orange-500 min-w-0"
            />
            <button
              onClick={() => handleRaise(o.id)}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors"
            >
              Subir y rechazar
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleAccept(o.id)}
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
            >
              Aceptar transferencia
            </button>
            <button
              onClick={() => handleReject(o.id)}
              disabled={loading}
              className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm py-2 rounded-lg transition-colors"
            >
              Rechazar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Team() {
  const [players, setPlayers] = useState([])
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchPlayers = () => {
    getMyPlayers()
      .then(res => setPlayers(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPlayers()
    getConfig().then(r => setConfig(r.data)).catch(console.error)
  }, [])

  const minRoster = config?.minRoster ?? 18

  const grouped = positionOrder.reduce((acc, pos) => {
    const group = players.filter(p => p.position === pos)
    if (group.length > 0) acc[pos] = group
    return acc
  }, {})

  // Add any positions not in the order
  players.forEach(p => {
    if (!positionOrder.includes(p.position)) {
      if (!grouped[p.position]) grouped[p.position] = []
      if (!grouped[p.position].find(x => x.id === p.id)) grouped[p.position].push(p)
    }
  })

  if (loading) return <div className="text-gray-400 text-center py-20">Cargando plantel...</div>

  return (
    <div className="space-y-6">
      <ReceivedOffers onRefresh={fetchPlayers} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Mi Equipo</h1>
          <p className="text-gray-400 text-sm mt-1">
            {players.length} / {config?.maxRoster ?? 22} jugadores
            {players.length <= minRoster && players.length > 0 && (
              <span className="ml-2 text-amber-400 text-xs">
                (mínimo {minRoster} — no podés vender ni liberar)
              </span>
            )}
          </p>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <div className="text-gray-500 text-lg mb-2">No tienes jugadores</div>
          <p className="text-gray-600 text-sm">Un administrador debe asignarte un equipo, o puedes comprar agentes libres en el mercado.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([pos, posPlayers]) => (
          <div key={pos}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-white font-semibold text-sm">{positionLabel[pos] || pos}</h2>
              <span className="text-gray-500 text-xs">({posPlayers.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {posPlayers.map(p => (
                <PlayerCard
                  key={p.id} player={p} onRefresh={fetchPlayers}
                  config={config} rosterCount={players.length} minRoster={minRoster}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
