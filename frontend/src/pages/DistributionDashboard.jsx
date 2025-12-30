import { useState, useEffect } from 'react'
import { fetchSectorMarketAnalytics, fetchCompanyAnalytics } from '../services/api'
import api from '../services/api'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const DistributionDashboard = ({ user }) => {
  const [distributionData, setDistributionData] = useState(null)
  const [marketData, setMarketData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false) // Prevent double loading
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    city: ''
  })

  useEffect(() => {
    // Load data on mount and when filters/user changes
    if (user && user.companyId) {
      if (!isLoading) {
        loadData()
      }
    } else {
      // If no user, stop loading
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.startDate, filters.endDate, filters.city, user?.companyId])

  const loadData = async () => {
    if (isLoading) return // Prevent concurrent requests
    
    try {
      setIsLoading(true)
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.city) params.append('city', filters.city)

      // Load Company Data
      const companyResponse = await api.get(`/analytics/company/${user.companyId}?${params.toString()}`)
      setDistributionData(companyResponse.data)

      // Load Market Data (Distribution Sector) - Get pharmacy and mall data
      const pharmacyParams = new URLSearchParams()
      const mallParams = new URLSearchParams()
      if (filters.startDate) {
        pharmacyParams.append('startDate', filters.startDate)
        mallParams.append('startDate', filters.startDate)
      }
      if (filters.endDate) {
        pharmacyParams.append('endDate', filters.endDate)
        mallParams.append('endDate', filters.endDate)
      }
      if (filters.city) {
        pharmacyParams.append('city', filters.city)
        mallParams.append('city', filters.city)
      }

      const [pharmacyMarket, mallMarket] = await Promise.all([
        api.get(`/analytics/sector/pharmacy/market?${pharmacyParams.toString()}`).then(r => r.data).catch(() => null),
        api.get(`/analytics/sector/mall/market?${mallParams.toString()}`).then(r => r.data).catch(() => null)
      ])

      // Combine pharmacy and mall data for distribution view
      const combinedTopProducts = [
        ...(pharmacyMarket?.topProducts || []),
        ...(mallMarket?.topProducts || [])
      ]
        .reduce((acc, product) => {
          const existing = acc.find(p => p.productId === product._id || p.productName === product.productName)
          if (existing) {
            existing.totalQuantity = (existing.totalQuantity || 0) + (product.totalQuantity || 0)
            existing.totalRevenue = (existing.totalRevenue || 0) + (product.totalRevenue || 0)
          } else {
            acc.push({
              productId: product._id,
              productName: product.productName,
              totalQuantity: product.totalQuantity || 0,
              totalRevenue: product.totalRevenue || 0
            })
          }
          return acc
        }, [])
        .sort((a, b) => (b.totalQuantity || 0) - (a.totalQuantity || 0))
        .slice(0, 20)

      // Combine salesByRegion from pharmacy and mall markets
      const combinedSalesByRegion = [
        ...(pharmacyMarket?.salesByRegion || []),
        ...(mallMarket?.salesByRegion || [])
      ]
        .reduce((acc, item) => {
          const existing = acc.find(r => r._id === item._id);
          if (existing) {
            existing.totalRevenue = (existing.totalRevenue || 0) + (item.totalRevenue || 0);
            existing.totalSales = (existing.totalSales || 0) + (item.totalSales || 0);
          } else {
            acc.push({
              _id: item._id,
              totalRevenue: item.totalRevenue || 0,
              totalSales: item.totalSales || 0
            });
          }
          return acc;
        }, [])
        .sort((a, b) => (b.totalSales || 0) - (a.totalSales || 0));

      setMarketData({
        topProducts: combinedTopProducts,
        salesByRegion: combinedSalesByRegion,
        summary: {
          totalCompanies: (pharmacyMarket?.summary?.totalCompanies || 0) + (mallMarket?.summary?.totalCompanies || 0),
          totalRevenue: (pharmacyMarket?.summary?.totalRevenue || 0) + (mallMarket?.summary?.totalRevenue || 0)
        }
      })
    } catch (err) {
      setError(err.message || 'Failed to load data')
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
      setIsLoading(false)
    }
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
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Distribution Analytics Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Most consumed and demanded products across pharmacies and supermarkets
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              ${(distributionData?.summary?.totalRevenue || 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Total Sales</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {distributionData?.summary?.totalSales || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Pharmacies Supplied</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {marketData?.summary?.totalCompanies || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Cities Covered</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {distributionData?.salesByRegion?.length || 0}
            </p>
          </div>
        </div>

        {/* Most Consumed Products */}
        {marketData?.topProducts && marketData.topProducts.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Most Consumed Products
            </h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={marketData.topProducts.slice(0, 15)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="productName" 
                  angle={-45} 
                  textAnchor="end" 
                  height={120}
                />
                <YAxis domain={[0, 30000]} />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'Quantity Sold') {
                      return [`${Math.round(value).toLocaleString()}`, 'Quantity Sold'];
                    } else {
                      return [
                        new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 0,
                        }).format(value),
                        'Revenue'
                      ];
                    }
                  }}
                />
                <Legend />
                <Bar dataKey="totalQuantity" fill="#8884d8" name="Quantity Sold" />
                <Bar dataKey="totalRevenue" fill="#82ca9d" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Distribution by Region - Pie Chart */}
        {marketData?.salesByRegion && marketData.salesByRegion.length > 0 && (() => {
          // Calculate total sales for percentage calculation
          const totalSales = marketData.salesByRegion.reduce((sum, item) => sum + (item.totalSales || 0), 0);
          
          // Prepare data for pie chart with percentages
          const pieData = marketData.salesByRegion
            .filter(item => item._id && item.totalSales > 0)
            .map(item => {
              const percentage = totalSales > 0 ? ((item.totalSales / totalSales) * 100).toFixed(1) : 0;
              return {
                name: item._id || 'Unknown',
                value: item.totalSales,
                revenue: Math.round(item.totalRevenue || 0),
                percentage: parseFloat(percentage)
              };
            });

          // Colors for pie chart segments
          const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#0088fe', '#00c49f', '#ffbb28', '#ff8042'];

          return (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Distribution by Region
              </h2>
              <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name, props) => {
                        if (name === 'value') {
                          return [
                            `${value} sales (${props.payload.percentage}%)`,
                            'Sales Count'
                          ];
                        }
                        return [value, name];
                      }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                              <p className="font-semibold text-gray-800">{data.name}</p>
                              <p className="text-sm text-gray-600">
                                Sales: {data.value} ({data.percentage}%)
                              </p>
                              <p className="text-sm text-gray-600">
                                Revenue: ${data.revenue.toLocaleString()}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      formatter={(value, entry) => {
                        const data = pieData.find(d => d.name === value);
                        return data ? `${value} (${data.percentage}%)` : value;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })()}

        {/* Demand Trends */}
        {marketData?.topProducts && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Product Demand Trends
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Demand Level</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {marketData.topProducts.slice(0, 20).map((product, index) => {
                    const demandLevel = index < 5 ? 'High' : index < 10 ? 'Medium' : 'Low'
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">{product.productName || 'Unknown'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{product.totalQuantity || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          ${(product.totalRevenue || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            demandLevel === 'High' ? 'bg-red-100 text-red-800' :
                            demandLevel === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {demandLevel}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default DistributionDashboard

