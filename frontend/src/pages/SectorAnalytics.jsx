import { useState, useEffect } from 'react'
import { fetchSectorOverview, fetchSectorCompanies, fetchSectorRegions } from '../services/api'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const SECTORS = [
  { value: 'pharmacy', label: 'صيدليات', color: '#8884d8' },
  { value: 'mall', label: 'مولات', color: '#82ca9d' },
  { value: 'distribution', label: 'شركات توزيع', color: '#ffc658' }
]

const SectorAnalytics = () => {
  const [selectedSector, setSelectedSector] = useState('pharmacy')
  const [overview, setOverview] = useState(null)
  const [companies, setCompanies] = useState([])
  const [regions, setRegions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: ''
  })

  useEffect(() => {
    loadData()
  }, [selectedSector, filters])

  const loadData = async () => {
    try {
      setLoading(true)
      const [overviewData, companiesData, regionsData] = await Promise.all([
        fetchSectorOverview(selectedSector, filters),
        fetchSectorCompanies(selectedSector, filters),
        fetchSectorRegions(selectedSector, filters)
      ])
      setOverview(overviewData)
      setCompanies(companiesData.companies || [])
      setRegions(regionsData.regions || [])
    } catch (error) {
      console.error('Error loading sector data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const sectorInfo = SECTORS.find(s => s.value === selectedSector)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sector Analytics</h1>
          <p className="text-gray-600">تحليلات القطاعات - السوق الفلسطيني</p>
        </div>

        {/* Sector Selector */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Sector
          </label>
          <div className="flex space-x-4">
            {SECTORS.map((sector) => (
              <button
                key={sector.value}
                onClick={() => setSelectedSector(sector.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedSector === sector.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {sector.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overview KPIs */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
              <div className="text-2xl font-bold text-gray-900">
                ${(overview.overview?.totalRevenue || 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">Total Sales</div>
              <div className="text-2xl font-bold text-gray-900">
                {(overview.overview?.totalSales || 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">Avg Sale Amount</div>
              <div className="text-2xl font-bold text-gray-900">
                ${(overview.overview?.avgSaleAmount || 0).toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Sales by Region */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Sales by Region</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={regions}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="region" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill={sectorInfo?.color || '#8884d8'} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Trend Chart */}
        {overview?.trend && overview.trend.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Sales Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={overview.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="_id" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke={sectorInfo?.color || '#8884d8'} />
                <Line type="monotone" dataKey="count" stroke="#82ca9d" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Companies Table */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Companies Performance</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales Count</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Sale</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branches</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {companies.map((company, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {company.companyId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${(company.revenue || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {company.salesCount || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${(company.avgSaleAmount || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {company.branchesCount || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SectorAnalytics

