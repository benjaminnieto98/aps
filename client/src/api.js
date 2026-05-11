import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auth
export const login = (data) => api.post('/auth/login', data)
export const register = (data) => api.post('/auth/register', data)
export const getMe = () => api.get('/auth/me')

// Players
export const getAllPlayers = () => api.get('/players')
export const getMarketPlayers = () => api.get('/players/market')
export const getClausePlayers = () => api.get('/players/clauses')
export const getFreePlayers = () => api.get('/players/free')
export const getMyPlayers = () => api.get('/players/my')
export const listPlayer = (id, price) => api.post(`/players/${id}/list`, { price })
export const unlistPlayer = (id) => api.post(`/players/${id}/unlist`)
export const setClause = (id, amount) => api.post(`/players/${id}/clause`, { amount })
export const removeClause = (id) => api.post(`/players/${id}/remove-clause`)
export const buyPlayer = (id) => api.post(`/players/${id}/buy`)
export const releasePlayer = (id) => api.post(`/players/${id}/release`)
export const editPlayer = (id, data) => api.post(`/players/${id}/edit`, data)
export const addPlayer = (data) => api.post('/players/add', data)

// Users
export const getUsers = () => api.get('/users')
export const assignTeam = (id, teamName) => api.post(`/users/${id}/assign-team`, { teamName })
export const resetTeam = (id) => api.post(`/users/${id}/reset-team`)
export const deleteUser = (id) => api.delete(`/users/${id}`)
export const setBudget = (id, amount) => api.post(`/users/${id}/budget`, { amount })
export const toggleAdmin = (id) => api.post(`/users/${id}/toggle-admin`)
export const setPes6Index = (id, teamIndex) => api.post(`/users/${id}/pes6-index`, { teamIndex })
export const exportOptionFile = () => api.get('/users/export-of')

// Tournaments
export const getTournaments = () => api.get('/tournaments')
export const createTournament = (data) => api.post('/tournaments', data)
export const finishTournament = (id) => api.post(`/tournaments/${id}/finish`)

// Matches
export const getMatches = (tournamentId) => api.get(`/matches?tournament=${tournamentId}`)
export const saveResult = (id, data) => api.post(`/matches/${id}/result`, data)

// Config
export const getConfig = () => api.get('/config')
export const getPublicConfig = () => api.get('/config/public')
export const getRegistrationStatus = () => api.get('/config/registration')
export const updateConfig = (data) => api.put('/config', data)

// Stats
export const getScorers = () => api.get('/stats/scorers')
export const getManagers = () => api.get('/stats/managers')

// Transfers
export const getTransfers = (params = {}) => api.get('/transfers', { params })

// Clause offers
export const getReceivedOffers = () => api.get('/clause-offers/received')
export const getSentOffers = () => api.get('/clause-offers/sent')
export const acceptOffer = (id) => api.post(`/clause-offers/${id}/accept`)
export const raiseClauseOffer = (id, newAmount) => api.post(`/clause-offers/${id}/raise`, { newAmount })
export const rejectOffer = (id) => api.post(`/clause-offers/${id}/reject`)

// Player profile
export const getPlayerProfile = (id) => api.get(`/players/${id}/profile`)

// Stats records
export const getRecords = () => api.get('/stats/records')

export default api
