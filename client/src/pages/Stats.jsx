import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getScorers, getManagers, getRecords, getH2H } from '../api'
import { formatMoney, ratingColor } from '../utils/format'

function RecordCard({ label, children, accent = 'green' }) {
  const accents = {
    green:  'border-green-500/30 bg-green-500/5',
    yellow: 'border-yellow-500/30 bg-yellow-500/5',
    blue:   'border-blue-500/30 bg-blue-500/5',
    orange: 'border-orange-500/30 bg-orange-500/5',
    purple: 'border-purple-500/30 bg-purple-500/5',
  }
  return (
    <div className={`rounded-xl border p-4 ${accents[accent] || accents.green}`}>
      <div className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-2">{label}</div>
      {children}
    </div>
  )
}

function MiniRanking({ items, valueKey, label, accent = 'green' }) {
  if (!items || items.length === 0) return <div className="text-gray-600 text-sm italic">Sin datos</div>
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={item.username} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm w-5">{medals[i] || <span className="text-gray-500 text-xs">{i + 1}</span>}</span>
            <span className="text-white text-sm">{item.username}</span>
          </div>
          <span className="text-green-400 font-bold text-sm">{formatMoney(item[valueKey])}</span>
        </div>
      ))}
    </div>
  )
}

function H2HTab({ managers }) {
  const [sel1, setSel1] = useState('')
  const [sel2, setSel2] = useState('')
  const [h2h, setH2H]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const load = async () => {
    if (!sel1 || !sel2 || sel1 === sel2) return setError('Seleccioná dos usuarios distintos')
    setLoading(true); setError(''); setH2H(null)
    try {
      const res = await getH2H(sel1, sel2)
      setH2H(res.data)
    } catch (err) { setError(err.response?.data?.error || 'Error') }
    finally { setLoading(false) }
  }

  const u1 = h2h?.user1
  const u2 = h2h?.user2

  const resultColor = (w, l) => {
    if (w > l) return 'text-green-400'
    if (w < l) return 'text-red-400'
    return 'text-gray-300'
  }

  return (
    <div className="space-y-4">
      {/* Selector */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="text-gray-500 text-xs block mb-1">Equipo 1</label>
            <select
              value={sel1}
              onChange={e => { setSel1(e.target.value); setH2H(null) }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
            >
              <option value="">— Elegir —</option>
              {managers.map(m => (
                <option key={m.id} value={m.id}>{m.team_name || m.username}</option>
              ))}
            </select>
          </div>
          <div className="text-gray-500 font-bold text-lg pb-2">vs</div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-gray-500 text-xs block mb-1">Equipo 2</label>
            <select
              value={sel2}
              onChange={e => { setSel2(e.target.value); setH2H(null) }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
            >
              <option value="">— Elegir —</option>
              {managers.filter(m => String(m.id) !== String(sel1)).map(m => (
                <option key={m.id} value={m.id}>{m.team_name || m.username}</option>
              ))}
            </select>
          </div>
          <button
            onClick={load}
            disabled={loading || !sel1 || !sel2}
            className="bg-green-500 hover:bg-green-400 disabled:opacity-40 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {loading ? 'Cargando...' : 'Ver historial'}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>

      {/* Results */}
      {h2h && (
        <>
          {/* Head-to-head summary */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="grid grid-cols-3 gap-2 items-center text-center">
              {/* Team 1 */}
              <div>
                <div className="text-white font-bold text-base truncate">{u1.team_name || u1.username}</div>
                <div className="text-gray-500 text-xs">{u1.username}</div>
                <div className={`text-4xl font-black mt-2 ${resultColor(u1.wins, u1.losses)}`}>{u1.wins}</div>
                <div className="text-gray-500 text-xs">victorias</div>
              </div>

              {/* Middle stats */}
              <div className="space-y-2">
                <div className="text-gray-400 text-xs font-medium uppercase tracking-wide">Empates</div>
                <div className="text-white text-3xl font-bold">{u1.draws}</div>
                <div className="border-t border-gray-700 pt-2 mt-2 grid grid-cols-2 gap-1 text-xs text-gray-500">
                  <div>PJ</div><div>{h2h.matches.length}</div>
                  <div className="text-left truncate">{u1.team_name || u1.username}</div>
                  <div className="font-semibold text-white">{u1.gf} goles</div>
                  <div className="text-left truncate">{u2.team_name || u2.username}</div>
                  <div className="font-semibold text-white">{u2.gf} goles</div>
                </div>
              </div>

              {/* Team 2 */}
              <div>
                <div className="text-white font-bold text-base truncate">{u2.team_name || u2.username}</div>
                <div className="text-gray-500 text-xs">{u2.username}</div>
                <div className={`text-4xl font-black mt-2 ${resultColor(u2.wins, u2.losses)}`}>{u2.wins}</div>
                <div className="text-gray-500 text-xs">victorias</div>
              </div>
            </div>
          </div>

          {/* Match list */}
          {h2h.matches.length === 0 ? (
            <div className="text-gray-500 text-center py-8 text-sm">No hay partidos jugados entre estos equipos</div>
          ) : (
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800">
                <h3 className="text-white font-semibold text-sm">Historial de partidos</h3>
              </div>
              <div className="divide-y divide-gray-800/50">
                {h2h.matches.map(m => {
                  const u1IsHome = m.home_id === u1.id
                  const u1Score  = u1IsHome ? m.home_score : m.away_score
                  const u2Score  = u1IsHome ? m.away_score : m.home_score
                  const winner   = u1Score > u2Score ? 'u1' : u1Score < u2Score ? 'u2' : 'draw'
                  return (
                    <div key={m.id} className="flex items-center px-4 py-3 gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-500 text-xs">{m.tournament_name}{m.round_name ? ` · ${m.round_name}` : ''}</div>
                      </div>
                      <div className={`text-sm font-semibold truncate ${winner === 'u1' ? 'text-green-400' : winner === 'draw' ? 'text-gray-300' : 'text-gray-400'}`}>
                        {u1.team_name || u1.username}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-lg font-black w-6 text-center ${winner === 'u1' ? 'text-green-400' : 'text-gray-300'}`}>{u1Score}</span>
                        <span className="text-gray-600 text-sm">-</span>
                        <span className={`text-lg font-black w-6 text-center ${winner === 'u2' ? 'text-green-400' : 'text-gray-300'}`}>{u2Score}</span>
                      </div>
                      <div className={`text-sm font-semibold truncate text-right ${winner === 'u2' ? 'text-green-400' : winner === 'draw' ? 'text-gray-300' : 'text-gray-400'}`}>
                        {u2.team_name || u2.username}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function Stats() {
  const navigate = useNavigate()
  const [scorers, setScorers] = useState([])
  const [managers, setManagers] = useState([])
  const [records, setRecords] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('scorers')

  useEffect(() => {
    Promise.all([getScorers(), getManagers(), getRecords()])
      .then(([sRes, mRes, rRes]) => {
        setScorers(sRes.data)
        setManagers(mRes.data)
        setRecords(rRes.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-gray-400 text-center py-20">Cargando estadísticas...</div>

  const tabs = [
    { id: 'scorers',  label: 'Goleadores' },
    { id: 'managers', label: 'Managers' },
    { id: 'records',  label: 'Tabla de Honor' },
    { id: 'h2h',      label: 'Face a Face' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-white text-2xl font-bold">Estadísticas</h1>
        <p className="text-gray-400 text-sm mt-1">Rankings globales de la liga</p>
      </div>

      <div className="flex bg-gray-900 rounded-xl p-1 border border-gray-800 w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Scorers */}
      {tab === 'scorers' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-white font-semibold text-sm">Tabla de Goleadores</h2>
          </div>
          {scorers.length === 0 ? (
            <div className="text-gray-500 text-center py-12">No hay goles registrados aún</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-gray-800">
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Jugador</th>
                    <th className="px-4 py-2 text-left">Equipo</th>
                    <th className="px-4 py-2 text-left">Posición</th>
                    <th className="px-4 py-2 text-center">Goles</th>
                  </tr>
                </thead>
                <tbody>
                  {scorers.map((s, i) => (
                    <tr
                      key={s.player_id}
                      className="border-b border-gray-800/40 hover:bg-gray-800/30 cursor-pointer"
                      onClick={() => navigate(`/player/${s.player_id}`)}
                    >
                      <td className="px-4 py-3">
                        {i < 3 ? <span className="text-lg">{['🥇','🥈','🥉'][i]}</span> : <span className="text-gray-500">{i+1}</span>}
                      </td>
                      <td className="px-4 py-3 text-white font-medium hover:text-green-400 transition-colors">{s.player_name}</td>
                      <td className="px-4 py-3 text-gray-400">{s.owner_team || s.owner_username || 'Agente libre'}</td>
                      <td className="px-4 py-3">
                        <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded">{s.position}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-green-400 font-bold text-lg">{s.goals}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Managers */}
      {tab === 'managers' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-white font-semibold text-sm">Ranking de Managers — 🏆 Liga · 🥇 Copa · ⭐ Supercopa</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Usuario</th>
                  <th className="px-4 py-2 text-left">Equipo</th>
                  <th className="px-4 py-2 text-center" title="Ligas ganadas">🏆</th>
                  <th className="px-4 py-2 text-center" title="Copas ganadas">🥇</th>
                  <th className="px-4 py-2 text-center" title="Supercopas ganadas">⭐</th>
                  <th className="px-4 py-2 text-center">G</th>
                  <th className="px-4 py-2 text-center">E</th>
                  <th className="px-4 py-2 text-center">P</th>
                  <th className="px-4 py-2 text-right">Presupuesto</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((m, i) => (
                  <tr key={m.id} className="border-b border-gray-800/40 hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      {i < 3 ? <span className="text-lg">{['🥇','🥈','🥉'][i]}</span> : <span className="text-gray-500">{i+1}</span>}
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{m.username}</td>
                    <td className="px-4 py-3 text-gray-400">{m.team_name || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {(m.leagues_won ?? 0) > 0
                        ? <span className="text-yellow-400 font-bold">{m.leagues_won}</span>
                        : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(m.cups_won ?? 0) > 0
                        ? <span className="text-orange-400 font-bold">{m.cups_won}</span>
                        : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(m.supercopas_won ?? 0) > 0
                        ? <span className="text-purple-400 font-bold">{m.supercopas_won}</span>
                        : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-green-400 font-medium">{m.wins ?? 0}</td>
                    <td className="px-4 py-3 text-center text-gray-400">{m.draws ?? 0}</td>
                    <td className="px-4 py-3 text-center text-red-400">{m.losses ?? 0}</td>
                    <td className="px-4 py-3 text-right text-green-400 font-bold">{formatMoney(m.budget)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Face a Face */}
      {tab === 'h2h' && <H2HTab managers={managers} />}

      {/* Hall of Fame */}
      {tab === 'records' && (
        <div className="space-y-4">
          {/* Biggest transfer */}
          {records?.biggestTransfer ? (
            <RecordCard label="Transferencia más cara" accent="yellow">
              <div className="flex items-center justify-between">
                <div>
                  <div
                    className="text-white font-bold text-lg cursor-pointer hover:text-green-400 transition-colors"
                    onClick={() => records.biggestTransfer.player_id && navigate(`/player/${records.biggestTransfer.player_id}`)}
                  >
                    {records.biggestTransfer.player_name}
                  </div>
                  <div className="text-gray-400 text-sm mt-0.5">
                    <span className="bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded mr-2">{records.biggestTransfer.player_position}</span>
                    {records.biggestTransfer.from_username
                      ? <>{records.biggestTransfer.from_username} → {records.biggestTransfer.to_username}</>
                      : <>Agente libre → {records.biggestTransfer.to_username}</>
                    }
                  </div>
                </div>
                <div className="text-yellow-400 font-bold text-xl">{formatMoney(records.biggestTransfer.price)}</div>
              </div>
            </RecordCard>
          ) : (
            <RecordCard label="Transferencia más cara" accent="yellow">
              <div className="text-gray-600 italic text-sm">Sin traspasos registrados</div>
            </RecordCard>
          )}

          {/* Most transferred player */}
          {records?.mostTransferred && (
            <RecordCard label="Jugador más traspasado" accent="blue">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-bold">{records.mostTransferred.player_name}</div>
                  <div className="text-gray-400 text-sm">
                    <span className="bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded mr-1">
                      {records.mostTransferred.player_position}
                    </span>
                    OVR {records.mostTransferred.player_rating}
                  </div>
                </div>
                <div>
                  <span className="text-blue-400 font-bold text-2xl">{records.mostTransferred.times}</span>
                  <span className="text-gray-500 text-xs ml-1">veces</span>
                </div>
              </div>
            </RecordCard>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RecordCard label="Top gastadores" accent="orange">
              <MiniRanking items={records?.topSpenders} valueKey="total" />
            </RecordCard>
            <RecordCard label="Top recaudadores" accent="green">
              <MiniRanking items={records?.topEarners} valueKey="total" />
            </RecordCard>
          </div>

          <RecordCard label="Managers más activos en el mercado" accent="purple">
            {records?.mostActive?.length > 0 ? (
              <div className="space-y-2">
                {records.mostActive.map((m, i) => (
                  <div key={m.username} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{['🥇','🥈','🥉'][i] || <span className="text-gray-500 text-xs">{i+1}</span>}</span>
                      <span className="text-white text-sm">{m.username}</span>
                    </div>
                    <span className="text-purple-400 font-bold text-sm">{m.ops} operaciones</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-600 italic text-sm">Sin actividad registrada</div>
            )}
          </RecordCard>
        </div>
      )}
    </div>
  )
}
