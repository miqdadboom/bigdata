const Filters = ({ filters, onFilterChange }) => {
  const handleChange = (field, value) => {
    onFilterChange({ [field]: value })
  }

  const handleClear = () => {
    onFilterChange({
      startDate: '',
      endDate: '',
      companyId: '',
      region: ''
    })
  }

  // Set default dates (last 30 days)
  const getDefaultStartDate = () => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  }

  const getDefaultEndDate = () => {
    return new Date().toISOString().split('T')[0]
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Start Date
        </label>
        <input
          type="date"
          value={filters.startDate || getDefaultStartDate()}
          onChange={(e) => handleChange('startDate', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          End Date
        </label>
        <input
          type="date"
          value={filters.endDate || getDefaultEndDate()}
          onChange={(e) => handleChange('endDate', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Company ID
        </label>
        <input
          type="text"
          value={filters.companyId || ''}
          onChange={(e) => handleChange('companyId', e.target.value)}
          placeholder="Filter by company"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Region
        </label>
        <input
          type="text"
          value={filters.region || ''}
          onChange={(e) => handleChange('region', e.target.value)}
          placeholder="Filter by region"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div className="md:col-span-4 flex justify-end">
        <button
          onClick={handleClear}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
        >
          Clear Filters
        </button>
      </div>
    </div>
  )
}

export default Filters

