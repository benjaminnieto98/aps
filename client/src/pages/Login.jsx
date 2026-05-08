import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { login, register } from '../api'

export default function Login() {
  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ username: '', password: '', adminCode: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login: authLogin } = useAuth()
  const navigate = useNavigate()

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fn = tab === 'login' ? login : register
      const payload = tab === 'login'
        ? { username: form.username, password: form.password }
        : { username: form.username, password: form.password, adminCode: form.adminCode || undefined }
      const res = await fn(payload)
      authLogin(res.data.token, res.data.user)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-2xl mb-4">
            <span className="text-white font-bold text-xl">APS</span>
          </div>
          <h1 className="text-white text-2xl font-bold">Asociación de PES6</h1>
          <p className="text-gray-400 text-sm mt-1">El mercado definitivo de PES6</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 rounded-2xl p-6 shadow-xl border border-gray-800">
          {/* Tabs */}
          <div className="flex bg-gray-800 rounded-lg p-1 mb-6">
            <button
              onClick={() => { setTab('login'); setError('') }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                tab === 'login' ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => { setTab('register'); setError('') }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                tab === 'register' ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Registrarse
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1.5">Usuario</label>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                required
                autoComplete="username"
                placeholder="Tu nombre de usuario"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1.5">Contraseña</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                placeholder="Tu contraseña"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 text-sm"
              />
            </div>
            {tab === 'register' && (
              <div>
                <label className="block text-gray-400 text-sm mb-1.5">
                  Código de admin <span className="text-gray-600">(opcional)</span>
                </label>
                <input
                  type="text"
                  name="adminCode"
                  value={form.adminCode}
                  onChange={handleChange}
                  placeholder="Código para acceso admin"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 text-sm"
                />
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              {loading ? 'Cargando...' : tab === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
