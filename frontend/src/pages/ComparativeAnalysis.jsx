import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { compareCompanyVsMarket, compareCompanyVsRegion, compareCompanyTrend, fetchSectorMarketAnalytics, fetchTopProducts } from '../services/api'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// Palestinian cities by region
const palestinianCities = {
  'north westbank': ['رام الله', 'نابلس', 'جنين', 'طولكرم', 'قلقيلية', 'سلفيت', 'طوباس', 'بيت جالا', 'بيت ساحور'],
  'south westbank': ['الخليل', 'بيت لحم', 'أريحا'],
  'gaza': ['غزة', 'خان يونس', 'رفح', 'دير البلح', 'جباليا', 'بيت لاهيا', 'النصيرات', 'البريج', 'المغازي']
}

const timePeriods = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' }
]

const ComparativeAnalysis = () => {
  const location = useLocation()
  const user = location.state?.user || JSON.parse(localStorage.getItem('user') || 'null')
  
  const [companyId, setCompanyId] = useState(user?.companyId || '')
  const [sector, setSector] = useState(user?.sector || 'pharmacy')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('north westbank')
  const [timePeriod, setTimePeriod] = useState('week')
  const [marketComparison, setMarketComparison] = useState(null)
  const [regionComparison, setRegionComparison] = useState(null)
  const [trend, setTrend] = useState(null)
  const [topProductsComparison, setTopProductsComparison] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (companyId && sector) {
      handleCompare()
    }
  }, [companyId, sector, selectedCity, timePeriod])

  const handleCompare = async () => {
    if (!companyId || !sector) return

    try {
      setLoading(true)
      
      // Calculate date range based on time period
      const endDate = new Date()
      const startDate = new Date()
      switch (timePeriod) {
        case 'day':
          startDate.setDate(startDate.getDate() - 7) // Last 7 days
          break
        case 'week':
          startDate.setDate(startDate.getDate() - 30) // Last 30 days
          break
        case 'month':
          startDate.setMonth(startDate.getMonth() - 6) // Last 6 months
          break
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1) // Last year
          break
      }

      const filters = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      }

      const [market, regionData, trendData, marketData, companyProducts] = await Promise.all([
        compareCompanyVsMarket(companyId, sector, filters),
        selectedCity ? compareCompanyVsRegion(companyId, sector, selectedCity, filters) : Promise.resolve(null),
        compareCompanyTrend(companyId, sector, { ...filters, period: timePeriod }),
        fetchSectorMarketAnalytics(sector, filters),
        fetchTopProducts({ ...filters, companyId })
      ])
      
      setMarketComparison(market)
      setRegionComparison(regionData)
      setTrend(trendData)
      
      // Merge Company and Market Products for comparison
      const marketProducts = marketData?.topProducts || []
      const companyTopProducts = companyProducts?.products || []
      
      // Calculate total revenue for percentage calculation
      const companyTotalRevenue = companyTopProducts.reduce((sum, p) => sum + (p.totalRevenue || 0), 0)
      const marketTotalRevenue = marketData?.summary?.totalRevenue || marketProducts.reduce((sum, p) => sum + (p.totalRevenue || 0), 0)
      
      // Create a map of product names to merge data
      const productMap = new Map()
      
      // Add market products
      marketProducts.forEach(product => {
        const revenue = product.totalRevenue || 0
        productMap.set(product.productName || product._id, {
          productName: product.productName || product._id,
          marketRevenue: revenue,
          marketPercentage: marketTotalRevenue > 0 ? (revenue / marketTotalRevenue) * 100 : 0,
          companyRevenue: 0,
          companyPercentage: 0
        })
      })
      
      // Add/update with company products
      companyTopProducts.forEach(product => {
        const key = product.productName || product._id
        const revenue = product.totalRevenue || 0
        if (productMap.has(key)) {
          productMap.get(key).companyRevenue = revenue
          productMap.get(key).companyPercentage = companyTotalRevenue > 0 ? (revenue / companyTotalRevenue) * 100 : 0
        } else {
          productMap.set(key, {
            productName: product.productName || product._id,
            marketRevenue: 0,
            marketPercentage: 0,
            companyRevenue: revenue,
            companyPercentage: companyTotalRevenue > 0 ? (revenue / companyTotalRevenue) * 100 : 0
          })
        }
      })
      
      // Convert to array and sort by market revenue
      const mergedProducts = Array.from(productMap.values())
        .sort((a, b) => b.marketRevenue - a.marketRevenue)
        .slice(0, 10)
      
      setTopProductsComparison(mergedProducts)
    } catch (error) {
      console.error('Error comparing:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Comparative Analysis</h1>
          <p className="text-gray-600">مقارنة شركة مع السوق والمنطقة</p>
        </div>

        {/* Input Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company ID
              </label>
              <input
                type="text"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="pharmacy_001"
                disabled={!!user?.companyId}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sector
              </label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={!!user?.sector}
              >
                <option value="pharmacy">صيدليات</option>
                <option value="mall">مولات</option>
                <option value="distribution">شركات توزيع</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Region
              </label>
              <select
                value={selectedRegion}
                onChange={(e) => {
                  setSelectedRegion(e.target.value)
                  setSelectedCity('')
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="north westbank">شمال الضفة</option>
                <option value="south westbank">جنوب الضفة</option>
                <option value="gaza">غزة</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City (للمقارنة)
              </label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">All Cities</option>
                {palestinianCities[selectedRegion]?.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Period
              </label>
              <select
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {timePeriods.map(period => (
                  <option key={period.value} value={period.value}>{period.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Market Comparison */}
        {marketComparison && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Company vs Market</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-2">Company Performance</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Revenue:</span>
                    <span className="font-semibold">${(marketComparison.company?.revenue || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sales Count:</span>
                    <span className="font-semibold">{(marketComparison.company?.salesCount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Sale:</span>
                    <span className="font-semibold">${(marketComparison.company?.avgSaleAmount || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">Comparison</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Market Share:</span>
                    <span className="font-semibold">{marketComparison.comparison?.marketShare || 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">vs Market Avg:</span>
                    <span className={`font-semibold ${
                      (marketComparison.comparison?.revenueVsMarketAvg || 0) > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {marketComparison.comparison?.revenueVsMarketAvg || 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Performance:</span>
                    <span className={`font-semibold ${
                      marketComparison.comparison?.performance === 'above_average' ? 'text-green-600' :
                      marketComparison.comparison?.performance === 'below_average' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {marketComparison.comparison?.performance || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trend Chart */}
        {trend && trend.companyTrend && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Company vs Market Trend ({timePeriods.find(p => p.value === timePeriod)?.label})</h2>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={trend.companyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="_id" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip 
                  formatter={(value) => [
                    new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: 0,
                    }).format(value),
                    ''
                  ]}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  name="Company Revenue" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                />
                {trend.marketTrend && (
                  <Line 
                    type="monotone" 
                    data={trend.marketTrend}
                    dataKey="avgRevenue" 
                    name="Market Avg Revenue" 
                    stroke="#82ca9d" 
                    strokeWidth={2}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Products Comparison */}
        {topProductsComparison && topProductsComparison.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Top Products Comparison - Market vs Your Store</h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topProductsComparison.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="productName" 
                  angle={-45} 
                  textAnchor="end" 
                  height={120}
                />
                <YAxis 
                  label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }}
                  domain={[0, 100]}
                />
                <Tooltip 
                  formatter={(value, name, props) => {
                    const isPercentage = name.includes('Percentage')
                    const revenue = name.includes('Company') ? props.payload.companyRevenue : props.payload.marketRevenue
                    return [
                      `${value.toFixed(1)}% ($${revenue?.toLocaleString() || 0})`,
                      isPercentage ? 'Percentage' : name
                    ]
                  }}
                />
                <Legend />
                <Bar dataKey="companyPercentage" fill="#8884d8" name="Company %" />
                <Bar dataKey="marketPercentage" fill="#82ca9d" name="Market %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

export default ComparativeAnalysis

