import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getMyPlayers, getTournaments, getMatches, getScorers } from '../api'
import { formatMoney } from '../utils/format'

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <div className="text-gray-400 text-xs mb-1">{label}</div>
      <div className="text-white text-2xl font-bold">{value}</div>
      {sub && <div className="text-gray-500 text-xs mt-1">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [players, setPlayers] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [standings, setStandings] = useState([])
  const [scorers, setScorers] = useState([])
  const [activeTournament, setActiveTournament] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getMyPlayers(), getTournaments(), getScorers()])
      .then(([pRes, tRes, sRes]) => {
        setPlayers(pRes.data)
        setScorers(sRes.data.slice(0, 5))
        const active = tRes.data.find(t => t.status === 'active') || tRes.data[0]
        setTournaments(tRes.data)
        if (active) {
          setActiveTournament(active)
          return getMatches(active.id).then(mRes => {
            const participantIds = active.participant_ids || []
            const standings = {}
            for (const pid of participantIds) {
              const participant = active.participants?.find(p => p.id === pid)
              standings[pid] = {
                id: pid,
                name: participant?.team_name || participant?.username || 'Desconocido',
                pts: 0, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, gd: 0
              }
            }
            for (const match of mRes.data) {
              if (match.home_score === null || match.away_score === null) continue
              const home = standings[match.home_id]
              const away = standings[match.away_id]
              if (!home || !away) continue
              home.pj++; away.pj++
              home.gf += match.home_score; home.gc += match.away_score
              away.gf += match.away_score; away.gc += match.home_score
              if (match.home_score > match.away_score) { home.pts += 3; home.g++; away.p++ }
              else if (match.home_score < match.away_score) { away.pts += 3; away.g++; home.p++ }
              else { home.pts++; home.e++; away.pts++; away.e++ }
            }
            for (const s of Object.values(standings)) s.gd = s.gf - s.gc
            setStandings(Object.values(standings).sort((a, b) =>
              b.pts - a.pts || b.gd - a.gd || b.gf - a.gf
            ))
          })
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-gray-400 text-center py-20">Cargando...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-white text-2xl font-bold">Inicio</h1>
        <p className="text-gray-400 text-sm mt-1">Bienvenido, {user?.username}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Presupuesto" value={formatMoney(user?.budget)} />
        <StatCard label="Plantel" value={`${players.length}`} sub={`máximo 22 jugadores`} />
        <StatCard label="Equipo" value={user?.team_name || '—'} sub="equipo asignado" />
        <StatCard
          label="Torneos Activos"
          value={tournaments.filter(t => t.status === 'active').length}
          sub={`${tournaments.length} total`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Standings */}
        {activeTournament && standings.length > 0 && (
          <div className="bg-gray-900 rounded-xl border border-gray-800">
            <div className="px-4 py-3 border-b border-gray-800">
              <h2 className="text-white font-semibold text-sm">
                Tabla — {activeTournament.name}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-gray-800">
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Equipo</th>
                    <th className="px-4 py-2 text-center">PTS</th>
                    <th className="px-4 py-2 text-center">PJ</th>
                    <th className="px-4 py-2 text-center">G</th>
                    <th className="px-4 py-2 text-center">E</th>
                    <th className="px-4 py-2 text-center">P</th>
                    <th className="px-4 py-2 text-center">DG</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => (
                    <tr
                      key={s.id}
                      className={`border-b border-gray-800/50 ${s.id === user?.id ? 'bg-green-500/5' : ''}`}
                    >
                      <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2.5 text-white font-medium truncate max-w-[120px]">{s.name}</td>
                      <td className="px-4 py-2.5 text-center text-green-400 font-bold">{s.pts}</td>
                      <td className="px-4 py-2.5 text-center text-gray-400">{s.pj}</td>
                      <td className="px-4 py-2.5 text-center text-gray-400">{s.g}</td>
                      <td className="px-4 py-2.5 text-center text-gray-400">{s.e}</td>
                      <td className="px-4 py-2.5 text-center text-gray-400">{s.p}</td>
                      <td className="px-4 py-2.5 text-center text-gray-400">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top Scorers */}
        <div className="bg-gray-900 rounded-xl border border-gray-800">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-white font-semibold text-sm">Top Goleadores</h2>
          </div>
          {scorers.length === 0 ? (
            <div className="text-gray-500 text-sm text-center py-8">
              Aún no hay goles registrados
            </div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {scorers.map((s, i) => (
                <div key={s.player_id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-gray-500 text-sm w-5 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{s.player_name}</div>
                    <div className="text-gray-500 text-xs">{s.owner_team || s.owner_username || 'Agente libre'}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-green-400 font-bold">{s.goals}</span>
                    <span className="text-gray-500 text-xs">goles</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
