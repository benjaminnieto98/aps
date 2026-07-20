import React, { useState, useEffect, useMemo } from 'react'
import { ratingColor } from '../utils/format'

// ─── Formation definitions ────────────────────────────────────────────────────
// x: 0-100 (left→right), y: 0-100 (top=attack, bottom=defense)
const FORMATIONS = {
  '4-4-2': [
    { id: 'GK',  label: 'PO',  x: 50, y: 88, type: 'gk'  },
    { id: 'RB',  label: 'LD',  x: 82, y: 72, type: 'def' },
    { id: 'CB1', label: 'DFC', x: 62, y: 72, type: 'def' },
    { id: 'CB2', label: 'DFC', x: 38, y: 72, type: 'def' },
    { id: 'LB',  label: 'LI',  x: 18, y: 72, type: 'def' },
    { id: 'RM',  label: 'MD',  x: 82, y: 50, type: 'mid' },
    { id: 'CM1', label: 'MC',  x: 62, y: 50, type: 'mid' },
    { id: 'CM2', label: 'MC',  x: 38, y: 50, type: 'mid' },
    { id: 'LM',  label: 'MI',  x: 18, y: 50, type: 'mid' },
    { id: 'ST1', label: 'DC',  x: 62, y: 22, type: 'fwd' },
    { id: 'ST2', label: 'DC',  x: 38, y: 22, type: 'fwd' },
  ],
  '4-3-3': [
    { id: 'GK',  label: 'PO',  x: 50, y: 88, type: 'gk'  },
    { id: 'RB',  label: 'LD',  x: 82, y: 72, type: 'def' },
    { id: 'CB1', label: 'DFC', x: 62, y: 72, type: 'def' },
    { id: 'CB2', label: 'DFC', x: 38, y: 72, type: 'def' },
    { id: 'LB',  label: 'LI',  x: 18, y: 72, type: 'def' },
    { id: 'CM1', label: 'MC',  x: 70, y: 50, type: 'mid' },
    { id: 'CM2', label: 'MC',  x: 50, y: 50, type: 'mid' },
    { id: 'CM3', label: 'MC',  x: 30, y: 50, type: 'mid' },
    { id: 'RW',  label: 'EXD', x: 80, y: 22, type: 'fwd' },
    { id: 'ST',  label: 'DC',  x: 50, y: 17, type: 'fwd' },
    { id: 'LW',  label: 'EXI', x: 20, y: 22, type: 'fwd' },
  ],
  '4-2-3-1': [
    { id: 'GK',  label: 'PO',  x: 50, y: 88, type: 'gk'  },
    { id: 'RB',  label: 'LD',  x: 82, y: 74, type: 'def' },
    { id: 'CB1', label: 'DFC', x: 62, y: 74, type: 'def' },
    { id: 'CB2', label: 'DFC', x: 38, y: 74, type: 'def' },
    { id: 'LB',  label: 'LI',  x: 18, y: 74, type: 'def' },
    { id: 'DM1', label: 'MCD', x: 62, y: 58, type: 'mid' },
    { id: 'DM2', label: 'MCD', x: 38, y: 58, type: 'mid' },
    { id: 'RW',  label: 'EXD', x: 78, y: 38, type: 'mid' },
    { id: 'AM',  label: 'MCO', x: 50, y: 38, type: 'mid' },
    { id: 'LW',  label: 'EXI', x: 22, y: 38, type: 'mid' },
    { id: 'ST',  label: 'DC',  x: 50, y: 18, type: 'fwd' },
  ],
  '4-5-1': [
    { id: 'GK',  label: 'PO',  x: 50, y: 88, type: 'gk'  },
    { id: 'RB',  label: 'LD',  x: 82, y: 74, type: 'def' },
    { id: 'CB1', label: 'DFC', x: 62, y: 74, type: 'def' },
    { id: 'CB2', label: 'DFC', x: 38, y: 74, type: 'def' },
    { id: 'LB',  label: 'LI',  x: 18, y: 74, type: 'def' },
    { id: 'RM',  label: 'MD',  x: 85, y: 50, type: 'mid' },
    { id: 'CM1', label: 'MC',  x: 67, y: 50, type: 'mid' },
    { id: 'CM2', label: 'MC',  x: 50, y: 50, type: 'mid' },
    { id: 'CM3', label: 'MC',  x: 33, y: 50, type: 'mid' },
    { id: 'LM',  label: 'MI',  x: 15, y: 50, type: 'mid' },
    { id: 'ST',  label: 'DC',  x: 50, y: 18, type: 'fwd' },
  ],
  '3-5-2': [
    { id: 'GK',  label: 'PO',  x: 50, y: 88, type: 'gk'  },
    { id: 'CB1', label: 'DFC', x: 68, y: 74, type: 'def' },
    { id: 'CB2', label: 'DFC', x: 50, y: 74, type: 'def' },
    { id: 'CB3', label: 'DFC', x: 32, y: 74, type: 'def' },
    { id: 'RM',  label: 'MD',  x: 85, y: 52, type: 'mid' },
    { id: 'CM1', label: 'MC',  x: 67, y: 52, type: 'mid' },
    { id: 'CM2', label: 'MC',  x: 50, y: 52, type: 'mid' },
    { id: 'CM3', label: 'MC',  x: 33, y: 52, type: 'mid' },
    { id: 'LM',  label: 'MI',  x: 15, y: 52, type: 'mid' },
    { id: 'ST1', label: 'DC',  x: 62, y: 22, type: 'fwd' },
    { id: 'ST2', label: 'DC',  x: 38, y: 22, type: 'fwd' },
  ],
  '4-3-2-1': [
    { id: 'GK',  label: 'PO',  x: 50, y: 88, type: 'gk'  },
    { id: 'RB',  label: 'LD',  x: 82, y: 75, type: 'def' },
    { id: 'CB1', label: 'DFC', x: 62, y: 75, type: 'def' },
    { id: 'CB2', label: 'DFC', x: 38, y: 75, type: 'def' },
    { id: 'LB',  label: 'LI',  x: 18, y: 75, type: 'def' },
    { id: 'CM1', label: 'MC',  x: 65, y: 57, type: 'mid' },
    { id: 'CM2', label: 'MC',  x: 50, y: 57, type: 'mid' },
    { id: 'CM3', label: 'MC',  x: 35, y: 57, type: 'mid' },
    { id: 'SS1', label: 'SD',  x: 65, y: 36, type: 'fwd' },
    { id: 'SS2', label: 'SD',  x: 35, y: 36, type: 'fwd' },
    { id: 'ST',  label: 'DC',  x: 50, y: 17, type: 'fwd' },
  ],
  '3-4-3': [
    { id: 'GK',  label: 'PO',  x: 50, y: 88, type: 'gk'  },
    { id: 'CB1', label: 'DFC', x: 68, y: 74, type: 'def' },
    { id: 'CB2', label: 'DFC', x: 50, y: 74, type: 'def' },
    { id: 'CB3', label: 'DFC', x: 32, y: 74, type: 'def' },
    { id: 'RM',  label: 'MD',  x: 80, y: 53, type: 'mid' },
    { id: 'CM1', label: 'MC',  x: 60, y: 53, type: 'mid' },
    { id: 'CM2', label: 'MC',  x: 40, y: 53, type: 'mid' },
    { id: 'LM',  label: 'MI',  x: 20, y: 53, type: 'mid' },
    { id: 'RW',  label: 'EXD', x: 80, y: 24, type: 'fwd' },
    { id: 'ST',  label: 'DC',  x: 50, y: 18, type: 'fwd' },
    { id: 'LW',  label: 'EXI', x: 20, y: 24, type: 'fwd' },
  ],
  '4-1-4-1': [
    { id: 'GK',  label: 'PO',  x: 50, y: 88, type: 'gk'  },
    { id: 'RB',  label: 'LD',  x: 82, y: 76, type: 'def' },
    { id: 'CB1', label: 'DFC', x: 62, y: 76, type: 'def' },
    { id: 'CB2', label: 'DFC', x: 38, y: 76, type: 'def' },
    { id: 'LB',  label: 'LI',  x: 18, y: 76, type: 'def' },
    { id: 'DM',  label: 'MCD', x: 50, y: 61, type: 'mid' },
    { id: 'RM',  label: 'MD',  x: 82, y: 44, type: 'mid' },
    { id: 'CM1', label: 'MC',  x: 62, y: 44, type: 'mid' },
    { id: 'CM2', label: 'MC',  x: 38, y: 44, type: 'mid' },
    { id: 'LM',  label: 'MI',  x: 18, y: 44, type: 'mid' },
    { id: 'ST',  label: 'DC',  x: 50, y: 18, type: 'fwd' },
  ],
}

const TYPE_COLORS = {
  gk:  { ring: '#facc15', bg: 'rgba(120,90,0,0.85)',  text: '#fef08a' },
  def: { ring: '#60a5fa', bg: 'rgba(30,58,138,0.85)', text: '#bfdbfe' },
  mid: { ring: '#4ade80', bg: 'rgba(20,83,45,0.85)',  text: '#bbf7d0' },
  fwd: { ring: '#f87171', bg: 'rgba(127,29,29,0.85)', text: '#fecaca' },
}

// ─── Pitch SVG background ─────────────────────────────────────────────────────
function PitchSVG() {
  const W = 100, H = 140
  const lw = 0.7
  const lc = 'rgba(255,255,255,0.75)'
  // stripes (alternating light/dark green bands)
  const stripes = Array.from({ length: 7 }, (_, i) => ({
    y: 4 + i * 19,
    h: 9.5,
  }))

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full"
    >
      {/* Base */}
      <rect width={W} height={H} fill="#1a5c28" />
      {/* Lawn stripes */}
      {stripes.map((s, i) => (
        <rect key={i} x="4" y={s.y} width="92" height={s.h} fill="rgba(0,0,0,0.07)" />
      ))}
      {/* Field border */}
      <rect x="4" y="4" width="92" height="132" fill="none" stroke={lc} strokeWidth={lw} />
      {/* Center line */}
      <line x1="4" y1="70" x2="96" y2="70" stroke={lc} strokeWidth={lw} />
      {/* Center circle */}
      <circle cx="50" cy="70" r="9" fill="none" stroke={lc} strokeWidth={lw} />
      <circle cx="50" cy="70" r="1" fill={lc} />
      {/* Top penalty area */}
      <rect x="22" y="4" width="56" height="24" fill="none" stroke={lc} strokeWidth={lw} />
      {/* Top 6-yard box */}
      <rect x="36" y="4" width="28" height="10" fill="none" stroke={lc} strokeWidth={lw} />
      {/* Top penalty spot */}
      <circle cx="50" cy="23" r="0.8" fill={lc} />
      {/* Bottom penalty area */}
      <rect x="22" y="112" width="56" height="24" fill="none" stroke={lc} strokeWidth={lw} />
      {/* Bottom 6-yard box */}
      <rect x="36" y="126" width="28" height="10" fill="none" stroke={lc} strokeWidth={lw} />
      {/* Bottom penalty spot */}
      <circle cx="50" cy="117" r="0.8" fill={lc} />
      {/* Top goal */}
      <rect x="40" y="1" width="20" height="4" fill="none" stroke={lc} strokeWidth={lw} />
      {/* Bottom goal */}
      <rect x="40" y="135" width="20" height="4" fill="none" stroke={lc} strokeWidth={lw} />
      {/* Corner arcs (tiny) */}
      {[[4,4],[96,4],[96,136],[4,136]].map(([cx,cy],i) => {
        const dx = cx === 4 ? 1 : -1
        const dy = cy === 4 ? 1 : -1
        return <path key={i} d={`M ${cx+dx*4},${cy} A 4,4 0 0 ${cx===4?1:0} ${cx},${cy+dy*4}`} fill="none" stroke={lc} strokeWidth={lw} />
      })}
    </svg>
  )
}

// ─── Position slot on the pitch ───────────────────────────────────────────────
function PositionSlot({ slot, player, onClick }) {
  const colors = TYPE_COLORS[slot.type]
  const assigned = !!player

  return (
    <button
      onClick={onClick}
      className="absolute flex flex-col items-center group"
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        transform: 'translate(-50%, -50%)',
        width: 52,
        zIndex: 10,
      }}
    >
      {/* Circle */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ring-2 shadow-md transition-transform group-hover:scale-110 active:scale-95"
        style={{
          background: colors.bg,
          ringColor: colors.ring,
          border: `2px solid ${colors.ring}`,
          color: colors.text,
          boxShadow: assigned ? `0 0 8px ${colors.ring}55` : undefined,
        }}
      >
        {slot.label}
      </div>
      {/* Player name */}
      <div
        className="mt-0.5 text-center leading-tight"
        style={{ maxWidth: 56 }}
      >
        {player ? (
          <span
            className="text-white font-medium block truncate"
            style={{ fontSize: 9 }}
          >
            {player.name.split(' ').slice(-1)[0]}
          </span>
        ) : (
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>—</span>
        )}
        {player && (
          <span style={{ fontSize: 8, color: colors.text }}>{player.rating}</span>
        )}
      </div>
    </button>
  )
}

// ─── Player picker modal ──────────────────────────────────────────────────────
function PlayerPicker({ slot, players, lineup, onAssign, onClear, onClose }) {
  const [search, setSearch] = useState('')

  // map slotId → playerId for quick lookup
  const assignedSlots = useMemo(() => {
    const m = {}
    Object.entries(lineup).forEach(([sid, pid]) => { if (pid) m[pid] = sid })
    return m
  }, [lineup])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return players.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.position.toLowerCase().includes(q) ||
      (p.nationality || '').toLowerCase().includes(q)
    )
  }, [players, search])

  const currentPlayerId = lineup[slot.id]
  const colors = TYPE_COLORS[slot.type]

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-xl w-full max-w-sm border border-gray-700 flex flex-col overflow-hidden"
        style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 shrink-0"
            style={{ background: colors.bg, border: `2px solid ${colors.ring}`, color: colors.text }}
          >
            {slot.label}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">Asignar jugador</p>
            <p className="text-gray-500 text-xs">Slot: {slot.id}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-gray-800">
          <input
            autoFocus
            type="text"
            placeholder="Buscar por nombre, posición..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-green-500"
          />
        </div>

        {/* Player list */}
        <div className="overflow-y-auto flex-1">
          {currentPlayerId && (
            <button
              onClick={onClear}
              className="w-full text-left px-4 py-2.5 border-b border-gray-800 text-red-400 hover:bg-red-900/20 text-xs font-medium transition-colors"
            >
              ✕ Quitar jugador del slot
            </button>
          )}
          {filtered.length === 0 ? (
            <div className="text-gray-500 text-sm text-center py-8">Sin resultados</div>
          ) : (
            filtered.map(p => {
              const isSelected = p.id === currentPlayerId
              const inOtherSlot = assignedSlots[p.id] && !isSelected
              return (
                <button
                  key={p.id}
                  onClick={() => onAssign(slot.id, p.id)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors border-b border-gray-800/50 ${
                    isSelected
                      ? 'bg-green-900/30 border-l-2 border-l-green-500'
                      : 'hover:bg-gray-800/60'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-sm font-medium ${isSelected ? 'text-green-300' : 'text-white'}`}>
                        {p.name}
                      </span>
                      {inOtherSlot && (
                        <span className="text-yellow-500 text-xs border border-yellow-500/30 bg-yellow-500/10 px-1 rounded">
                          en {assignedSlots[p.id]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded">{p.position}</span>
                      {p.nationality && <span className="text-gray-500 text-xs">{p.nationality}</span>}
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${ratingColor(p.rating)}`}>{p.rating}</span>
                  {isSelected && <span className="text-green-400 text-xs">✓</span>}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
const FORMATION_NAMES = Object.keys(FORMATIONS)

export default function LineupBuilder({ players, userId }) {
  const storageKey = `aps_lineup_${userId || 'guest'}`

  const loadSaved = () => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) return JSON.parse(raw)
    } catch {}
    return { formation: '4-4-2', lineup: {} }
  }

  const [formation, setFormation]     = useState(() => loadSaved().formation)
  const [lineup, setLineup]           = useState(() => loadSaved().lineup)
  const [activeSlot, setActiveSlot]   = useState(null)

  // Auto-save whenever lineup or formation changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ formation, lineup }))
    } catch {}
  }, [formation, lineup, storageKey])

  const slots = FORMATIONS[formation]

  const handleFormationChange = (f) => {
    setFormation(f)
    setLineup({}) // clear lineup on formation change
  }

  const handleAssign = (slotId, playerId) => {
    setLineup(prev => {
      const next = { ...prev }
      // Remove player from any other slot
      Object.keys(next).forEach(k => { if (next[k] === playerId) delete next[k] })
      next[slotId] = playerId
      return next
    })
    setActiveSlot(null)
  }

  const handleClear = () => {
    if (!activeSlot) return
    setLineup(prev => { const n = { ...prev }; delete n[activeSlot.id]; return n })
    setActiveSlot(null)
  }

  const playerMap = useMemo(() => {
    const m = {}
    players.forEach(p => { m[p.id] = p })
    return m
  }, [players])

  const assigned = Object.values(lineup).filter(Boolean).length
  const activeSlotObj = slots.find(s => s.id === activeSlot?.id)

  const clearAll = () => { setLineup({}) }

  return (
    <div className="space-y-4">
      {/* Formation selector */}
      <div>
        <p className="text-gray-500 text-xs mb-2">Formación</p>
        <div className="flex flex-wrap gap-1.5">
          {FORMATION_NAMES.map(f => (
            <button
              key={f}
              onClick={() => handleFormationChange(f)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${
                formation === f
                  ? 'bg-green-600 border-green-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Pitch + assigned count */}
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-xs">
          <span className={assigned === 11 ? 'text-green-400 font-semibold' : 'text-white'}>{assigned}</span>
          <span className="text-gray-600">/11 jugadores asignados</span>
        </p>
        {assigned > 0 && (
          <button
            onClick={clearAll}
            className="text-gray-600 hover:text-red-400 text-xs transition-colors"
          >
            Limpiar todo
          </button>
        )}
      </div>

      {/* Pitch */}
      <div className="mx-auto" style={{ maxWidth: 360 }}>
        <div className="relative w-full rounded-xl overflow-hidden shadow-2xl" style={{ paddingBottom: '140%' }}>
          {/* SVG field */}
          <PitchSVG />

          {/* "Ataque" / "Defensa" labels */}
          <div className="absolute top-1.5 left-0 right-0 flex justify-center z-10 pointer-events-none">
            <span className="text-white/30 text-[9px] font-medium tracking-widest uppercase">Ataque</span>
          </div>
          <div className="absolute bottom-1.5 left-0 right-0 flex justify-center z-10 pointer-events-none">
            <span className="text-white/30 text-[9px] font-medium tracking-widest uppercase">Defensa</span>
          </div>

          {/* Position slots */}
          {slots.map(slot => (
            <PositionSlot
              key={slot.id}
              slot={slot}
              player={lineup[slot.id] ? playerMap[lineup[slot.id]] : null}
              onClick={() => setActiveSlot(slot)}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 justify-center">
        {Object.entries(TYPE_COLORS).map(([type, c]) => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-gray-400">
            <div className="w-3 h-3 rounded-full" style={{ background: c.ring }} />
            {{ gk: 'Portero', def: 'Defensa', mid: 'Medio', fwd: 'Delantero' }[type]}
          </div>
        ))}
      </div>

      {/* Player picker modal */}
      {activeSlot && (
        <PlayerPicker
          slot={activeSlotObj}
          players={players}
          lineup={lineup}
          onAssign={handleAssign}
          onClear={handleClear}
          onClose={() => setActiveSlot(null)}
        />
      )}
    </div>
  )
}
