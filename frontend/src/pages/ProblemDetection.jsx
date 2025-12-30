import { useState, useEffect } from 'react'
import { detectCompanyProblems } from '../services/api'

const ProblemDetection = () => {
  const [companyId, setCompanyId] = useState('')
  const [sector, setSector] = useState('pharmacy')
  const [problems, setProblems] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleDetect = async () => {
    if (!companyId || !sector) return

    try {
      setLoading(true)
      const data = await detectCompanyProblems(companyId, sector)
      setProblems(data)
    } catch (error) {
      console.error('Error detecting problems:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'bg-red-100 border-red-500 text-red-800'
      case 'medium': return 'bg-yellow-100 border-yellow-500 text-yellow-800'
      case 'low': return 'bg-blue-100 border-blue-500 text-blue-800'
      default: return 'bg-gray-100 border-gray-500 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Problem Detection</h1>
          <p className="text-gray-600">اكتشاف المشاكل في المبيعات</p>
        </div>

        {/* Input Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              >
                <option value="pharmacy">صيدليات</option>
                <option value="mall">مولات</option>
                <option value="distribution">شركات توزيع</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleDetect}
                disabled={loading || !companyId}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {loading ? 'Detecting...' : 'Detect Problems'}
              </button>
            </div>
          </div>
        </div>

        {/* Problems Display */}
        {problems && (
          <div className="space-y-6">
            {/* Status Card */}
            <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${
              problems.overallStatus === 'healthy' ? 'border-green-500' :
              problems.overallStatus === 'critical' ? 'border-red-500' : 'border-yellow-500'
            }`}>
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">Overall Status</h2>
                  <p className="text-gray-600 capitalize">{problems.overallStatus}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{problems.problemsCount || 0}</div>
                  <div className="text-sm text-gray-500">Problems Found</div>
                </div>
              </div>
            </div>

            {/* Problems List */}
            {problems.problems && problems.problems.length > 0 ? (
              <div className="space-y-4">
                {problems.problems.map((problem, idx) => (
                  <div
                    key={idx}
                    className={`bg-white rounded-lg shadow p-6 border-l-4 ${getSeverityColor(problem.severity)}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-lg">{problem.type.replace('_', ' ').toUpperCase()}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        problem.severity === 'high' ? 'bg-red-200' :
                        problem.severity === 'medium' ? 'bg-yellow-200' : 'bg-blue-200'
                      }`}>
                        {problem.severity}
                      </span>
                    </div>
                    <p className="text-gray-700 mb-2">{problem.description}</p>
                    <div className="mt-3 p-3 bg-white rounded border">
                      <p className="text-sm font-medium text-gray-700">Recommendation:</p>
                      <p className="text-sm text-gray-600">{problem.recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <p className="text-green-800 font-medium">✅ No problems detected! Company is performing well.</p>
              </div>
            )}

            {/* Comparison Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold mb-4">Current Period</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Revenue:</span>
                    <span className="font-semibold">${(problems.currentPeriod?.revenue || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sales Count:</span>
                    <span className="font-semibold">{(problems.currentPeriod?.salesCount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Sale:</span>
                    <span className="font-semibold">${(problems.currentPeriod?.avgSaleAmount || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold mb-4">Market Average</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Revenue:</span>
                    <span className="font-semibold">${(problems.marketAverage?.revenue || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sales Count:</span>
                    <span className="font-semibold">{(problems.marketAverage?.salesCount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Sale:</span>
                    <span className="font-semibold">${(problems.marketAverage?.avgSaleAmount || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProblemDetection

