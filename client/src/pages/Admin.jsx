import React, { useState, useEffect } from 'react'
import {
  getUsers, assignTeam, resetTeam, deleteUser, setBudget, toggleAdmin,
  getAllPlayers, editPlayer, addPlayer,
  getTournaments, createTournament, finishTournament,
  getConfig, updateConfig
} from '../api'
import { formatMoney } from '../utils/format'

// ─── USERS TAB ───────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editBudget, setEditBudget] = useState({})
  const [editTeam, setEditTeam] = useState({})
  const [msg, setMsg] = useState('')

  const fetchUsers = () => {
    getUsers().then(r => setUsers(r.data)).catch(console.error).finally(() => setLoading(false))
  }
  useEffect(() => { fetchUsers() }, [])

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  const handleAssignTeam = async (id) => {
    const team = editTeam[id]
    if (!team) return
    try {
      const res = await assignTeam(id, team)
      flash(`Equipo asignado (${res.data.playersAssigned} jugadores)`)
      fetchUsers()
      setEditTeam(prev => ({ ...prev, [id]: '' }))
    } catch (err) { flash(err.response?.data?.error || 'Error') }
  }

  const handleSetBudget = async (id) => {
    const amount = editBudget[id]
    if (amount === undefined || amount === '') return
    try {
      await setBudget(id, parseInt(amount))
      flash('Presupuesto actualizado')
      fetchUsers()
      setEditBudget(prev => ({ ...prev, [id]: '' }))
    } catch (err) { flash(err.response?.data?.error || 'Error') }
  }

  const handleToggleAdmin = async (id) => {
    try {
      await toggleAdmin(id)
      fetchUsers()
    } catch (err) { flash(err.response?.data?.error || 'Error') }
  }

  const handleResetTeam = async (id, username) => {
    if (!window.confirm(`¿Resetear equipo de ${username}? Todos sus jugadores quedarán libres.`)) return
    try {
      await resetTeam(id)
      flash(`Equipo de ${username} reseteado`)
      fetchUsers()
    } catch (err) { flash(err.response?.data?.error || 'Error') }
  }

  const handleDeleteUser = async (id, username) => {
    if (!window.confirm(`¿Eliminar al usuario ${username}? Esta acción no se puede deshacer.`)) return
    try {
      await deleteUser(id)
      flash(`Usuario ${username} eliminado`)
      fetchUsers()
    } catch (err) { flash(err.response?.data?.error || 'Error') }
  }

  if (loading) return <div className="text-gray-400 text-center py-12">Cargando...</div>

  return (
    <div className="space-y-4">
      {msg && <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 text-green-400 text-sm">{msg}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs border-b border-gray-800">
              <th className="px-3 py-2 text-left">Usuario</th>
              <th className="px-3 py-2 text-left">Equipo</th>
              <th className="px-3 py-2 text-right">Presupuesto</th>
              <th className="px-3 py-2 text-center">Jugadores</th>
              <th className="px-3 py-2 text-center">Admin</th>
              <th className="px-3 py-2 text-left">Asignar Equipo</th>
              <th className="px-3 py-2 text-left">Editar Presupuesto</th>
              <th className="px-3 py-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-gray-800/40">
                <td className="px-3 py-2.5 text-white font-medium">{u.username}</td>
                <td className="px-3 py-2.5 text-gray-400">{u.team_name || '—'}</td>
                <td className="px-3 py-2.5 text-right text-green-400 font-bold">{formatMoney(u.budget)}</td>
                <td className="px-3 py-2.5 text-center text-gray-400">{u.player_count}</td>
                <td className="px-3 py-2.5 text-center">
                  <button
                    onClick={() => handleToggleAdmin(u.id)}
                    className={`text-xs px-2 py-1 rounded-full transition-colors ${
                      u.is_admin
                        ? 'bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400'
                        : 'bg-gray-700 text-gray-400 hover:bg-green-500/20 hover:text-green-400'
                    }`}
                  >
                    {u.is_admin ? 'Sí' : 'No'}
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="Nombre equipo"
                      value={editTeam[u.id] || ''}
                      onChange={e => setEditTeam(prev => ({ ...prev, [u.id]: e.target.value }))}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs w-36 focus:outline-none focus:border-green-500"
                      onKeyDown={e => e.key === 'Enter' && handleAssignTeam(u.id)}
                    />
                    <button
                      onClick={() => handleAssignTeam(u.id)}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2 py-1 rounded transition-colors"
                    >
                      OK
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <input
                      type="number"
                      placeholder="Monto"
                      value={editBudget[u.id] || ''}
                      onChange={e => setEditBudget(prev => ({ ...prev, [u.id]: e.target.value }))}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs w-28 focus:outline-none focus:border-green-500"
                      onKeyDown={e => e.key === 'Enter' && handleSetBudget(u.id)}
                    />
                    <button
                      onClick={() => handleSetBudget(u.id)}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2 py-1 rounded transition-colors"
                    >
                      OK
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleResetTeam(u.id, u.username)}
                      title="Liberar todos los jugadores del equipo"
                      className="text-xs bg-amber-700 hover:bg-amber-600 text-white px-2 py-1 rounded transition-colors"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u.id, u.username)}
                      title="Eliminar usuario"
                      className="text-xs bg-red-700 hover:bg-red-600 text-white px-2 py-1 rounded transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── PLAYERS TAB ─────────────────────────────────────────────────────────────
function PlayersTab() {
  const [players, setPlayers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ id: '', name: '', pes_team: '', nationality: '', position: 'ST', pes_position: 'CF', rating: '', age: '', foot: 'Right' })
  const [msg, setMsg] = useState('')

  const fetchPlayers = () => {
    getAllPlayers().then(r => setPlayers(r.data)).catch(console.error).finally(() => setLoading(false))
  }
  useEffect(() => { fetchPlayers() }, [])

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  const filtered = search
    ? players.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.pes_team || '').toLowerCase().includes(search.toLowerCase())
      ).slice(0, 100)
    : players.slice(0, 100)

  const handleEdit = (p) => {
    setEditing(p.id)
    setEditForm({ name: p.name, position: p.position, rating: p.rating })
  }

  const handleSaveEdit = async (id) => {
    try {
      await editPlayer(id, editForm)
      flash('Jugador actualizado')
      setEditing(null)
      fetchPlayers()
    } catch (err) { flash(err.response?.data?.error || 'Error') }
  }

  const handleAddPlayer = async () => {
    try {
      await addPlayer(addForm)
      flash('Jugador agregado')
      setShowAdd(false)
      setAddForm({ id: '', name: '', pes_team: '', nationality: '', position: 'ST', pes_position: 'CF', rating: '', age: '', foot: 'Right' })
      fetchPlayers()
    } catch (err) { flash(err.response?.data?.error || 'Error') }
  }

  const positions = ['GK', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'LW', 'ST']

  return (
    <div className="space-y-4">
      {msg && <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 text-green-400 text-sm">{msg}</div>}

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Buscar jugador..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-green-500"
        />
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-green-500 hover:bg-green-400 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          + Agregar Jugador
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 space-y-3">
          <h3 className="text-white font-semibold text-sm">Nuevo Jugador</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: 'id', label: 'ID' },
              { key: 'name', label: 'Nombre' },
              { key: 'pes_team', label: 'Equipo' },
              { key: 'nationality', label: 'Nacion.' },
              { key: 'rating', label: 'OVR', type: 'number' },
              { key: 'age', label: 'Edad', type: 'number' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-gray-500 text-xs block mb-1">{f.label}</label>
                <input
                  type={f.type || 'text'}
                  value={addForm[f.key]}
                  onChange={e => setAddForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-green-500"
                />
              </div>
            ))}
            <div>
              <label className="text-gray-500 text-xs block mb-1">Posición</label>
              <select
                value={addForm.position}
                onChange={e => setAddForm(prev => ({ ...prev, position: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"
              >
                {positions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">Pie</label>
              <select
                value={addForm.foot}
                onChange={e => setAddForm(prev => ({ ...prev, foot: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"
              >
                <option value="Right">Derecho</option>
                <option value="Left">Izquierdo</option>
                <option value="Both">Ambos</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddPlayer}
              className="bg-green-500 hover:bg-green-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Agregar
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!search && <p className="text-gray-500 text-xs">Mostrando primeros 100. Usa la búsqueda para encontrar jugadores.</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs border-b border-gray-800">
              <th className="px-3 py-2 text-left">Nombre</th>
              <th className="px-3 py-2 text-left">Equipo</th>
              <th className="px-3 py-2 text-left">Pos.</th>
              <th className="px-3 py-2 text-center">OVR</th>
              <th className="px-3 py-2 text-left">Dueño</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-gray-800/40">
                <td className="px-3 py-2">
                  {editing === p.id ? (
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs w-full focus:outline-none focus:border-green-500"
                    />
                  ) : (
                    <span className="text-white">{p.name}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-400 text-xs">{p.pes_team}</td>
                <td className="px-3 py-2">
                  {editing === p.id ? (
                    <select
                      value={editForm.position}
                      onChange={e => setEditForm(prev => ({ ...prev, position: e.target.value }))}
                      className="bg-gray-800 border border-gray-700 rounded px-1 py-1 text-white text-xs"
                    >
                      {positions.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                    </select>
                  ) : (
                    <span className="bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded">{p.position}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {editing === p.id ? (
                    <input
                      type="number"
                      value={editForm.rating}
                      onChange={e => setEditForm(prev => ({ ...prev, rating: e.target.value }))}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-xs w-14 text-center focus:outline-none focus:border-green-500"
                    />
                  ) : (
                    <span className="text-yellow-400 font-bold">{p.rating}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs">{p.owner_username || '—'}</td>
                <td className="px-3 py-2">
                  {editing === p.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleSaveEdit(p.id)}
                        className="text-xs bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded transition-colors"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEdit(p)}
                      className="text-xs text-gray-400 hover:text-white underline"
                    >
                      Editar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── TOURNAMENTS TAB ──────────────────────────────────────────────────────────
function TournamentsTab() {
  const [tournaments, setTournaments] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', participantIds: [], prizes: ['', '', ''] })
  const [msg, setMsg] = useState('')
  const [finishing, setFinishing] = useState(null)

  const fetchAll = () => {
    Promise.all([getTournaments(), getUsers()])
      .then(([t, u]) => {
        setTournaments(t.data)
        setUsers(u.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }
  useEffect(() => { fetchAll() }, [])

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  const toggleParticipant = (id) => {
    setForm(prev => ({
      ...prev,
      participantIds: prev.participantIds.includes(id)
        ? prev.participantIds.filter(x => x !== id)
        : [...prev.participantIds, id]
    }))
  }

  const handleCreate = async () => {
    if (!form.name || form.participantIds.length < 2) {
      return flash('Nombre y al menos 2 participantes requeridos')
    }
    try {
      const prizes = form.prizes.map(p => parseInt(p) || 0)
      await createTournament({ name: form.name, participantIds: form.participantIds, prizes })
      flash(`Torneo "${form.name}" creado (${form.participantIds.length <= 6 ? 'todos vs todos' : 'grupos'})`)
      setForm({ name: '', participantIds: [], prizes: ['', '', ''] })
      fetchAll()
    } catch (err) { flash(err.response?.data?.error || 'Error') }
  }

  const handleFinish = async (id) => {
    setFinishing(id)
    try {
      await finishTournament(id)
      flash('Torneo finalizado y premios entregados')
      fetchAll()
    } catch (err) { flash(err.response?.data?.error || 'Error') }
    finally { setFinishing(null) }
  }

  if (loading) return <div className="text-gray-400 text-center py-12">Cargando...</div>

  const autoFormat = form.participantIds.length <= 6 && form.participantIds.length >= 2
    ? 'Todos vs Todos'
    : form.participantIds.length > 6
      ? 'Grupos (A y B)'
      : '—'

  return (
    <div className="space-y-6">
      {msg && <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 text-green-400 text-sm">{msg}</div>}

      {/* Create form */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 space-y-4">
        <h3 className="text-white font-semibold text-sm">Crear Torneo</h3>
        <div>
          <label className="text-gray-400 text-xs block mb-1">Nombre del torneo</label>
          <input
            type="text"
            placeholder="Ej: Torneo Apertura 2006"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
          />
        </div>

        <div>
          <label className="text-gray-400 text-xs block mb-1">Participantes ({form.participantIds.length} sel.) — Formato: {autoFormat}</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {users.map(u => (
              <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.participantIds.includes(u.id)}
                  onChange={() => toggleParticipant(u.id)}
                  className="accent-green-500"
                />
                <span className="text-white text-sm">{u.team_name || u.username}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-gray-400 text-xs block mb-1">Premios</label>
          <div className="flex gap-2">
            {['🥇 1°', '🥈 2°', '🥉 3°'].map((label, i) => (
              <div key={i} className="flex-1">
                <label className="text-gray-500 text-xs block mb-1">{label}</label>
                <input
                  type="number"
                  placeholder="0"
                  value={form.prizes[i]}
                  onChange={e => {
                    const prizes = [...form.prizes]
                    prizes[i] = e.target.value
                    setForm(prev => ({ ...prev, prizes }))
                  }}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-green-500"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleCreate}
          className="bg-green-500 hover:bg-green-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Crear Torneo
        </button>
      </div>

      {/* Tournament list */}
      <div className="space-y-3">
        {tournaments.map(t => (
          <div key={t.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-medium">{t.name}</div>
                <div className="text-gray-500 text-xs mt-0.5">
                  {t.participants?.length || 0} participantes ·{' '}
                  {t.format === 'roundrobin' ? 'Todos vs Todos' : 'Grupos'} ·{' '}
                  <span className={t.status === 'active' ? 'text-green-400' : 'text-gray-400'}>
                    {t.status === 'active' ? 'Activo' : 'Finalizado'}
                  </span>
                </div>
              </div>
              {t.status === 'active' && (
                <button
                  onClick={() => handleFinish(t.id)}
                  disabled={finishing === t.id}
                  className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  {finishing === t.id ? 'Finalizando...' : 'Finalizar'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── CONFIG TAB ───────────────────────────────────────────────────────────────
const POSITION_GROUP_ADMIN = {
  GK: 'gk', CB: 'def', LB: 'def',
  CDM: 'mid', CM: 'mid', CAM: 'mid',
  LW: 'fwd', ST: 'fwd'
}

function calcPriceAdmin(rating, position, cfg) {
  const group = POSITION_GROUP_ADMIN[position] || 'mid'
  const multKey = { gk: 'posMultGk', def: 'posMultDef', mid: 'posMultMid', fwd: 'posMultFwd' }[group]
  const posMult = parseFloat(cfg[multKey] ?? 1)
  const threshold = parseInt(cfg.ratingThreshold) || 80
  const lowMult = parseFloat(cfg.lowRatingMult) || 0.5
  const ratingMult = rating < threshold ? lowMult : 1.0
  return Math.round(rating * rating * (parseInt(cfg.priceMultiplier) || 1000) * posMult * ratingMult)
}

function ConfigTab() {
  const [config, setConfig] = useState({
    initialBudget: 50000000, priceMultiplier: 1000,
    maxRoster: 22, minRoster: 18, releasePct: 60, adminCode: 'aps2006',
    posMultGk: 0.8, posMultDef: 0.9, posMultMid: 1.0, posMultFwd: 1.2,
    hideWithoutTeam: false, ratingThreshold: 80, lowRatingMult: 0.5,
    disableRegistration: false
  })
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    getConfig().then(r => setConfig(r.data)).catch(console.error).finally(() => setLoading(false))
  }, [])

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  const handleSave = async () => {
    try {
      await updateConfig(config)
      flash('Configuración guardada')
    } catch (err) { flash(err.response?.data?.error || 'Error') }
  }

  const priceExamples = [
    { ovr: 95, pos: 'ST',  label: 'ST 95' },
    { ovr: 90, pos: 'ST',  label: 'ST 90' },
    { ovr: 85, pos: 'CAM', label: 'CAM 85' },
    { ovr: 85, pos: 'CB',  label: 'CB 85' },
    { ovr: 80, pos: 'GK',  label: 'GK 80' },
    { ovr: 78, pos: 'ST',  label: 'ST 78 ↓' },
    { ovr: 75, pos: 'CM',  label: 'CM 75 ↓' },
    { ovr: 70, pos: 'LB',  label: 'LB 70 ↓' },
  ]

  if (loading) return <div className="text-gray-400 text-center py-12">Cargando...</div>

  return (
    <div className="space-y-6">
      {msg && <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 text-green-400 text-sm">{msg}</div>}

      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 space-y-5">
        <h3 className="text-white font-semibold">Parámetros del Sistema</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: 'initialBudget',   label: 'Presupuesto inicial',      type: 'number' },
            { key: 'priceMultiplier', label: 'Multiplicador base',        type: 'number' },
            { key: 'maxRoster',       label: 'Máximo plantel',            type: 'number' },
            { key: 'minRoster',       label: 'Mínimo plantel',            type: 'number' },
            { key: 'releasePct',      label: 'Pago al liberar (% valor)', type: 'number' },
            { key: 'adminCode',       label: 'Código de admin',           type: 'text'   },
          ].map(f => (
            <div key={f.key}>
              <label className="text-gray-400 text-sm block mb-1.5">{f.label}</label>
              <input
                type={f.type}
                value={config[f.key] ?? ''}
                onChange={e => setConfig(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>
          ))}
        </div>

        {/* Position multipliers */}
        <div>
          <h4 className="text-gray-400 text-sm font-medium mb-3">Multiplicador por posición</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: 'posMultGk',  label: 'Portero (GK)',        positions: 'GK' },
              { key: 'posMultDef', label: 'Defensor (CB/LB)',     positions: 'CB, LB' },
              { key: 'posMultMid', label: 'Mediocampista',        positions: 'CDM, CM, CAM' },
              { key: 'posMultFwd', label: 'Delantero (LW/ST)',    positions: 'LW, ST' },
            ].map(f => (
              <div key={f.key} className="bg-gray-700/50 rounded-lg p-3">
                <label className="text-gray-400 text-xs block mb-0.5">{f.label}</label>
                <p className="text-gray-600 text-xs mb-2">{f.positions}</p>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="3"
                  value={config[f.key] ?? ''}
                  onChange={e => setConfig(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-green-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Rating threshold */}
        <div>
          <h4 className="text-gray-400 text-sm font-medium mb-3">Descuento por OVR bajo</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-700/50 rounded-lg p-3">
              <label className="text-gray-400 text-xs block mb-0.5">Umbral OVR</label>
              <p className="text-gray-600 text-xs mb-2">Jugadores con OVR menor a este valor reciben descuento</p>
              <input
                type="number"
                min="1"
                max="99"
                value={config.ratingThreshold ?? ''}
                onChange={e => setConfig(prev => ({ ...prev, ratingThreshold: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3">
              <label className="text-gray-400 text-xs block mb-0.5">Multiplicador bajo umbral</label>
              <p className="text-gray-600 text-xs mb-2">0.5 = mitad de precio para OVR bajo</p>
              <input
                type="number"
                step="0.05"
                min="0.05"
                max="1"
                value={config.lowRatingMult ?? ''}
                onChange={e => setConfig(prev => ({ ...prev, lowRatingMult: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-green-500"
              />
            </div>
          </div>
        </div>

        {/* Visibility options */}
        <div>
          <h4 className="text-gray-400 text-sm font-medium mb-3">Visibilidad y acceso</h4>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
              <div
                onClick={() => setConfig(prev => ({ ...prev, hideWithoutTeam: !prev.hideWithoutTeam }))}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  config.hideWithoutTeam ? 'bg-green-500' : 'bg-gray-600'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  config.hideWithoutTeam ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
              <div>
                <div className="text-white text-sm">Ocultar jugadores sin equipo</div>
                <div className="text-gray-500 text-xs">Filtra los jugadores con equipo "without team" del mercado de agentes libres</div>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
              <div
                onClick={() => setConfig(prev => ({ ...prev, disableRegistration: !prev.disableRegistration }))}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  config.disableRegistration ? 'bg-red-500' : 'bg-gray-600'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  config.disableRegistration ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
              <div>
                <div className="text-white text-sm">Deshabilitar registro de usuarios</div>
                <div className="text-gray-500 text-xs">Impide que nuevos usuarios se registren en la plataforma</div>
              </div>
            </label>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="bg-green-500 hover:bg-green-400 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
        >
          Guardar Configuración
        </button>
      </div>

      {/* Price examples with position multipliers */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <h3 className="text-white font-semibold text-sm mb-1">
          Precios de referencia (multiplicador base: {config.priceMultiplier})
        </h3>
        <p className="text-gray-500 text-xs mb-3">↓ = bajo umbral OVR {config.ratingThreshold}, precio reducido ×{config.lowRatingMult}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {priceExamples.map(({ ovr, pos, label }) => {
            const price = calcPriceAdmin(ovr, pos, config)
            const belowThreshold = ovr < (parseInt(config.ratingThreshold) || 80)
            return (
              <div key={label} className={`flex justify-between text-sm rounded-lg px-3 py-2 ${belowThreshold ? 'bg-orange-900/30 border border-orange-700/30' : 'bg-gray-700/50'}`}>
                <span className={`font-bold ${belowThreshold ? 'text-orange-400' : 'text-yellow-400'}`}>{label}</span>
                <span className="text-green-400">{formatMoney(price)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN ADMIN PAGE ─────────────────────────────────────────────────────────
export default function Admin() {
  const [tab, setTab] = useState('users')

  const tabs = [
    { id: 'users', label: 'Usuarios' },
    { id: 'players', label: 'Jugadores' },
    { id: 'tournaments', label: 'Torneos' },
    { id: 'config', label: 'Configuración' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-white text-2xl font-bold">Panel de Administración</h1>
        <p className="text-gray-400 text-sm mt-1">Gestión completa del sistema</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-900 rounded-xl p-1 border border-gray-800 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              tab === t.id ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        {tab === 'users' && <UsersTab />}
        {tab === 'players' && <PlayersTab />}
        {tab === 'tournaments' && <TournamentsTab />}
        {tab === 'config' && <ConfigTab />}
      </div>
    </div>
  )
}
