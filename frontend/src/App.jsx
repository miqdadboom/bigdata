import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Navigation from './components/Navigation'
import Dashboard from './components/Dashboard'
import DualDashboard from './components/DualDashboard'
import Login from './pages/Login'
import DistributionDashboard from './pages/DistributionDashboard'
import ProblemAnalysis from './pages/ProblemAnalysis'
import { fetchDashboardData } from './services/api'
import { AnalyticsProvider } from './contexts/AnalyticsContext'

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  return user ? children : <Navigate to="/" replace />
}

function AppContent() {
  const navigate = useNavigate()
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user')
    return savedUser ? JSON.parse(savedUser) : null
  })
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    companyId: user?.companyId || '',
    region: ''
  })

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [filters, user])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchDashboardData(filters)
      setDashboardData(data)
    } catch (err) {
      const errorMessage = err.message || 'Failed to load dashboard data'
      setError(errorMessage)
      console.error('Error loading dashboard:', err)
      // Set empty data structure to prevent crashes
      setDashboardData({
        summary: { totalRevenue: 0, totalSales: 0, avgSaleAmount: 0 },
        salesByRegion: [],
        salesByCompany: [],
        topProducts: [],
        employeePerformance: []
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }

  const DashboardPage = () => {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="text-red-600 text-xl mb-4">⚠️ Error</div>
            <p className="text-gray-600">{error}</p>
            <button
              onClick={loadDashboardData}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }

    // Use appropriate dashboard based on user role
    if (user) {
      // Check if user has required fields
      if (!user.companyId || !user.role) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center max-w-md">
              <div className="text-red-600 text-xl mb-4">⚠️ Error</div>
              <p className="text-gray-600 mb-4">
                User data is incomplete. Please logout and login again.
              </p>
              <button
                onClick={() => {
                  localStorage.removeItem('user')
                  localStorage.removeItem('token')
                  window.location.href = '/'
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                Go to Login
              </button>
            </div>
          </div>
        )
      }
      
      // Distributor role gets Distribution Dashboard
      if (user.role === 'distributor') {
        return <DistributionDashboard user={user} />
      }
      // Retailer role (pharmacy and mall) gets DualDashboard
      if (user.role === 'retailer') {
        return <DualDashboard user={user} />
      }
      
      // Fallback (should not reach here)
      return <DualDashboard user={user} />
    }
    
    return (
      <Dashboard 
        data={dashboardData} 
        filters={filters}
        onFilterChange={handleFilterChange}
        onRefresh={loadDashboardData}
      />
    )
  }

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    setUser(null)
    // Trigger custom event so AnalyticsContext can detect the change
    window.dispatchEvent(new Event('userChanged'))
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {user && <Navigation user={user} onLogout={handleLogout} />}
      <Routes>
        {/* Login page is the first page */}
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Login onLogin={setUser} />} />
        {/* Dashboard and other pages are protected */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/problems" element={<ProtectedRoute><ProblemAnalysis /></ProtectedRoute>} />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <Router>
      <AnalyticsProvider>
        <AppContent />
      </AnalyticsProvider>
    </Router>
  )
}

export default App

