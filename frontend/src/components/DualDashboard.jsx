import { useState, useEffect } from 'react'
import KPICards from './KPICards'
import SalesTrendsChart from './charts/SalesTrendsChart'
import SalesByRegionChart from './charts/SalesByRegionChart'
import TopProductsChart from './charts/TopProductsChart'
import TopProductsTable from './tables/TopProductsTable'
import Filters from './Filters'
import api from '../services/api'
import { fetchCompanyDetailedAnalytics } from '../services/api'

const DualDashboard = ({ user }) => {
  const [companyData, setCompanyData] = useState(null)
  const [marketData, setMarketData] = useState(null)
  const [detailedAnalytics, setDetailedAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('company') // 'company' or 'market'
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    region: ''
  })

  useEffect(() => {
    // Load data on mount and when filters/user changes
    if (user && user.companyId) {
      loadData()
    } else {
      // If no user, stop loading
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.startDate, filters.endDate, filters.region, user?.companyId, activeTab])

  // Auto-refresh Dashboard every 10 seconds to show real-time updates
  useEffect(() => {
    if (!user || !user.companyId) return

    // Don't auto-refresh if filters are applied (user wants to see specific date range)
    const hasFilters = filters.startDate || filters.endDate || filters.region
    if (hasFilters) return

    const interval = setInterval(() => {
      loadData(true) // Silent refresh - don't show loading spinner
    }, 10000) // Refresh every 10 seconds

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.companyId, filters.startDate, filters.endDate, filters.region, activeTab])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Check if user and companyId exist
      if (!user || !user.companyId) {
        setError('User data incomplete. Please login again.')
        setLoading(false)
        return
      }

      const params = new URLSearchParams()
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.region) params.append('region', filters.region)
      // Add sector for Spark data optimization
      if (user.sector) {
        const sectorMap = { pharmacy: 'pharmacy', mall: 'mall', distribution: 'distribution' }
        const sector = sectorMap[user.sector] || user.sector
        params.append('sector', sector)
      }

      // Load Company Data
      const companyResponse = await api.get(`/analytics/company/${user.companyId}?${params.toString()}`)
      setCompanyData(companyResponse.data)

      // Load Market Data (Sector)
      const sectorMap = { pharmacy: 'pharmacy', mall: 'mall', distribution: 'distribution' }
      const sector = sectorMap[user.sector] || user.sector
      const marketResponse = await api.get(`/analytics/sector/${sector}/market?${params.toString()}`)
      setMarketData(marketResponse.data)

      // Load Detailed Analytics (Top Products) - only for company tab
      if (activeTab === 'company') {
        try {
          const detailedResponse = await fetchCompanyDetailedAnalytics(user.companyId)
          setDetailedAnalytics(detailedResponse)
        } catch (detailedErr) {
          console.error('Error loading detailed analytics:', detailedErr)
          // Don't set error - this is optional data
          setDetailedAnalytics(null)
        }
      } else {
        // Clear detailed analytics when switching to market tab
        setDetailedAnalytics(null)
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load data'
      setError(errorMessage)
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }

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
        <div className="text-center max-w-md">
          <div className="text-red-600 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-600 mb-2">{error}</p>
          {(!user || !user.companyId) && (
            <p className="text-sm text-gray-500 mb-4">
              User data is incomplete. Please logout and login again.
            </p>
          )}
          <div className="space-x-2">
            <button
              onClick={loadData}
              className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              Retry
            </button>
            {(!user || !user.companyId) && (
              <button
                onClick={() => {
                  localStorage.removeItem('user')
                  localStorage.removeItem('token')
                  window.location.href = '/'
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Go to Login
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const currentData = activeTab === 'company' ? companyData : marketData
  const dataForDashboard = currentData ? {
    summary: currentData.summary,
    salesByRegion: currentData.salesByRegion || []
    // Removed topProducts, topCompanies, and employeePerformance for better performance - moved to Problem Analysis page
  } : null

  // Enhanced KPIs for Pharmacy/Supermarket
  const enhancedSummary = dataForDashboard?.summary ? {
    ...dataForDashboard.summary,
    totalRevenue: dataForDashboard.summary.totalRevenue || 0,
    totalSales: dataForDashboard.summary.totalSales || 0,
    avgSaleAmount: dataForDashboard.summary.avgSaleAmount || 0,
    maxSaleAmount: dataForDashboard.summary.maxSaleAmount || 0
  } : null

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {activeTab === 'company' ? `${user.companyName || 'Company'} Dashboard` : `${user.sector} Market Dashboard`}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {activeTab === 'company' ? 'Your company analytics' : 'Market overview for your sector'}
              </p>
            </div>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('company')}
              className={`px-4 py-2 border-b-2 font-medium ${
                activeTab === 'company'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              🏢 Company Dashboard
            </button>
            <button
              onClick={() => setActiveTab('market')}
              className={`px-4 py-2 border-b-2 font-medium ${
                activeTab === 'market'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📊 Market Dashboard ({user.sector})
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Filters filters={filters} onFilterChange={handleFilterChange} />
        </div>
      </div>

      {/* Main Content */}
      {dataForDashboard && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* KPI Cards - Enhanced for Pharmacy/Supermarket */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Sales</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {dataForDashboard.summary?.totalSales?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="bg-blue-500 rounded-full p-3">
                  <span className="text-2xl">📊</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    ${dataForDashboard.summary?.totalRevenue?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="bg-green-500 rounded-full p-3">
                  <span className="text-2xl">💰</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Average Sale</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    ${(dataForDashboard.summary?.avgSaleAmount || 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-purple-500 rounded-full p-3">
                  <span className="text-2xl">📈</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {activeTab === 'company' ? 'Regions' : 'Total Companies'}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {activeTab === 'company' 
                      ? (dataForDashboard.salesByRegion?.length || 0)
                      : (dataForDashboard.summary?.totalCompanies || 0)
                    }
                  </p>
                </div>
                <div className="bg-orange-500 rounded-full p-3">
                  <span className="text-2xl">🏆</span>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className={`grid gap-6 mt-6 ${activeTab === 'company' && (user.sector === 'pharmacy' || user.sector === 'mall') ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Sales Trends
              </h2>
              <SalesTrendsChart 
                data={dataForDashboard} 
                filters={{
                  ...filters,
                  companyId: activeTab === 'company' ? user.companyId : undefined,
                  sector: activeTab === 'market' ? user.sector : undefined
                }} 
              />
            </div>
            {/* Hide Sales by Region for pharmacy and mall in company tab */}
            {!(activeTab === 'company' && (user.sector === 'pharmacy' || user.sector === 'mall')) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Sales by Region
                </h2>
                <SalesByRegionChart data={dataForDashboard.salesByRegion} />
              </div>
            )}
          </div>

          {/* Top Products Section - For both Company and Market Tabs */}
          {activeTab === 'company' && detailedAnalytics?.topProducts && detailedAnalytics.topProducts.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Top Products (Company)</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <TopProductsChart data={detailedAnalytics.topProducts} />
                </div>
                <div>
                  <TopProductsTable data={detailedAnalytics.topProducts} />
                </div>
              </div>
            </div>
          )}

          {/* Market Top Products Section - For Market Tab */}
          {activeTab === 'market' && marketData?.topProducts && marketData.topProducts.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Top Products (Market)</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <TopProductsChart data={marketData.topProducts} />
                </div>
                <div>
                  <TopProductsTable data={marketData.topProducts} />
                </div>
              </div>
            </div>
          )}

        </main>
      )}
    </div>
  )
}

export default DualDashboard

