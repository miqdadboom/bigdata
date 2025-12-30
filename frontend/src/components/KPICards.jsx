const KPICards = ({ summary }) => {
  if (!summary) return null

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  const cards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(summary.totalRevenue || 0),
      icon: '💰',
      color: 'bg-blue-500',
      change: '+12.5%'
    },
    {
      title: 'Total Sales',
      value: formatNumber(summary.totalSales || 0),
      icon: '📊',
      color: 'bg-green-500',
      change: '+8.2%'
    },
    {
      title: 'Average Sale',
      value: formatCurrency(summary.avgSaleAmount || 0),
      icon: '📈',
      color: 'bg-purple-500',
      change: '+3.1%'
    },
    {
      title: 'Active Companies',
      value: 'N/A',
      icon: '🏢',
      color: 'bg-orange-500',
      change: '+5'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <div
          key={index}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{card.title}</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {card.value}
              </p>
              <p className="text-xs text-green-600 mt-1">{card.change}</p>
            </div>
            <div className={`${card.color} rounded-full p-3`}>
              <span className="text-2xl">{card.icon}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default KPICards

