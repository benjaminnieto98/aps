import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getScorers, getManagers, getRecords } from '../api'
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
            <h2 className="text-white font-semibold text-sm">Ranking de Managers — Por Torneos Ganados</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Usuario</th>
                  <th className="px-4 py-2 text-left">Equipo</th>
                  <th className="px-4 py-2 text-center" title="Torneos ganados">🏆</th>
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
                      {m.tournaments_won > 0
                        ? <span className="text-yellow-400 font-bold">{m.tournaments_won}</span>
                        : <span className="text-gray-600">—</span>}
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
