import React, { useState, useEffect, useCallback } from 'react'
import { getMarketPlayers, getClausePlayers, getFreePlayers, buyPlayer, getSentOffers } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { formatMoney, ratingColor } from '../utils/format'

const STATUS_LABELS = {
  pending:  { label: 'Pendiente',  color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
  accepted: { label: 'Aceptada',   color: 'text-green-400 bg-green-400/10 border-green-400/30' },
  raised:   { label: 'Cláusula subida', color: 'text-orange-400 bg-orange-400/10 border-orange-400/30' },
  rejected: { label: 'Rechazada',  color: 'text-red-400 bg-red-400/10 border-red-400/30' },
}

function PlayerRow({ player, priceField, onBuy, isClause }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-white font-medium text-sm">{player.name}</div>
        <div className="text-gray-500 text-xs">{player.nationality} · {player.pes_team}</div>
        {player.owner_username && (
          <div className="text-gray-600 text-xs">Dueño: {player.owner_username}</div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-bold ${ratingColor(player.rating)}`}>{player.rating}</span>
        <span className="bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded">{player.position}</span>
        <div className="text-right min-w-[90px]">
          <div className="text-green-400 font-bold text-sm">{formatMoney(player[priceField])}</div>
        </div>
        <button
          onClick={() => onBuy(player)}
          className={`text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
            isClause
              ? 'bg-orange-600 hover:bg-orange-500'
              : 'bg-green-500 hover:bg-green-400'
          }`}
        >
          {isClause ? 'Activar cláusula' : 'Comprar'}
        </button>
      </div>
    </div>
  )
}

export default function Market() {
  const { user, refreshUser } = useAuth()
  const [tab, setTab] = useState('market')
  const [search, setSearch] = useState('')
  const [marketPlayers, setMarketPlayers] = useState([])
  const [clausePlayers, setClausePlayers] = useState([])
  const [freePlayers, setFreePlayers] = useState([])
  const [sentOffers, setSentOffers] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmPlayer, setConfirmPlayer] = useState(null)
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState('')
  const [buySuccess, setBuySuccess] = useState('')

  const fetchAll = useCallback(() => {
    setLoading(true)
    Promise.all([getMarketPlayers(), getClausePlayers(), getFreePlayers(), getSentOffers()])
      .then(([m, c, f, s]) => {
        setMarketPlayers(m.data)
        setClausePlayers(c.data)
        setFreePlayers(f.data)
        setSentOffers(s.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const filtered = (list) => {
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.pes_team || '').toLowerCase().includes(q) ||
      (p.nationality || '').toLowerCase().includes(q)
    )
  }

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

  const pendingCount = sentOffers.filter(o => o.status === 'pending').length

  const tabs = [
    { id: 'market',  label: 'En venta',       count: marketPlayers.length },
    { id: 'clauses', label: 'Cláusulas',       count: clausePlayers.length },
    { id: 'free',    label: 'Agentes Libres',  count: freePlayers.length },
    { id: 'offers',  label: 'Mis ofertas',     count: pendingCount, highlight: pendingCount > 0 },
  ]

  const currentList = tab === 'market' ? marketPlayers : tab === 'clauses' ? clausePlayers : freePlayers
  const priceField  = tab === 'market' ? 'listed_price' : tab === 'clauses' ? 'release_clause' : 'price'

  const displayList = filtered(currentList).map(p =>
    tab === 'free' ? { ...p, price: p.rating * p.rating * 1000 } : p
  )

  const isClauseTab = tab === 'clauses'

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
            onClick={() => { setTab(t.id); setSearch('') }}
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

      {/* Search (not on offers tab) */}
      {tab !== 'offers' && (
        <input
          type="text"
          placeholder="Buscar por nombre, equipo o nacionalidad..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 text-sm"
        />
      )}

      {/* Clause info banner */}
      {isClauseTab && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-4 py-3 text-orange-300 text-xs">
          Al activar una cláusula se envía una oferta al dueño del jugador. Él puede aceptar la transferencia o subir la cláusula pagando la diferencia de su propio presupuesto.
        </div>
      )}

      {/* Player list */}
      {tab !== 'offers' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {loading ? (
            <div className="text-gray-400 text-center py-12">Cargando...</div>
          ) : displayList.length === 0 ? (
            <div className="text-gray-500 text-center py-12">No hay jugadores disponibles</div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {displayList.map(p => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  priceField={tab === 'free' ? 'price' : priceField}
                  onBuy={setConfirmPlayer}
                  isClause={isClauseTab}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sent offers tab */}
      {tab === 'offers' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {loading ? (
            <div className="text-gray-400 text-center py-12">Cargando...</div>
          ) : sentOffers.length === 0 ? (
            <div className="text-gray-500 text-center py-12">No enviaste ninguna oferta de cláusula todavía</div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {sentOffers.map(o => {
                const statusInfo = STATUS_LABELS[o.status] || STATUS_LABELS.pending
                return (
                  <div key={o.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{o.player_name}</span>
                        <span className="text-yellow-400 text-xs font-bold">{o.player_rating}</span>
                        <span className="bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded">{o.player_position}</span>
                      </div>
                      <div className="text-gray-500 text-xs mt-0.5">
                        Dueño: {o.owner_username} · {new Date(o.created_at).toLocaleDateString('es-AR')}
                      </div>
                      {o.status === 'raised' && o.new_clause_amount && (
                        <div className="text-orange-400 text-xs mt-0.5">
                          Nueva cláusula: {formatMoney(o.new_clause_amount)}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 font-bold text-sm">{formatMoney(o.clause_amount)}</div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border mt-1 inline-block ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
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
                  {formatMoney(
                    tab === 'market' ? confirmPlayer.listed_price :
                    tab === 'clauses' ? confirmPlayer.release_clause :
                    confirmPlayer.price
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Tu presupuesto</span>
                <span className="text-white">{formatMoney(user?.budget)}</span>
              </div>
              <div className="border-t border-gray-700 mt-2 pt-2 flex justify-between text-sm">
                <span className="text-gray-400">Saldo restante</span>
                <span className={`font-bold ${
                  (user?.budget || 0) - (tab === 'market' ? confirmPlayer.listed_price : tab === 'clauses' ? confirmPlayer.release_clause : confirmPlayer.price) < 0
                    ? 'text-red-400' : 'text-white'
                }`}>
                  {formatMoney(
                    (user?.budget || 0) - (
                      tab === 'market' ? confirmPlayer.listed_price :
                      tab === 'clauses' ? confirmPlayer.release_clause :
                      confirmPlayer.price
                    )
                  )}
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
    </div>
  )
}
