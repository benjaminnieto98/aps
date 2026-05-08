import React, { useState, useEffect } from 'react'
import { getTournaments, getMatches, saveResult, getMyPlayers } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { formatMoney } from '../utils/format'

function StandingsTable({ matches, participants }) {
  const standings = {}
  for (const p of participants) {
    standings[p.id] = { ...p, pts: 0, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, gd: 0 }
  }
  for (const match of matches) {
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

  const sorted = Object.values(standings).sort((a, b) =>
    b.pts - a.pts || b.gd - a.gd || b.gf - a.gf
  )

  return (
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
            <th className="px-4 py-2 text-center">GF</th>
            <th className="px-4 py-2 text-center">GC</th>
            <th className="px-4 py-2 text-center">DG</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr key={s.id} className="border-b border-gray-800/40">
              <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
              <td className="px-4 py-2.5">
                <div className="text-white font-medium">{s.team_name || s.username}</div>
              </td>
              <td className="px-4 py-2.5 text-center text-green-400 font-bold">{s.pts}</td>
              <td className="px-4 py-2.5 text-center text-gray-400">{s.pj}</td>
              <td className="px-4 py-2.5 text-center text-gray-400">{s.g}</td>
              <td className="px-4 py-2.5 text-center text-gray-400">{s.e}</td>
              <td className="px-4 py-2.5 text-center text-gray-400">{s.p}</td>
              <td className="px-4 py-2.5 text-center text-gray-400">{s.gf}</td>
              <td className="px-4 py-2.5 text-center text-gray-400">{s.gc}</td>
              <td className="px-4 py-2.5 text-center text-gray-400">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ResultForm({ match, tournament, onSaved }) {
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [scorers, setScorers] = useState([])
  const [homePlayers, setHomePlayers] = useState([])
  const [awayPlayers, setAwayPlayers] = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (expanded && match.home_id && match.away_id) {
      // Fetch players for both teams from the tournament participants
      import('../api').then(({ getAllPlayers }) => {
        getAllPlayers().then(res => {
          const all = res.data
          setHomePlayers(all.filter(p => p.owner_id === match.home_id))
          setAwayPlayers(all.filter(p => p.owner_id === match.away_id))
        })
      })
    }
  }, [expanded, match.home_id, match.away_id])

  const addScorer = (playerId, teamId) => {
    const existing = scorers.find(s => s.player_id === playerId)
    if (existing) {
      setScorers(scorers.map(s => s.player_id === playerId ? { ...s, count: s.count + 1 } : s))
    } else {
      setScorers([...scorers, { player_id: playerId, count: 1 }])
    }
  }

  const removeScorer = (playerId) => {
    setScorers(scorers.filter(s => s.player_id !== playerId))
  }

  const handleSave = async () => {
    if (homeScore === '' || awayScore === '') return
    setLoading(true)
    try {
      await saveResult(match.id, {
        homeScore: parseInt(homeScore),
        awayScore: parseInt(awayScore),
        scorers
      })
      onSaved()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="text-xs text-green-400 hover:text-green-300 underline"
      >
        Cargar resultado
      </button>
    )
  }

  const playerName = (pid) => {
    const p = [...homePlayers, ...awayPlayers].find(x => x.id === pid)
    return p ? p.name : pid
  }

  return (
    <div className="mt-2 bg-gray-800 rounded-lg p-3 border border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <input
          type="number"
          min="0"
          placeholder="0"
          value={homeScore}
          onChange={e => setHomeScore(e.target.value)}
          className="w-14 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-center text-sm"
        />
        <span className="text-gray-500">–</span>
        <input
          type="number"
          min="0"
          placeholder="0"
          value={awayScore}
          onChange={e => setAwayScore(e.target.value)}
          className="w-14 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-center text-sm"
        />
      </div>

      {/* Scorers */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <p className="text-gray-500 text-xs mb-1">Goles {match.home_team || match.home_username}</p>
          <select
            onChange={e => { if (e.target.value) { addScorer(e.target.value, match.home_id); e.target.value = '' } }}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs"
          >
            <option value="">+ Agregar goleador</option>
            {homePlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-1">Goles {match.away_team || match.away_username}</p>
          <select
            onChange={e => { if (e.target.value) { addScorer(e.target.value, match.away_id); e.target.value = '' } }}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs"
          >
            <option value="">+ Agregar goleador</option>
            {awayPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {scorers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {scorers.map(s => (
            <div key={s.player_id} className="flex items-center gap-1 bg-gray-700 rounded-full px-2 py-0.5 text-xs">
              <span className="text-white">{playerName(s.player_id)}</span>
              <span className="text-green-400">{s.count}</span>
              <button onClick={() => removeScorer(s.player_id)} className="text-gray-400 hover:text-red-400 ml-0.5">×</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-green-500 hover:bg-green-400 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          {loading ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          onClick={() => setExpanded(false)}
          className="text-gray-400 hover:text-white text-xs px-3 py-1.5"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default function Tournaments() {
  const { user } = useAuth()
  const [tournaments, setTournaments] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [matchesLoading, setMatchesLoading] = useState(false)

  const fetchTournaments = () => {
    getTournaments()
      .then(res => {
        setTournaments(res.data)
        if (res.data.length > 0 && !selectedId) {
          const active = res.data.find(t => t.status === 'active') || res.data[0]
          setSelectedId(active.id)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchTournaments()
  }, [])

  useEffect(() => {
    if (selectedId) {
      setMatchesLoading(true)
      getMatches(selectedId)
        .then(res => setMatches(res.data))
        .catch(console.error)
        .finally(() => setMatchesLoading(false))
    }
  }, [selectedId])

  const selected = tournaments.find(t => t.id === selectedId)

  // Group matches by round_name
  const groupedMatches = matches.reduce((acc, m) => {
    if (!acc[m.round_name]) acc[m.round_name] = []
    acc[m.round_name].push(m)
    return acc
  }, {})

  const refreshMatches = () => {
    if (selectedId) {
      getMatches(selectedId).then(res => setMatches(res.data)).catch(console.error)
    }
  }

  if (loading) return <div className="text-gray-400 text-center py-20">Cargando torneos...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-white text-2xl font-bold">Torneos</h1>
        <p className="text-gray-400 text-sm mt-1">{tournaments.length} torneos registrados</p>
      </div>

      {tournaments.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <div className="text-gray-500">No hay torneos creados aún</div>
        </div>
      ) : (
        <>
          {/* Tournament selector */}
          <select
            value={selectedId || ''}
            onChange={e => setSelectedId(Number(e.target.value))}
            className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-green-500 w-full max-w-md"
          >
            {tournaments.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.status === 'active' ? 'Activo' : 'Finalizado'})
              </option>
            ))}
          </select>

          {selected && (
            <div className="space-y-6">
              {/* Prizes */}
              {selected.prizes?.some(p => p > 0) && (
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <h3 className="text-white font-semibold text-sm mb-3">Premios</h3>
                  <div className="flex gap-4 flex-wrap">
                    {selected.prizes.map((p, i) => p > 0 && (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-lg">{['🥇', '🥈', '🥉'][i]}</span>
                        <span className="text-green-400 font-bold text-sm">{formatMoney(p)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Standings */}
              {selected.participants?.length > 0 && matches.length > 0 && (
                <div className="bg-gray-900 rounded-xl border border-gray-800">
                  <div className="px-4 py-3 border-b border-gray-800">
                    <h3 className="text-white font-semibold text-sm">Tabla de posiciones</h3>
                  </div>
                  <StandingsTable matches={matches} participants={selected.participants} />
                </div>
              )}

              {/* Matches */}
              {matchesLoading ? (
                <div className="text-gray-400 text-center py-8">Cargando partidos...</div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedMatches).map(([round, roundMatches]) => (
                    <div key={round} className="bg-gray-900 rounded-xl border border-gray-800">
                      <div className="px-4 py-3 border-b border-gray-800">
                        <h3 className="text-white font-semibold text-sm">{round}</h3>
                      </div>
                      <div className="divide-y divide-gray-800/50">
                        {roundMatches.map(match => (
                          <div key={match.id} className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="text-white text-sm font-medium flex-1 text-right">
                                {match.home_team || match.home_username}
                              </span>
                              <div className="text-center min-w-[60px]">
                                {match.home_score !== null ? (
                                  <span className="text-white font-bold">
                                    {match.home_score} – {match.away_score}
                                  </span>
                                ) : (
                                  <span className="text-gray-600">vs</span>
                                )}
                              </div>
                              <span className="text-white text-sm font-medium flex-1">
                                {match.away_team || match.away_username}
                              </span>
                            </div>

                            {/* Scorers display */}
                            {match.scorers?.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {match.scorers.map(s => (
                                  <span key={s.player_id} className="text-gray-500 text-xs">
                                    {s.player_name} ({s.count})
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Admin result form */}
                            {user?.is_admin && selected.status === 'active' && match.home_score === null && (
                              <ResultForm
                                match={match}
                                tournament={selected}
                                onSaved={refreshMatches}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
