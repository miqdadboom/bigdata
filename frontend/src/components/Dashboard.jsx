import { useState } from 'react'
import KPICards from './KPICards'
import SalesTrendsChart from './charts/SalesTrendsChart'
import TopProductsChart from './charts/TopProductsChart'
import SalesByRegionChart from './charts/SalesByRegionChart'
import EmployeePerformanceTable from './tables/EmployeePerformanceTable'
import TopProductsTable from './tables/TopProductsTable'
import Filters from './Filters'

const Dashboard = ({ data, filters, onFilterChange, onRefresh }) => {
  if (!data) {
    return (
      <div className="p-8 text-center text-gray-500">
        No data available
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Big Data Sales Analysis Dashboard
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Real-time analytics and insights
              </p>
            </div>
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Filters filters={filters} onFilterChange={onFilterChange} />
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPI Cards */}
        <KPICards summary={data.summary} />

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Sales Trends
            </h2>
            <SalesTrendsChart data={data} filters={filters} />
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Sales by Region
            </h2>
            <SalesByRegionChart data={data.salesByRegion} />
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Top Products
            </h2>
            <TopProductsChart data={data.topProducts} />
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Top Products Table
            </h2>
            <TopProductsTable data={data.topProducts} />
          </div>
        </div>

        {/* Tables Row */}
        <div className="grid grid-cols-1 gap-6 mt-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Employee Performance
            </h2>
            <EmployeePerformanceTable data={data.employeePerformance} />
          </div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard

