import React, { useState, useEffect, useCallback } from 'react'
import { getMarketPlayers, getClausePlayers, getFreePlayers, buyPlayer, makeDirectOffer, getSentOffers, acceptRaisedOffer, cancelOffer, getAllClauseOffers, getAllSwapOffers, getSentSwaps, cancelSwap, listPlayer, setClause, releasePlayer, getPublicConfig } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { formatMoney, ratingColor } from '../utils/format'
import SwapModal from '../components/SwapModal'

const STATUS_LABELS = {
  pending:   { label: 'Pendiente',       color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
  accepted:  { label: 'Aceptada',        color: 'text-green-400 bg-green-400/10 border-green-400/30' },
  raised:    { label: 'Cláusula subida', color: 'text-orange-400 bg-orange-400/10 border-orange-400/30' },
  rejected:  { label: 'Rechazada',       color: 'text-red-400 bg-red-400/10 border-red-400/30' },
  cancelled: { label: 'Cancelada',       color: 'text-gray-400 bg-gray-400/10 border-gray-400/30' },
}

const ALL_POSITIONS = ['GK', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'LW', 'ST']

function PlayerRow({ player, priceField, onBuy, isClause, onDirectOffer, onSwap, onOwnAction }) {
  const isOwn = !!player.is_own
  return (
    <div className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors ${isOwn ? 'bg-blue-500/5' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium text-sm">{player.name}</span>
          {isOwn && <span className="text-blue-400 text-xs bg-blue-400/10 border border-blue-400/30 px-1.5 py-0.5 rounded">Mi jugador</span>}
        </div>
        <div className="text-gray-500 text-xs">{player.nationality} · {player.pes_team}</div>
        {player.owner_username && !isOwn && (
          <div className="text-gray-600 text-xs">Dueño: {player.owner_username}</div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <span className={`text-sm font-bold ${ratingColor(player.rating)}`}>{player.rating}</span>
        <span className="bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded">{player.position}</span>
        <div className="text-right min-w-[90px]">
          <div className="text-green-400 font-bold text-sm">{formatMoney(player[priceField])}</div>
        </div>
        {isOwn && onOwnAction ? (
          <>
            <button onClick={() => onOwnAction(player, 'list')}
              className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap bg-green-700 hover:bg-green-600">
              Poner en venta
            </button>
            <button onClick={() => onOwnAction(player, 'clause')}
              className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap bg-orange-700 hover:bg-orange-600">
              Subir cláusula
            </button>
            <button onClick={() => onOwnAction(player, 'release')}
              className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap bg-red-800 hover:bg-red-700">
              Liberar
            </button>
          </>
        ) : (
          <>
            {isClause && onDirectOffer && (
              <button onClick={() => onDirectOffer(player)}
                className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap bg-blue-700 hover:bg-blue-600">
                Hacer oferta
              </button>
            )}
            {isClause && onSwap && (
              <button onClick={() => onSwap(player)}
                className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap bg-purple-700 hover:bg-purple-600">
                ⇌ Intercambio
              </button>
            )}
            <button onClick={() => onBuy(player)}
              className={`text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                isClause ? 'bg-orange-600 hover:bg-orange-500' : 'bg-green-500 hover:bg-green-400'
              }`}>
              {isClause ? 'Activar cláusula' : 'Comprar'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function OwnPlayerModal({ action, config, onClose, onSuccess }) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const { player, type } = action
  const basePrice       = player.base_price ?? 0
  const effectiveClause = player.release_clause ?? basePrice
  const releasePay      = config ? Math.round(basePrice * (config.releasePct ?? 60) / 100) : null
  const parsedAmt       = parseInt(amount) || 0
  const clauseCost      = type === 'clause' && parsedAmt > effectiveClause ? parsedAmt - effectiveClause : 0

  const handleSubmit = async () => {
    setLoading(true); setError('')
    try {
      if (type === 'list') {
        if (!parsedAmt || parsedAmt <= 0) return setError('Precio inválido')
        if (parsedAmt > effectiveClause) return setError(`No puede superar la cláusula (${formatMoney(effectiveClause)})`)
        await listPlayer(player.id, parsedAmt)
        setDone(`${player.name} puesto en venta por ${formatMoney(parsedAmt)}`)
      } else if (type === 'clause') {
        if (!parsedAmt || parsedAmt <= effectiveClause) return setError(`El nuevo monto debe superar la cláusula actual (${formatMoney(effectiveClause)})`)
        await setClause(player.id, parsedAmt)
        setDone(`Cláusula de ${player.name} subida a ${formatMoney(parsedAmt)}`)
      } else if (type === 'release') {
        await releasePlayer(player.id)
        setDone(`${player.name} liberado`)
      }
      onSuccess()
    } catch (err) { setError(err.response?.data?.error || 'Error') }
    finally { setLoading(false) }
  }

  const titles = { list: 'Poner en venta', clause: 'Subir cláusula', release: 'Liberar jugador' }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-gray-700 shadow-2xl space-y-4">
        <div>
          <h3 className="text-white text-lg font-bold">{titles[type]}</h3>
          <p className="text-gray-400 text-sm">{player.name} · <span className={ratingColor(player.rating)}>{player.rating}</span> · {player.position}</p>
        </div>

        {done ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-green-400 text-sm">{done}</div>
        ) : (
          <>
            <div className="bg-gray-800 rounded-lg px-4 py-2 text-xs text-gray-400 space-y-1">
              <div className="flex justify-between"><span>Valor base</span><span className="text-white">{formatMoney(basePrice)}</span></div>
              <div className="flex justify-between"><span>Cláusula actual</span><span className="text-orange-400">{formatMoney(effectiveClause)}</span></div>
            </div>

            {type === 'list' && (
              <div className="space-y-2">
                <label className="text-gray-400 text-xs">Precio de venta (máx. {formatMoney(effectiveClause)})</label>
                <input type="number" min="1" placeholder="Ingresá el precio..."
                  value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" />
              </div>
            )}

            {type === 'clause' && (
              <div className="space-y-2">
                <label className="text-gray-400 text-xs">Nueva cláusula (mayor a {formatMoney(effectiveClause)})</label>
                <input type="number" min={effectiveClause + 1} placeholder="Nuevo monto..."
                  value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                {clauseCost > 0 && (
                  <p className="text-orange-400 text-xs">Pagás la diferencia: <strong>{formatMoney(clauseCost)}</strong></p>
                )}
              </div>
            )}

            {type === 'release' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 flex justify-between items-center">
                <span className="text-green-400 text-sm">Recibís</span>
                <span className="text-green-400 font-bold text-lg">{releasePay ? formatMoney(releasePay) : '...'}</span>
              </div>
            )}

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <div className="flex gap-2">
              <button onClick={handleSubmit} disabled={loading}
                className={`flex-1 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50 ${
                  type === 'release' ? 'bg-red-600 hover:bg-red-500' :
                  type === 'clause'  ? 'bg-orange-600 hover:bg-orange-500' :
                  'bg-green-600 hover:bg-green-500'
                }`}>
                {loading ? 'Procesando...' : 'Confirmar'}
              </button>
              <button onClick={onClose}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 rounded-lg transition-colors">
                Cancelar
              </button>
            </div>
          </>
        )}

        {done && (
          <button onClick={onClose} className="w-full bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 rounded-lg transition-colors">
            Cerrar
          </button>
        )}
      </div>
    </div>
  )
}

const EMPTY_FILTERS = { search: '', position: '', ovrMin: '', ovrMax: '', priceMin: '', priceMax: '', manager: '' }

const OFFER_STATUS_LABELS = {
  pending:   { label: 'Pendiente',        color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
  accepted:  { label: 'Aceptada',         color: 'text-green-400 bg-green-400/10 border-green-400/30' },
  raised:    { label: 'Cláusula subida',  color: 'text-orange-400 bg-orange-400/10 border-orange-400/30' },
  rejected:  { label: 'Rechazada',        color: 'text-red-400 bg-red-400/10 border-red-400/30' },
  cancelled: { label: 'Cancelada',        color: 'text-gray-400 bg-gray-400/10 border-gray-400/30' },
}

const PAGE_SIZE_OFFERS = 30

const HIST_STATUS_OPTIONS = [
  { value: '',           label: 'Todas' },
  { value: 'pending',    label: 'Pendientes' },
  { value: 'raised',     label: 'Subidas' },
  { value: 'accepted',   label: 'Aceptadas' },
  { value: 'rejected',   label: 'Rechazadas' },
  { value: 'cancelled',  label: 'Canceladas' },
]

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function StatusFilterBar({ status, onChange, total, label }) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {HIST_STATUS_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            status === opt.value
              ? 'bg-green-500 border-green-500 text-white'
              : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
          }`}
        >
          {opt.label}
        </button>
      ))}
      <span className="text-gray-600 text-xs ml-auto">{total} {label}</span>
    </div>
  )
}

function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between">
      <button onClick={() => onPage(p => Math.max(0, p - 1))} disabled={page === 0}
        className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white rounded-lg transition-colors">
        ← Anterior
      </button>
      <span className="text-sm text-gray-400">{page + 1} / {totalPages}</span>
      <button onClick={() => onPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
        className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white rounded-lg transition-colors">
        Siguiente →
      </button>
    </div>
  )
}

// ── Historial: cláusulas y ofertas directas ──
function ClauseHistTab() {
  const [offers, setOffers] = useState([])
  const [total,  setTotal]  = useState(0)
  const [page,   setPage]   = useState(0)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params = { limit: PAGE_SIZE_OFFERS, offset: page * PAGE_SIZE_OFFERS }
    if (status) params.status = status
    getAllClauseOffers(params)
      .then(r => { if (!cancelled) { setOffers(r.data.offers); setTotal(r.data.total) } })
      .catch(e => { if (!cancelled) console.error(e) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [status, page])

  const handleStatus = (s) => { setStatus(s); setPage(0) }
  const totalPages = Math.ceil(total / PAGE_SIZE_OFFERS)

  return (
    <div className="space-y-4">
      <StatusFilterBar status={status} onChange={handleStatus} total={total} label={`oferta${total !== 1 ? 's' : ''}`} />
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="text-gray-400 text-center py-12">Cargando...</div>
        ) : offers.length === 0 ? (
          <div className="text-gray-500 text-center py-12 text-sm">No hay ofertas registradas</div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {offers.map(o => {
              const st = OFFER_STATUS_LABELS[o.status] || OFFER_STATUS_LABELS.pending
              const isClause = o.offer_type !== 'offer'
              const displayAmount = o.status === 'accepted' && o.new_clause_amount ? o.new_clause_amount : o.clause_amount
              return (
                <div key={o.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-800/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium text-sm">{o.player_name}</span>
                      <span className="text-yellow-400 text-xs font-bold">{o.player_rating}</span>
                      <span className="bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded">{o.player_position}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${isClause ? 'text-orange-400 border-orange-400/30 bg-orange-400/10' : 'text-blue-400 border-blue-400/30 bg-blue-400/10'}`}>
                        {isClause ? 'Cláusula' : 'Oferta directa'}
                      </span>
                    </div>
                    <div className="text-gray-500 text-xs mt-0.5 flex items-center gap-1 flex-wrap">
                      <span className="text-gray-300">{o.buyer_username}</span>
                      <span className="text-gray-600">→</span>
                      <span className="text-gray-300">{o.owner_username}</span>
                      <span className="text-gray-700">·</span>
                      <span>{fmtDate(o.created_at)}</span>
                    </div>
                    {o.new_clause_amount && o.status !== 'accepted' && (
                      <div className="text-orange-400 text-xs mt-0.5">Cláusula subida a {formatMoney(o.new_clause_amount)}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <div className="text-green-400 font-bold text-sm">{formatMoney(displayAmount)}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border inline-block ${st.color}`}>{st.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  )
}

// ── Historial: intercambios ──
function SwapHistTab() {
  const [offers, setOffers] = useState([])
  const [total,  setTotal]  = useState(0)
  const [page,   setPage]   = useState(0)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params = { limit: PAGE_SIZE_OFFERS, offset: page * PAGE_SIZE_OFFERS }
    if (status) params.status = status
    getAllSwapOffers(params)
      .then(r => { if (!cancelled) { setOffers(r.data.offers); setTotal(r.data.total) } })
      .catch(e => { if (!cancelled) console.error(e) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [status, page])

  const handleStatus = (s) => { setStatus(s); setPage(0) }
  const totalPages = Math.ceil(total / PAGE_SIZE_OFFERS)

  return (
    <div className="space-y-4">
      <StatusFilterBar status={status} onChange={handleStatus} total={total} label={`intercambio${total !== 1 ? 's' : ''}`} />
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="text-gray-400 text-center py-12">Cargando...</div>
        ) : offers.length === 0 ? (
          <div className="text-gray-500 text-center py-12 text-sm">No hay intercambios registrados</div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {offers.map(o => {
              const st = OFFER_STATUS_LABELS[o.status] || OFFER_STATUS_LABELS.pending
              const cashDiff = o.cash_difference || 0
              return (
                <div key={o.id} className="px-4 py-3 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Swap details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap text-sm">
                        <span className="text-purple-400 font-semibold">{o.proposer_username}</span>
                        <span className="text-gray-600">propone a</span>
                        <span className="text-gray-300 font-medium">{o.receiver_username}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="bg-gray-800 rounded-lg px-2 py-1 text-xs">
                          <span className="text-white font-medium">{o.offered_player_name}</span>
                          <span className="text-yellow-400 font-bold ml-1">{o.offered_player_rating}</span>
                          <span className="text-gray-500 ml-1">{o.offered_player_position}</span>
                        </span>
                        <span className="text-gray-500">⇌</span>
                        <span className="bg-gray-800 rounded-lg px-2 py-1 text-xs">
                          <span className="text-white font-medium">{o.requested_player_name}</span>
                          <span className="text-yellow-400 font-bold ml-1">{o.requested_player_rating}</span>
                          <span className="text-gray-500 ml-1">{o.requested_player_position}</span>
                        </span>
                      </div>
                      {cashDiff !== 0 && (
                        <div className={`text-xs mt-1 ${cashDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {cashDiff > 0
                            ? `+ ${formatMoney(cashDiff)} de ${o.proposer_username}`
                            : `+ ${formatMoney(Math.abs(cashDiff))} de ${o.receiver_username}`}
                        </div>
                      )}
                      <div className="text-gray-600 text-xs mt-1">{fmtDate(o.created_at)}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border inline-block shrink-0 mt-1 ${st.color}`}>{st.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  )
}

// ── Historial unificado con sub-tabs ──
function HistorialTab() {
  const [histType, setHistType] = useState('clauses')
  return (
    <div className="space-y-4">
      <div className="flex bg-gray-900 rounded-xl p-1 border border-gray-800 w-fit gap-1">
        {[
          { id: 'clauses', label: 'Cláusulas y ofertas' },
          { id: 'swaps',   label: 'Intercambios' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setHistType(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              histType === t.id ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {histType === 'clauses' && <ClauseHistTab />}
      {histType === 'swaps'   && <SwapHistTab />}
    </div>
  )
}

export default function Market() {
  const { user, refreshUser } = useAuth()
  const [tab, setTab] = useState('market')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [marketPlayers, setMarketPlayers] = useState([])
  const [clausePlayers, setClausePlayers] = useState([])
  const [freePlayers, setFreePlayers] = useState([])
  const [sentOffers, setSentOffers] = useState([])
  const [sentSwaps,  setSentSwaps]  = useState([])
  const [config,     setConfig]     = useState(null)
  const [ownAction,  setOwnAction]  = useState(null) // { player, type: 'list'|'clause'|'release' }
  const [loading, setLoading] = useState(true)
  const [confirmPlayer, setConfirmPlayer] = useState(null)
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState('')
  const [buySuccess, setBuySuccess] = useState('')
  // Direct offer modal (below-clause)
  const [directOfferPlayer, setDirectOfferPlayer] = useState(null)
  // Swap modal
  const [swapPlayer, setSwapPlayer] = useState(null)
  const [directOfferAmt, setDirectOfferAmt] = useState('')
  const [directOfferErr, setDirectOfferErr] = useState('')
  const [directOfferLoading, setDirectOfferLoading] = useState(false)

  const fetchAll = useCallback(() => {
    setLoading(true)
    Promise.all([getMarketPlayers(), getClausePlayers(), getFreePlayers(), getSentOffers(), getSentSwaps(), getPublicConfig()])
      .then(([m, c, f, s, sw, cfg]) => {
        setMarketPlayers(m.data)
        setClausePlayers(c.data)
        setFreePlayers(f.data)
        setSentOffers(s.data)
        setSentSwaps(sw.data)
        setConfig(cfg.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const setFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }))

  const applyFilters = (list, priceField) => {
    const { search, position, ovrMin, ovrMax, priceMin, priceMax, manager } = filters
    return list.filter(p => {
      if (search) {
        const q = search.toLowerCase()
        if (
          !p.name.toLowerCase().includes(q) &&
          !(p.pes_team || '').toLowerCase().includes(q) &&
          !(p.nationality || '').toLowerCase().includes(q)
        ) return false
      }
      if (position && p.position !== position) return false
      if (ovrMin  && p.rating < parseInt(ovrMin))  return false
      if (ovrMax  && p.rating > parseInt(ovrMax))   return false
      const price = p[priceField]
      if (priceMin && price < parseInt(priceMin)) return false
      if (priceMax && price > parseInt(priceMax)) return false
      if (manager && p.owner_username !== manager) return false
      return true
    })
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  const handleBuy = async () => {
    if (!confirmPlayer) return
    setBuying(true)
    setBuyError('')
    try {
      const res = await buyPlayer(confirmPlayer.id)
      if (res.data.pending) {
        setBuySuccess(`Oferta enviada por ${confirmPlayer.name}. El manager tiene que responder.`)
      } else {
        setBuySuccess(`¡${confirmPlayer.name} comprado por ${formatMoney(res.data.price)}!`)
      }
      setConfirmPlayer(null)
      fetchAll()
      refreshUser()
      setTimeout(() => setBuySuccess(''), 5000)
    } catch (err) {
      setBuyError(err.response?.data?.error || 'Error al comprar')
    } finally {
      setBuying(false)
    }
  }

  const handleDirectOffer = async () => {
    const amt = parseInt(directOfferAmt)
    if (!amt || amt <= 0) return setDirectOfferErr('Monto inválido')
    setDirectOfferLoading(true); setDirectOfferErr('')
    try {
      await makeDirectOffer(directOfferPlayer.id, amt)
      setBuySuccess(`Oferta de ${formatMoney(amt)} enviada por ${directOfferPlayer.name}`)
      setDirectOfferPlayer(null); setDirectOfferAmt('')
      fetchAll()
      setTimeout(() => setBuySuccess(''), 5000)
    } catch (err) {
      setDirectOfferErr(err.response?.data?.error || 'Error')
    } finally { setDirectOfferLoading(false) }
  }

  const handleAcceptRaised = async (offerId) => {
    try {
      await acceptRaisedOffer(offerId)
      setBuySuccess('¡Transferencia completada con la cláusula aumentada!')
      fetchAll(); refreshUser()
      setTimeout(() => setBuySuccess(''), 5000)
    } catch (err) {
      setBuyError(err.response?.data?.error || 'Error')
    }
  }

  const handleCancelOffer = async (offerId) => {
    try {
      await cancelOffer(offerId)
      fetchAll()
    } catch (err) { console.error(err) }
  }

  const pendingCount = sentOffers.filter(o => ['pending', 'raised'].includes(o.status)).length
    + sentSwaps.filter(o => o.status === 'pending').length

  const handleCancelSwap = async (id) => {
    try { await cancelSwap(id); fetchAll() } catch (err) { console.error(err) }
  }

  const tabs = [
    { id: 'market',    label: 'En venta',      count: marketPlayers.length },
    { id: 'clauses',   label: 'Cláusulas',      count: clausePlayers.length },
    { id: 'free',      label: 'Agentes Libres', count: freePlayers.length },
    { id: 'offers',    label: 'Mis ofertas',    count: pendingCount, highlight: pendingCount > 0 },
    { id: 'alloffer',  label: 'Historial' },
  ]

  const priceField = tab === 'market' ? 'listed_price' : tab === 'clauses' ? 'release_clause' : 'price'
  const currentList = tab === 'market' ? marketPlayers : tab === 'clauses' ? clausePlayers : freePlayers
  const displayList = applyFilters(currentList, priceField)
  const isClauseTab = tab === 'clauses'

  const handleTabChange = (id) => {
    setTab(id)
    setFilters(EMPTY_FILTERS)
    setShowFilters(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-white text-2xl font-bold">Mercado</h1>
        <p className="text-gray-400 text-sm mt-1">Tu presupuesto: {formatMoney(user?.budget)}</p>
      </div>

      {buySuccess && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-green-400 text-sm">
          {buySuccess}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap bg-gray-900 rounded-xl p-1 border border-gray-800 w-fit gap-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              tab === t.id ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                t.highlight ? 'bg-yellow-500 text-black font-bold' :
                tab === t.id ? 'bg-white/20' : 'bg-gray-700'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search + Filter bar */}
      {tab !== 'offers' && tab !== 'alloffer' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Buscar por nombre, equipo o nacionalidad..."
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 text-sm"
            />
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors whitespace-nowrap ${
                showFilters || hasActiveFilters
                  ? 'bg-green-500/20 border-green-500/50 text-green-400'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              Filtros
              {hasActiveFilters && (
                <span className="bg-green-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {Object.values(filters).filter(v => v !== '').length}
                </span>
              )}
            </button>
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Position */}
                <div>
                  <label className="text-gray-500 text-xs block mb-1.5">Posición</label>
                  <select
                    value={filters.position}
                    onChange={e => setFilter('position', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                  >
                    <option value="">Todas</option>
                    {ALL_POSITIONS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* OVR range */}
                <div>
                  <label className="text-gray-500 text-xs block mb-1.5">Habilidad (OVR)</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      placeholder="Mín"
                      min="1" max="99"
                      value={filters.ovrMin}
                      onChange={e => setFilter('ovrMin', e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                    />
                    <input
                      type="number"
                      placeholder="Máx"
                      min="1" max="99"
                      value={filters.ovrMax}
                      onChange={e => setFilter('ovrMax', e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                    />
                  </div>
                </div>

                {/* Price range */}
                <div className="col-span-2">
                  <label className="text-gray-500 text-xs block mb-1.5">Precio</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      placeholder="Precio mínimo"
                      min="0"
                      value={filters.priceMin}
                      onChange={e => setFilter('priceMin', e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                    />
                    <input
                      type="number"
                      placeholder="Precio máximo"
                      min="0"
                      value={filters.priceMax}
                      onChange={e => setFilter('priceMax', e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Manager filter — only in clauses tab */}
              {isClauseTab && (() => {
                const managers = [...new Set(clausePlayers.map(p => p.owner_username).filter(Boolean))].sort()
                if (managers.length === 0) return null
                return (
                  <div>
                    <label className="text-gray-500 text-xs block mb-1.5">Manager</label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setFilter('manager', '')}
                        className={`px-3 py-1 rounded-lg text-xs border transition-colors ${
                          !filters.manager ? 'bg-green-500 border-green-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                        }`}
                      >
                        Todos
                      </button>
                      {managers.map(m => (
                        <button key={m}
                          onClick={() => setFilter('manager', m)}
                          className={`px-3 py-1 rounded-lg text-xs border transition-colors ${
                            filters.manager === m ? 'bg-green-500 border-green-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {hasActiveFilters && (
                <button
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="text-gray-400 hover:text-white text-xs underline"
                >
                  Limpiar todos los filtros
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Clause info banner */}
      {isClauseTab && tab !== 'alloffer' && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-4 py-3 text-orange-300 text-xs">
          Al activar una cláusula se envía una oferta al dueño del jugador. Él puede aceptar la transferencia o subir la cláusula pagando la diferencia de su propio presupuesto.
        </div>
      )}

      {/* Feed de ofertas (público) */}
      {tab === 'alloffer' && <HistorialTab />}

      {/* Player list */}
      {tab !== 'offers' && tab !== 'alloffer' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {loading ? (
            <div className="text-gray-400 text-center py-12">Cargando...</div>
          ) : displayList.length === 0 ? (
            <div className="text-gray-500 text-center py-12">
              {hasActiveFilters ? 'Ningún jugador coincide con los filtros' : 'No hay jugadores disponibles'}
            </div>
          ) : (
            <>
              <div className="px-4 py-2 border-b border-gray-800 text-gray-500 text-xs">
                {displayList.length} jugador{displayList.length !== 1 ? 'es' : ''}
                {hasActiveFilters && ` (filtrado de ${currentList.length})`}
              </div>
              <div className="divide-y divide-gray-800/50">
                {displayList.map(p => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    priceField={priceField}
                    onBuy={setConfirmPlayer}
                    isClause={isClauseTab}
                    onDirectOffer={isClauseTab && !p.is_own ? setDirectOfferPlayer : null}
                    onSwap={isClauseTab && !p.is_own ? setSwapPlayer : null}
                    onOwnAction={isClauseTab && p.is_own ? (pl, type) => setOwnAction({ player: pl, type }) : null}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Sent offers tab */}
      {tab === 'offers' && (
        <div className="space-y-6">
          {/* Cláusulas y ofertas directas */}
          <div>
            <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Cláusulas y ofertas directas</h3>
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              {loading ? (
                <div className="text-gray-400 text-center py-8">Cargando...</div>
              ) : sentOffers.length === 0 ? (
                <div className="text-gray-500 text-center py-8 text-sm">No enviaste ninguna oferta todavía</div>
              ) : (
                <div className="divide-y divide-gray-800/50">
                  {sentOffers.map(o => {
                    const statusInfo = STATUS_LABELS[o.status] || STATUS_LABELS.pending
                    const isRaised = o.status === 'raised'
                    const typeLabel = o.offer_type === 'offer' ? 'Oferta directa' : 'Cláusula'
                    return (
                      <div key={o.id} className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white font-medium text-sm">{o.player_name}</span>
                              <span className="text-yellow-400 text-xs font-bold">{o.player_rating}</span>
                              <span className="bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded">{o.player_position}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded border ${o.offer_type === 'offer' ? 'text-blue-400 border-blue-400/30 bg-blue-400/10' : 'text-orange-400 border-orange-400/30 bg-orange-400/10'}`}>
                                {typeLabel}
                              </span>
                            </div>
                            <div className="text-gray-500 text-xs mt-0.5">
                              Dueño: {o.owner_username} · {new Date(o.created_at).toLocaleDateString('es-AR')}
                            </div>
                            {isRaised && o.new_clause_amount && (
                              <div className="text-orange-300 text-xs mt-1 bg-orange-500/10 border border-orange-500/20 rounded px-2 py-1">
                                El dueño subió la cláusula a <strong>{formatMoney(o.new_clause_amount)}</strong>. ¿Aceptás?
                              </div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-green-400 font-bold text-sm">{formatMoney(o.clause_amount)}</div>
                            <span className={`text-xs px-2 py-0.5 rounded-full border mt-1 inline-block ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                        </div>
                        {isRaised && o.new_clause_amount && (
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => handleAcceptRaised(o.id)} className="bg-green-600 hover:bg-green-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                              Aceptar y pagar {formatMoney(o.new_clause_amount)}
                            </button>
                            <button onClick={() => handleCancelOffer(o.id)} className="bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                              Retirarme
                            </button>
                          </div>
                        )}
                        {o.status === 'pending' && (
                          <div className="mt-2">
                            <button onClick={() => handleCancelOffer(o.id)} className="text-gray-500 hover:text-red-400 text-xs transition-colors">
                              Cancelar oferta
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Intercambios enviados */}
          <div>
            <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Intercambios propuestos</h3>
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              {loading ? (
                <div className="text-gray-400 text-center py-8">Cargando...</div>
              ) : sentSwaps.length === 0 ? (
                <div className="text-gray-500 text-center py-8 text-sm">No propusiste ningún intercambio todavía</div>
              ) : (
                <div className="divide-y divide-gray-800/50">
                  {sentSwaps.map(o => {
                    const st = OFFER_STATUS_LABELS[o.status] || OFFER_STATUS_LABELS.pending
                    const cashDiff = o.cash_difference || 0
                    return (
                      <div key={o.id} className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-gray-500 text-xs mb-1.5">Para: <span className="text-gray-300">{o.receiver_username}</span></div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs">
                                <span className="text-white font-medium">{o.offered_player_name}</span>
                                <span className="text-yellow-400 font-bold ml-1">{o.offered_player_rating}</span>
                                <span className="text-gray-500 ml-1">{o.offered_player_position}</span>
                              </span>
                              <span className="text-purple-400 font-bold">⇌</span>
                              <span className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs">
                                <span className="text-white font-medium">{o.requested_player_name}</span>
                                <span className="text-yellow-400 font-bold ml-1">{o.requested_player_rating}</span>
                                <span className="text-gray-500 ml-1">{o.requested_player_position}</span>
                              </span>
                            </div>
                            {cashDiff !== 0 && (
                              <div className={`text-xs mt-1 ${cashDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {cashDiff > 0 ? `Yo pago +${formatMoney(cashDiff)}` : `Ellos pagan +${formatMoney(Math.abs(cashDiff))}`}
                              </div>
                            )}
                            <div className="text-gray-600 text-xs mt-1">{new Date(o.created_at).toLocaleDateString('es-AR')}</div>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full border inline-block shrink-0 mt-1 ${st.color}`}>{st.label}</span>
                        </div>
                        {o.status === 'pending' && (
                          <div className="mt-2">
                            <button onClick={() => handleCancelSwap(o.id)} className="text-gray-500 hover:text-red-400 text-xs transition-colors">
                              Cancelar intercambio
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Buy / clause confirmation modal */}
      {confirmPlayer && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-gray-700 shadow-2xl">
            <h3 className="text-white text-lg font-bold mb-1">
              {isClauseTab ? 'Activar cláusula' : 'Confirmar compra'}
            </h3>
            {isClauseTab && (
              <p className="text-orange-300 text-xs mb-3 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
                Esto crea una oferta pendiente. El dueño puede aceptar o subir la cláusula.
              </p>
            )}
            <p className="text-gray-400 text-sm mb-1">
              {isClauseTab ? 'Cláusula de' : '¿Comprar a'}{' '}
              <span className="text-white font-semibold">{confirmPlayer.name}</span>
              {!isClauseTab && '?'}
            </p>
            <div className="bg-gray-800 rounded-lg p-3 my-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">{isClauseTab ? 'Cláusula' : 'Precio'}</span>
                <span className="text-green-400 font-bold">
                  {formatMoney(confirmPlayer[priceField])}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Tu presupuesto</span>
                <span className="text-white">{formatMoney(user?.budget)}</span>
              </div>
              <div className="border-t border-gray-700 mt-2 pt-2 flex justify-between text-sm">
                <span className="text-gray-400">Saldo restante</span>
                <span className={`font-bold ${
                  (user?.budget || 0) - (confirmPlayer[priceField] || 0) < 0 ? 'text-red-400' : 'text-white'
                }`}>
                  {formatMoney((user?.budget || 0) - (confirmPlayer[priceField] || 0))}
                </span>
              </div>
            </div>
            {buyError && <p className="text-red-400 text-sm mb-3">{buyError}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleBuy}
                disabled={buying}
                className={`flex-1 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm ${
                  isClauseTab ? 'bg-orange-600 hover:bg-orange-500' : 'bg-green-500 hover:bg-green-400'
                }`}
              >
                {buying ? 'Procesando...' : isClauseTab ? 'Enviar oferta' : 'Confirmar'}
              </button>
              <button
                onClick={() => { setConfirmPlayer(null); setBuyError('') }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Swap modal */}
      {swapPlayer && (
        <SwapModal
          player={swapPlayer}
          onClose={() => setSwapPlayer(null)}
          onSuccess={() => setBuySuccess(`Oferta de intercambio enviada por ${swapPlayer.name}`)}
        />
      )}

      {/* Direct offer modal */}
      {directOfferPlayer && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-gray-700 shadow-2xl">
            <h3 className="text-white text-lg font-bold mb-1">Hacer oferta directa</h3>
            <p className="text-blue-300 text-xs mb-3 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
              El dueño puede aceptar o rechazar. Si rechaza, no perdés dinero.
            </p>
            <p className="text-gray-400 text-sm mb-1">
              Oferta por <span className="text-white font-semibold">{directOfferPlayer.name}</span>
            </p>
            <p className="text-gray-500 text-xs mb-3">
              Cláusula: <span className="text-orange-400 font-bold">{formatMoney(directOfferPlayer.release_clause)}</span>
              {' · '}Tu oferta debe ser menor
            </p>
            <input
              type="number"
              placeholder="Monto de tu oferta"
              value={directOfferAmt}
              onChange={e => { setDirectOfferAmt(e.target.value); setDirectOfferErr('') }}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 mb-1"
            />
            {directOfferAmt && parseInt(directOfferAmt) > 0 && (
              <div className="text-xs text-gray-500 mb-3">
                Saldo restante: <span className={`font-bold ${(user?.budget || 0) - parseInt(directOfferAmt) < 0 ? 'text-red-400' : 'text-white'}`}>
                  {formatMoney((user?.budget || 0) - parseInt(directOfferAmt))}
                </span>
              </div>
            )}
            {directOfferErr && <p className="text-red-400 text-xs mb-3">{directOfferErr}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleDirectOffer}
                disabled={directOfferLoading}
                className="flex-1 disabled:opacity-50 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                {directOfferLoading ? 'Enviando...' : 'Enviar oferta'}
              </button>
              <button
                onClick={() => { setDirectOfferPlayer(null); setDirectOfferAmt(''); setDirectOfferErr('') }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Own player action modal */}
      {ownAction && (
        <OwnPlayerModal
          action={ownAction}
          config={config}
          onClose={() => setOwnAction(null)}
          onSuccess={() => { fetchAll(); refreshUser(); setOwnAction(null) }}
        />
      )}
    </div>
  )
}
