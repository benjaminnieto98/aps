export const formatMoney = (n) => {
  if (n === null || n === undefined) return '$0'
  return '$' + Number(n).toLocaleString('es-AR').replace(/,/g, '.')
}

// Compact money for tight spots: $130.0M, $850K
export const formatMoneyShort = (n) => {
  if (n === null || n === undefined) return '$0'
  const v = Number(n)
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}$${Math.round(abs / 1_000_000).toLocaleString('es-AR')}M`
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}$${Math.round(abs / 1_000)}K`
  return `${sign}$${abs}`
}

export const positionOrder = ['GK', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'LW', 'ST']

export const positionLabel = {
  GK: 'Portero',
  CB: 'Central',
  LB: 'Lateral',
  CDM: 'Pivote',
  CM: 'Centrocampista',
  CAM: 'Mediapunta',
  LW: 'Extremo',
  ST: 'Delantero'
}

export const ratingColor = (r) => {
  if (r >= 90) return 'text-yellow-400'
  if (r >= 80) return 'text-green-400'
  if (r >= 70) return 'text-blue-400'
  return 'text-gray-400'
}
