import { useState } from 'react'
import { analyzeCompanyRootCause } from '../services/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const RootCauseAnalysis = () => {
  const [companyId, setCompanyId] = useState('')
  const [sector, setSector] = useState('pharmacy')
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleAnalyze = async () => {
    if (!companyId || !sector) return

    try {
      setLoading(true)
      const data = await analyzeCompanyRootCause(companyId, sector)
      setAnalysis(data)
    } catch (error) {
      console.error('Error analyzing root cause:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Root Cause Analysis</h1>
          <p className="text-gray-600">تحليل الأسباب الجذرية للمشاكل</p>
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
                onClick={handleAnalyze}
                disabled={loading || !companyId}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {loading ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
          </div>
        </div>

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Analysis Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded">
                  <div className="text-2xl font-bold text-gray-900">{analysis.summary?.totalRootCauses || 0}</div>
                  <div className="text-sm text-gray-600">Total Root Causes</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded">
                  <div className="text-2xl font-bold text-red-600">{analysis.summary?.criticalIssues || 0}</div>
                  <div className="text-sm text-gray-600">Critical Issues</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded">
                  <div className="text-2xl font-bold text-blue-600">{analysis.summary?.recommendations?.length || 0}</div>
                  <div className="text-sm text-gray-600">Recommendations</div>
                </div>
              </div>
            </div>

            {/* Root Causes */}
            {analysis.rootCauses && analysis.rootCauses.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Root Causes</h2>
                {analysis.rootCauses.map((cause, idx) => (
                  <div
                    key={idx}
                    className={`bg-white rounded-lg shadow p-6 border-l-4 ${
                      cause.severity === 'high' ? 'border-red-500' :
                      cause.severity === 'medium' ? 'border-yellow-500' : 'border-blue-500'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-lg">{cause.type.replace('_', ' ').toUpperCase()}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        cause.severity === 'high' ? 'bg-red-100 text-red-800' :
                        cause.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {cause.severity}
                      </span>
                    </div>
                    <p className="text-gray-700 mb-3">{cause.description}</p>
                    {cause.details && (
                      <div className="bg-gray-50 rounded p-3 mb-3">
                        <p className="text-sm font-medium mb-1">Details:</p>
                        <pre className="text-xs text-gray-600 overflow-x-auto">
                          {JSON.stringify(cause.details, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className="bg-blue-50 rounded p-3">
                      <p className="text-sm font-medium text-blue-900 mb-1">Recommendation:</p>
                      <p className="text-sm text-blue-800">{cause.recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Brand Analysis Chart */}
            {analysis.analysis?.brands && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Brand Analysis</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium mb-2">Company Top Brands</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analysis.analysis.brands.company?.slice(0, 5) || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="_id" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="revenue" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Market Top Brands</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analysis.analysis.brands.market?.slice(0, 5) || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="_id" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="revenue" fill="#82ca9d" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Recommendations */}
            {analysis.summary?.recommendations && analysis.summary.recommendations.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">All Recommendations</h2>
                <ul className="space-y-2">
                  {analysis.summary.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="mr-2 text-primary-600">•</span>
                      <span className="text-gray-700">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default RootCauseAnalysis

