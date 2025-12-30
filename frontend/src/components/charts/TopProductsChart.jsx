import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const TopProductsChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No data available
      </div>
    )
  }

  const chartData = data.slice(0, 10).map(item => ({
    name: item.productName?.substring(0, 20) || 'Unknown',
    quantity: item.totalQuantity || 0,
    revenue: item.totalRevenue || 0
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="name" 
          angle={-45}
          textAnchor="end"
          height={100}
        />
        <YAxis domain={[0, 5000]} />
        <Tooltip 
          formatter={(value, name, props) => {
            // In recharts, the formatter receives: (value, name, props)
            // props.payload contains the full data object
            // We need to check which Bar this is from
            const dataKey = props?.dataKey || name;
            
            if (dataKey === 'revenue') {
              return [
                new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  minimumFractionDigits: 0,
                }).format(value),
                'Revenue'
              ]
            }
            if (dataKey === 'quantity') {
              return [value, 'Quantity']
            }
            return [value, name]
          }}
          labelFormatter={(label) => `Product: ${label}`}
        />
        <Legend />
        <Bar dataKey="quantity" fill="#3b82f6" name="Quantity" />
        <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default TopProductsChart

