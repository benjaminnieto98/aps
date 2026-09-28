import React, { useEffect } from 'react'
import { formatMoney } from '../utils/format'

// Bottom sheet on mobile, centered dialog from sm: up. Closes on backdrop tap / Escape.
export function Modal({ onClose, children, maxWidth = 'sm:max-w-sm', padded = true }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={`bg-gray-900 w-full ${maxWidth} border border-gray-700 shadow-2xl rounded-t-2xl sm:rounded-2xl max-h-[90dvh] overflow-y-auto ${
          padded ? 'p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6' : 'pb-safe sm:pb-0'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`sm:hidden mx-auto h-1 w-10 rounded-full bg-gray-700 ${padded ? '-mt-2 mb-3' : 'mt-2 mb-1'}`} />
        {children}
      </div>
    </div>
  )
}

// Segmented tabs that stay on one row and scroll horizontally on narrow screens.
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-none">
      <div className="inline-flex bg-gray-900 rounded-xl p-1 border border-gray-800 gap-1 whitespace-nowrap">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`shrink-0 px-3.5 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              value === t.id ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                t.highlight ? 'bg-yellow-500 text-black font-bold' :
                value === t.id ? 'bg-white/20' : 'bg-gray-700'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// Numeric input with numeric keypad on mobile and a formatted preview below.
export function MoneyInput({ value, className = '', ...props }) {
  const n = parseInt(value, 10)
  return (
    <div>
      <input type="number" inputMode="numeric" value={value} className={className} {...props} />
      {n > 0 && <p className="text-gray-500 text-xs mt-1">= {formatMoney(n)}</p>}
    </div>
  )
}
