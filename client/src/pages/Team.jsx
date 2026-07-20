import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyPlayers, listPlayer, unlistPlayer, setClause, removeClause, releasePlayer, getPublicConfig, getReceivedOffers, acceptOffer, raiseClauseOffer, rejectOffer, getReceivedSwaps, acceptSwap, rejectSwap } from '../api'
import { formatMoney, positionOrder, positionLabel, ratingColor } from '../utils/format'

function PlayerCard({ player, onRefresh, config, rosterCount, minRoster, navigate }) {
  const [showListModal, setShowListModal]       = useState(false)
  const [showClauseModal, setShowClauseModal]   = useState(false)
  const [showReleaseModal, setShowReleaseModal] = useState(false)
  const [listPrice, setListPrice]     = useState('')
  const [newClause, setNewClause]     = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [clauseSuccess, setClauseSuccess] = useState('')

  // base_price comes from the server (includes position multiplier)
  const basePrice     = player.base_price ?? null
  const effectiveClause = player.release_clause ?? basePrice     // what buyers see
  const clauseRaised  = player.release_clause && basePrice && player.release_clause > basePrice
  const releasePayout = basePrice && config ? Math.round(basePrice * config.releasePct / 100) : null
  const atMinRoster   = rosterCount <= minRoster

  // Live cost preview for the raise-clause modal
  const parsedNew  = parseInt(newClause) || 0
  const clauseCost = parsedNew > 0 && effectiveClause ? Math.max(0, parsedNew - effectiveClause) : 0

  const handleList = async () => {
    if (!listPrice || isNaN(listPrice) || Number(listPrice) <= 0) return setError('Precio inválido')
    setLoading(true); setError('')
    try {
      await listPlayer(player.id, parseInt(listPrice))
      setShowListModal(false); setListPrice(''); onRefresh()
    } catch (err) { setError(err.response?.data?.error || 'Error') }
    finally { setLoading(false) }
  }

  const handleUnlist = async () => {
    setLoading(true)
    try { await unlistPlayer(player.id); onRefresh() }
    catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleRaiseClause = async () => {
    if (!newClause || isNaN(newClause) || parsedNew <= 0) return setError('Monto inválido')
    setLoading(true); setError('')
    try {
      const res = await setClause(player.id, parsedNew)
      setClauseSuccess(`Cláusula subida a ${formatMoney(res.data.newClause)}. Pagaste ${formatMoney(res.data.paid)}.`)
      setShowClauseModal(false); setNewClause('')
      onRefresh()
      setTimeout(() => setClauseSuccess(''), 5000)
    } catch (err) { setError(err.response?.data?.error || 'Error') }
    finally { setLoading(false) }
  }

  const handleResetClause = async () => {
    setLoading(true)
    try { await removeClause(player.id); onRefresh() }
    catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleRelease = async () => {
    setLoading(true); setError('')
    try {
      await releasePlayer(player.id)
      setShowReleaseModal(false); onRefresh()
    } catch (err) { setError(err.response?.data?.error || 'Error') }
    finally { setLoading(false) }
  }

  return (
    <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 hover:border-gray-600 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex-1 min-w-0">
          <div
            className="text-white font-semibold text-sm truncate cursor-pointer hover:text-green-400 transition-colors"
            onClick={() => navigate(`/player/${player.id}`)}
          >{player.name}</div>
          <div className="text-gray-400 text-xs">{player.nationality}</div>
        </div>
        <div className={`text-lg font-bold ml-2 ${ratingColor(player.rating)}`}>{player.rating}</div>
      </div>

      <div className="flex items-center gap-2 mb-2.5">
        <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded font-medium">
          {player.position}
        </span>
        <span className="text-gray-500 text-xs">{player.foot === 'Right' ? 'D' : player.foot === 'Left' ? 'I' : 'A'}</span>
      </div>

      {/* Price + clause block — always visible */}
      <div className="bg-gray-900/60 rounded-lg px-2.5 py-2 mb-2.5 space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-gray-500 text-xs">Valor base</span>
          <span className="text-white text-xs font-semibold">{basePrice ? formatMoney(basePrice) : '—'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500 text-xs">Cláusula</span>
          <span className={`text-xs font-bold ${clauseRaised ? 'text-orange-400' : 'text-green-400'}`}>
            {effectiveClause ? formatMoney(effectiveClause) : '—'}
            {clauseRaised && <span className="text-gray-500 font-normal ml-1">(subida)</span>}
          </span>
        </div>
        {player.listed_price && (
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-xs">En venta</span>
            <span className="text-blue-400 text-xs font-semibold">{formatMoney(player.listed_price)}</span>
          </div>
        )}
      </div>

      {clauseSuccess && (
        <div className="text-green-400 text-xs bg-green-500/10 border border-green-500/20 rounded-lg px-2 py-1.5 mb-2">
          {clauseSuccess}
        </div>
      )}

      {/* Action buttons */}
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

        <button
          onClick={() => { setShowClauseModal(true); setNewClause(''); setError('') }}
          className="text-xs bg-orange-600 hover:bg-orange-500 text-white px-2 py-1 rounded-md transition-colors"
        >
          Subir cláusula
        </button>

        {clauseRaised && (
          <button
            onClick={handleResetClause}
            disabled={loading}
            title="Resetea la cláusula al valor base (sin reembolso)"
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white px-2 py-1 rounded-md transition-colors"
          >
            Resetear
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

      {/* List for sale modal */}
      {showListModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-5 w-full max-w-sm border border-gray-700">
            <h3 className="text-white font-semibold mb-3">Poner en venta a {player.name}</h3>
            <p className="text-gray-500 text-xs mb-3">Valor base: <span className="text-white">{basePrice ? formatMoney(basePrice) : '—'}</span></p>
            <input
              type="number"
              placeholder="Precio de venta"
              value={listPrice}
              onChange={e => setListPrice(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 mb-2"
              autoFocus
            />
            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
            <div className="flex gap-2">
              <button onClick={handleList} disabled={loading}
                className="flex-1 bg-green-500 hover:bg-green-400 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                Confirmar
              </button>
              <button onClick={() => { setShowListModal(false); setError('') }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 rounded-lg transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Raise clause modal */}
      {showClauseModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-5 w-full max-w-sm border border-gray-700">
            <h3 className="text-white font-semibold mb-1">Subir cláusula — {player.name}</h3>
            <p className="text-gray-500 text-xs mb-4">
              Pagás la diferencia entre la nueva cláusula y la actual. El dinero no se devuelve si la bajás después.
            </p>

            <div className="bg-gray-800 rounded-lg p-3 mb-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Cláusula actual</span>
                <span className="text-white font-medium">{effectiveClause ? formatMoney(effectiveClause) : '—'}</span>
              </div>
              {parsedNew > effectiveClause && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Nueva cláusula</span>
                    <span className="text-orange-400 font-bold">{formatMoney(parsedNew)}</span>
                  </div>
                  <div className="border-t border-gray-700 pt-1.5 flex justify-between">
                    <span className="text-gray-400">Costo para vos</span>
                    <span className="text-red-400 font-bold">− {formatMoney(clauseCost)}</span>
                  </div>
                </>
              )}
            </div>

            <input
              type="number"
              placeholder={`Mayor a ${effectiveClause ? effectiveClause.toLocaleString() : 0}`}
              value={newClause}
              onChange={e => setNewClause(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 mb-2"
              autoFocus
            />
            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
            <div className="flex gap-2">
              <button onClick={handleRaiseClause} disabled={loading || parsedNew <= (effectiveClause ?? 0)}
                className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                {loading ? 'Guardando...' : clauseCost > 0 ? `Confirmar (−${formatMoney(clauseCost)})` : 'Confirmar'}
              </button>
              <button onClick={() => { setShowClauseModal(false); setError('') }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 rounded-lg transition-colors">
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
            <div className="bg-gray-800 rounded-lg px-4 py-3 mb-2 flex justify-between items-center">
              <span className="text-gray-400 text-sm">Valor base</span>
              <span className="text-white font-medium">{basePrice ? formatMoney(basePrice) : '—'}</span>
            </div>
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 mb-4 flex justify-between items-center">
              <span className="text-green-400 text-sm font-medium">Recibís</span>
              <span className="text-green-400 font-bold text-lg">{releasePayout ? formatMoney(releasePayout) : '—'}</span>
            </div>
            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
            <div className="flex gap-2">
              <button onClick={handleRelease} disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                {loading ? 'Liberando...' : 'Confirmar liberación'}
              </button>
              <button onClick={() => { setShowReleaseModal(false); setError('') }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 rounded-lg transition-colors">
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
    try { await acceptOffer(id); flash('Transferencia aceptada'); fetch(); onRefresh() }
    catch (err) { flash(err.response?.data?.error || 'Error') }
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
    try { await rejectOffer(id); flash('Oferta rechazada'); fetch() }
    catch (err) { flash(err.response?.data?.error || 'Error') }
    finally { setLoading(false) }
  }

  if (offers.length === 0) return null

  return (
    <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 space-y-3">
      <h2 className="text-orange-300 font-semibold text-sm flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
        Ofertas recibidas ({offers.length})
      </h2>
      {msg && <div className="text-green-400 text-xs bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">{msg}</div>}
      {offers.map(o => {
        const isDirectOffer = o.offer_type === 'offer'
        return (
        <div key={o.id} className="bg-gray-900 rounded-xl p-4 border border-gray-700 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-semibold">{o.player_name}</span>
                <span className="text-yellow-400 text-xs font-bold">{o.player_rating}</span>
                <span className="bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded">{o.player_position}</span>
                {isDirectOffer
                  ? <span className="text-blue-400 text-xs border border-blue-400/30 bg-blue-400/10 px-1.5 py-0.5 rounded">Oferta directa</span>
                  : <span className="text-orange-400 text-xs border border-orange-400/30 bg-orange-400/10 px-1.5 py-0.5 rounded">Ejecución de cláusula</span>
                }
              </div>
              <div className="text-gray-400 text-xs mt-0.5">
                {isDirectOffer
                  ? <>Oferta de <span className="text-white">{o.buyer_username}</span> — <span className="text-blue-400 font-bold">{formatMoney(o.clause_amount)}</span></>
                  : <>Cláusula ejecutada por <span className="text-white">{o.buyer_username}</span> — <span className="text-orange-400 font-bold">{formatMoney(o.clause_amount)}</span></>
                }
              </div>
            </div>
            <div className={`font-bold text-lg ${isDirectOffer ? 'text-blue-400' : 'text-orange-400'}`}>
              {formatMoney(o.clause_amount)}
            </div>
          </div>

          {/* Raise input — only for clause executions, not direct offers */}
          {!isDirectOffer && (
          <div className="flex gap-2">
            <input
              type="number"
              placeholder={`Mínimo ${(o.clause_amount + 1000000).toLocaleString()}`}
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
          )}

          <div className="flex gap-2">
            <button onClick={() => handleAccept(o.id)} disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
              {isDirectOffer ? 'Aceptar oferta' : 'Aceptar transferencia'}
            </button>
            {/* Rechazar solo para ofertas directas; las cláusulas solo se rechazan subiendo el valor */}
            {isDirectOffer && (
              <button onClick={() => handleReject(o.id)} disabled={loading}
                className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                Rechazar
              </button>
            )}
          </div>
        </div>
        )
      })}
    </div>
  )
}

function ReceivedSwapOffers({ onRefresh }) {
  const [swaps, setSwaps] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const fetchSwaps = () => getReceivedSwaps().then(r => setSwaps(r.data)).catch(console.error)
  useEffect(() => { fetchSwaps() }, [])

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 4000) }

  const handleAccept = async (id) => {
    setLoading(true)
    try { await acceptSwap(id); flash('Intercambio aceptado'); fetchSwaps(); onRefresh() }
    catch (err) { flash(err.response?.data?.error || 'Error al aceptar') }
    finally { setLoading(false) }
  }

  const handleReject = async (id) => {
    setLoading(true)
    try { await rejectSwap(id); flash('Intercambio rechazado'); fetchSwaps() }
    catch (err) { flash(err.response?.data?.error || 'Error') }
    finally { setLoading(false) }
  }

  if (swaps.length === 0) return null

  return (
    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 space-y-3">
      <h2 className="text-purple-300 font-semibold text-sm flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
        Intercambios recibidos ({swaps.length})
      </h2>
      {msg && <div className="text-green-400 text-xs bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">{msg}</div>}
      {swaps.map(s => {
        const cashDiff = s.cash_difference || 0
        return (
          <div key={s.id} className="bg-gray-900 rounded-xl p-4 border border-gray-700 space-y-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="text-purple-400 font-medium">{s.proposer_username}</span>
              <span>propone un intercambio</span>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
              {/* What you give up */}
              <div className="bg-gray-800 rounded-lg p-2.5">
                <p className="text-gray-500 text-xs mb-1">Vos dás</p>
                <p className="text-white text-sm font-semibold">{s.requested_player_name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-xs font-bold ${ratingColor(s.requested_player_rating)}`}>{s.requested_player_rating}</span>
                  <span className="text-gray-500 text-xs">{s.requested_player_position}</span>
                </div>
              </div>

              <div className="text-gray-500 text-center text-lg">⇌</div>

              {/* What you get */}
              <div className="bg-gray-800 rounded-lg p-2.5">
                <p className="text-gray-500 text-xs mb-1">Recibís</p>
                <p className="text-white text-sm font-semibold">{s.offered_player_name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-xs font-bold ${ratingColor(s.offered_player_rating)}`}>{s.offered_player_rating}</span>
                  <span className="text-gray-500 text-xs">{s.offered_player_position}</span>
                </div>
              </div>
            </div>

            {cashDiff !== 0 && (
              <div className={`rounded-lg px-3 py-2 text-xs font-medium ${
                cashDiff > 0
                  ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}>
                {cashDiff > 0
                  ? `+ recibís ${formatMoney(cashDiff)} de compensación de ${s.proposer_username}`
                  : `− pagás ${formatMoney(Math.abs(cashDiff))} de compensación a ${s.proposer_username}`
                }
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleAccept(s.id)}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                Aceptar
              </button>
              <button
                onClick={() => handleReject(s.id)}
                disabled={loading}
                className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                Rechazar
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Team() {
  const navigate = useNavigate()
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
    // getPublicConfig works for all users (not admin-only)
    getPublicConfig().then(r => setConfig(r.data)).catch(console.error)
  }, [])

  const minRoster = config?.minRoster ?? 18

  const grouped = positionOrder.reduce((acc, pos) => {
    const group = players.filter(p => p.position === pos)
    if (group.length > 0) acc[pos] = group
    return acc
  }, {})

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
      <ReceivedSwapOffers onRefresh={fetchPlayers} />

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
                  navigate={navigate}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
