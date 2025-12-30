import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { fetchSalesTrends } from '../../services/api'

const SalesTrendsChart = ({ data, filters }) => {
  const [trendsData, setTrendsData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadTrends = async () => {
      try {
        setLoading(true)
        const trends = await fetchSalesTrends({ ...filters, period: 'hour' }) // Changed to 'hour' for testing
        setTrendsData(trends)
      } catch (error) {
        console.error('Error loading trends:', error)
        setTrendsData([])
      } finally {
        setLoading(false)
      }
    }
    loadTrends()
  }, [filters])

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        Loading trends...
      </div>
    )
  }

  const chartData = trendsData.map(item => ({
    name: item._id || 'Unknown',
    revenue: item.totalRevenue || 0,
    sales: item.totalSales || 0
  }))

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="name" 
          angle={-45}
          textAnchor="end"
          height={80}
        />
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
          stroke="#0ea5e9" 
          strokeWidth={2}
          name="Revenue"
        />
        <Line 
          type="monotone" 
          dataKey="sales" 
          stroke="#10b981" 
          strokeWidth={2}
          name="Sales Count"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default SalesTrendsChart

