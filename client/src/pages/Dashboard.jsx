import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getMyPlayers, getTournaments, getMatches, getScorers, getPublicConfig, getMilestones, getFeed } from '../api'
import { formatMoney } from '../utils/format'

// ─── Milestone messages ───────────────────────────────────────────────────────
const MESSAGES = {
  wins: {
    100: [
      t => `¡${t} llegó a las 100 victorias! La máquina empieza a rodar 💪`,
      t => `¡100W para ${t}! Un comienzo prometedor, hay que reconocerlo 🌟`,
      t => `¡${t} sumó su victoria número 100! Esto recién empieza 🔥`,
    ],
    150: [
      t => `¡${t} alcanzó las 150 victorias! ¿Alguien puede pararlos? 💥`,
      t => `¡150W para ${t}! Esto ya es una institución de la liga 👊`,
      t => `¡${t} llegó a 150 victorias! La bestia está desatada 🦁`,
    ],
    200: [
      t => `¡${t} llegó a las 200 victorias! Una leyenda viviente 👑`,
      t => `¡200W para ${t}! Reverencia obligatoria 🫡`,
      t => `¡${t} alcanzó las 200 victorias! Nada ni nadie los detiene 🚀`,
    ],
    250: [
      t => `¡${t} sumó 250 victorias! Patrimonio de la liga 🌍`,
      t => `¡250W para ${t}! ¿Esto es un videojuego o una dictadura deportiva? 😤`,
      t => `¡${t} con 250 victorias! Los rivales ya juegan por el segundo puesto 🥈`,
    ],
    300: [
      t => `¡${t} llegó a 300 victorias! Los libros de historia los esperan 📖`,
      t => `¡300W para ${t}! ¿Alguien los vio perder alguna vez? 🤔`,
      t => `¡${t} con 300 victorias! Esto ya trasciende el fútbol 🛐`,
    ],
  },
  losses: {
    100: [
      t => `${t} ya colecciona 100 derrotas. Mala racha, che... 😬`,
      t => `100 derrotas para ${t}. Tranqui, algún día va a salir ☕`,
      t => `${t} suma su derrota 100. La esperanza es lo último que se pierde 🕯️`,
    ],
    150: [
      t => `${t} lleva 150 derrotas. Esto ya no es mala suerte, es talento 💀`,
      t => `¡150 derrotas para ${t}! Claramente no aprenden de los errores 🙈`,
      t => `${t} con 150 derrotas. ¿Ya consideraron cambiar de deporte? 🎯`,
    ],
    200: [
      t => `${t} alcanzó las 200 derrotas. Hay que reconocerles la constancia 🥲`,
      t => `200 derrotas para ${t}. Los rivales ya los piden de calentamiento 😭`,
      t => `${t} con 200 derrotas. Técnicamente son los mejores perdedores de la liga 🏅`,
    ],
    250: [
      t => `${t} lleva 250 derrotas. ¿El estadio ya tiene descuento para los hinchas? 💸`,
      t => `¡250 derrotas para ${t}! El entrenador podría ser una almohada y daría lo mismo 🛌`,
      t => `${t} suma derrota 250. Oficialmente el mejor equipo en perder de la historia 🎖️`,
    ],
    300: [
      t => `${t} llegó a las 300 derrotas. Necesitan psicólogo, entrenador y mucha fe ⛪`,
      t => `¡300 derrotas para ${t}! Los rivales se pelean por jugar contra ellos 🎉`,
      t => `${t} con 300 derrotas. La FIFA está estudiando este caso como fenómeno global 📊`,
    ],
  },
  goals: {
    100: [
      p => `¡${p} llegó a los 100 goles! Un goleador de raza 🎯`,
      p => `${p} marcó su gol número 100. Los arqueros lo conocen de memoria 😏`,
      p => `¡100 goles para ${p}! La red ya le tiene miedo 🕸️`,
    ],
    150: [
      p => `¡${p} alcanzó los 150 goles! Más records que cumpleaños 🎂`,
      p => `${p} con 150 goles. Los porteros piden vacaciones cuando lo ven llegar ✈️`,
      p => `¡150 pepas para ${p}! Alguien avise al Récord Guinness 📞`,
    ],
    200: [
      p => `¡${p} marcó 200 goles! Leyenda pura 🌟`,
      p => `${p} sumó su gol 200. La pelota ya le obedece como mascota 🐾`,
      p => `¡200 goles para ${p}! Oficialmente ya es una institución 👑`,
    ],
    250: [
      p => `${p} con 250 goles. ¿Es un jugador o un algoritmo? 🤖`,
      p => `¡250 goles para ${p}! Los arcos deberían estar asegurados contra él 📋`,
      p => `¡${p} llegó a 250 goles! La pelota va donde él le dice 🧲`,
    ],
    300: [
      p => `¡${p} llegó a los 300 goles! Esto ya es ciencia ficción ⚗️`,
      p => `${p} con 300 goles. Pelé acaba de pedir su camiseta 🙏`,
      p => `¡300 goles para ${p}! La liga debería renombrar el trofeo con su nombre 🏆`,
    ],
  },
}

// Stable pick: same name → same message across renders
function pickMsg(pool, name) {
  if (!pool || !pool.length) return name
  const hash = [...(name || '')].reduce((a, c) => a + c.charCodeAt(0), 0)
  return pool[hash % pool.length](name)
}

// ─── Milestone Carousel ───────────────────────────────────────────────────────
function MilestoneCarousel({ milestones }) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (milestones.length <= 1) return
    const t = setInterval(() => setIdx(i => (i + 1) % milestones.length), 4500)
    return () => clearInterval(t)
  }, [milestones.length])

  if (!milestones.length) return null

  const m = milestones[idx]
  const name = m.type === 'goals' ? m.player_name : m.team_name
  const message = pickMsg(MESSAGES[m.type]?.[m.milestone], name)
  const icon = m.type === 'wins' ? '🏆' : m.type === 'losses' ? '💀' : '⚽'
  const sub = m.type === 'goals'
    ? `${m.position} · Dueño: ${m.owner_username || 'Agente libre'} · ${m.value} goles en total`
    : `Manager: ${m.username} · ${m.wins}G ${m.draws}E ${m.losses}P`

  const prev = () => setIdx(i => (i - 1 + milestones.length) % milestones.length)
  const next = () => setIdx(i => (i + 1) % milestones.length)

  return (
    <div className="relative rounded-2xl border-2 border-yellow-500/50 bg-gray-900 shadow-[0_0_32px_rgba(234,179,8,0.10)] overflow-hidden">
      {/* shimmer line */}
      <div className="h-px bg-gradient-to-r from-transparent via-yellow-400/60 to-transparent" />

      <div className="px-5 pt-4 pb-3">
        {/* label row */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-yellow-400 text-xs font-bold uppercase tracking-widest">⭐ Hito histórico</span>
          <div className="flex-1 h-px bg-yellow-500/15" />
          {milestones.length > 1 && (
            <span className="text-gray-600 text-xs tabular-nums">{idx + 1}/{milestones.length}</span>
          )}
        </div>

        {/* content */}
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none mt-0.5 flex-shrink-0">{icon}</span>
          <div className="min-w-0">
            <p className="text-white font-semibold text-[15px] leading-snug">{message}</p>
            <p className="text-gray-400 text-xs mt-1.5">{sub}</p>
          </div>
          {/* arrow buttons right-aligned */}
          {milestones.length > 1 && (
            <div className="flex gap-1 ml-auto pl-2 flex-shrink-0 self-center">
              <button onClick={prev} className="text-gray-500 hover:text-yellow-400 transition-colors text-xl leading-none px-1">‹</button>
              <button onClick={next} className="text-gray-500 hover:text-yellow-400 transition-colors text-xl leading-none px-1">›</button>
            </div>
          )}
        </div>
      </div>

      {/* dots */}
      {milestones.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-3">
          {milestones.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`rounded-full transition-all duration-300 ${
                i === idx ? 'w-4 h-1.5 bg-yellow-400' : 'w-1.5 h-1.5 bg-gray-700 hover:bg-gray-500'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Activity Feed ────────────────────────────────────────────────────────────
function fmtMoney(n) {
  if (n == null) return null
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

function timeAgo(ts) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 2)  return 'hace un momento'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ayer'
  return `hace ${d} días`
}

const FEED_ICONS = { buy: '💰', release: '🔴', swap: '🔄', tournament: '🏆', clause_raised: '📈' }

function FeedItem({ item }) {
  let main = '', sub = ''

  if (item.type === 'buy') {
    const from = item.from_username ? `de ${item.from_username}` : 'agente libre'
    main = `${item.to_username} fichó a ${item.player_name} (${item.player_position}, ${item.player_rating}⭐)`
    sub  = `${from}${item.price ? ` · ${fmtMoney(item.price)}` : ''}`
  } else if (item.type === 'release') {
    main = `${item.from_username} liberó a ${item.player_name} (${item.player_position}, ${item.player_rating}⭐)`
    sub  = item.price ? `Cobró ${fmtMoney(item.price)}` : ''
  } else if (item.type === 'swap') {
    main = `${item.proposer_username} ⇌ ${item.receiver_username}`
    sub  = `${item.offered_player_name} (${item.offered_player_position}, ${item.offered_player_rating}⭐) por ${item.requested_player_name} (${item.requested_player_position}, ${item.requested_player_rating}⭐)`
    if (item.cash_difference > 0)  sub += ` · +${fmtMoney(item.cash_difference)} del ${item.proposer_username}`
    if (item.cash_difference < 0)  sub += ` · +${fmtMoney(Math.abs(item.cash_difference))} del ${item.receiver_username}`
  } else if (item.type === 'tournament') {
    main = `${item.tournament_name} — campeón: ${item.champion}`
    sub  = item.top_scorer ? `Goleador: ${item.top_scorer} (${item.top_goals} goles)` : ''
  } else if (item.type === 'clause_raised') {
    main = `${item.owner_username} subió la cláusula de ${item.player_name} (${item.player_position}, ${item.player_rating}⭐)`
    sub  = `${fmtMoney(item.clause_amount)} → ${fmtMoney(item.new_clause_amount)} · comprador: ${item.buyer_username}`
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="text-base mt-0.5 flex-shrink-0">{FEED_ICONS[item.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm leading-snug">{main}</p>
        {sub && <p className="text-gray-500 text-xs mt-0.5 leading-snug">{sub}</p>}
      </div>
      <span className="text-gray-600 text-xs flex-shrink-0 mt-0.5">{timeAgo(item.ts)}</span>
    </div>
  )
}

function ActivityFeed({ feed }) {
  if (!feed.length) return null
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-white font-semibold text-sm">Actividad reciente</h2>
        <p className="text-gray-500 text-xs mt-0.5">Últimos 5 días</p>
      </div>
      <div className="divide-y divide-gray-800/50">
        {feed.map((item, i) => <FeedItem key={i} item={item} />)}
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
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
  const [config, setConfig] = useState(null)
  const [milestones, setMilestones] = useState([])
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPublicConfig().then(r => setConfig(r.data)).catch(console.error)
    getMilestones().then(r => setMilestones(r.data)).catch(console.error)
    getFeed().then(r => setFeed(r.data)).catch(console.error)
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

      {/* Milestone carousel */}
      <MilestoneCarousel milestones={milestones} />

      {/* Activity feed */}
      <ActivityFeed feed={feed} />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Presupuesto" value={formatMoney(user?.budget)} />
        <StatCard label="Plantel" value={`${players.length}`} sub={`máximo ${config?.maxRoster ?? 22} jugadores`} />
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
