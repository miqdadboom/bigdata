import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/auth/login', { username, password })
      
      if (response.data.success) {
        // Save user info to localStorage
        const userData = response.data.user
        localStorage.setItem('user', JSON.stringify(userData))
        localStorage.setItem('token', response.data.token)
        
        // Trigger custom event so AnalyticsContext can detect the change
        window.dispatchEvent(new Event('userChanged'))
        
        // Update parent component state
        if (onLogin) {
          onLogin(userData)
        }
        
        // Navigate to dashboard
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6">Big Data Sales Analysis</h1>
        <h2 className="text-xl font-semibold text-center mb-6 text-gray-700">Login</h2>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-600"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-600"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-sm text-gray-600">
          <p className="font-semibold mb-2">Login Credentials:</p>
          <div className="space-y-2">
            <div>
              <p className="font-medium text-gray-700">Pharmacy Users:</p>
              <ul className="ml-4 space-y-1 text-xs">
                <li>pharmacy1 / pharmacy123</li>
                <li>pharmacy2 / pharmacy123</li>
                <li>pharmacy3 / pharmacy123</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-gray-700">Mall Users:</p>
              <ul className="ml-4 space-y-1 text-xs">
                <li>mall1 / mall123</li>
                <li>mall2 / mall123</li>
                <li>mall3 / mall123</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-gray-700">Distribution Users:</p>
              <ul className="ml-4 space-y-1 text-xs">
                <li>distribution1 / distribution123</li>
                <li>distribution2 / distribution123</li>
                <li>distribution3 / distribution123</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login

