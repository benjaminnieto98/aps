export const formatMoney = (n) => {
  if (n === null || n === undefined) return '$0'
  return '$' + Number(n).toLocaleString('es-AR').replace(/,/g, '.')
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
