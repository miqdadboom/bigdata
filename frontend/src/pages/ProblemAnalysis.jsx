import { useState, useEffect } from 'react'
import { useAnalytics } from '../contexts/AnalyticsContext'
import { detectCompanyProblems, analyzeCompanyRootCause, fetchCompanyDetailedAnalytics } from '../services/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import EmployeePerformanceTable from '../components/tables/EmployeePerformanceTable'

const ProblemAnalysis = () => {
  // Use Analytics Context for cached data
  const { analyticsData, loading: contextLoading, refreshAnalytics } = useAnalytics()
  
  // Get user data from localStorage
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user')
    return savedUser ? JSON.parse(savedUser) : null
  })

  // Use cached data from context if available, otherwise use local state
  const [problems, setProblems] = useState(analyticsData?.problemDetection || null)
  const [analysis, setAnalysis] = useState(analyticsData?.rootCauseAnalysis || null)
  const [detailedAnalytics, setDetailedAnalytics] = useState(analyticsData?.companyDetailed || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false) // Prevent double loading
  const [activeTab, setActiveTab] = useState('problems') // 'problems' or 'rootCause'

  // Update local state when context data changes
  useEffect(() => {
    if (analyticsData?.problemDetection) {
      setProblems(analyticsData.problemDetection)
    }
    if (analyticsData?.rootCauseAnalysis) {
      setAnalysis(analyticsData.rootCauseAnalysis)
    }
    if (analyticsData?.companyDetailed) {
      setDetailedAnalytics(analyticsData.companyDetailed)
    }
  }, [analyticsData])

  // Auto-load data when page opens (if not already in context)
  useEffect(() => {
    if (!user?.companyId || !user?.sector) return

    // Check if we have valid data in context
    const hasValidData = analyticsData?.problemDetection && 
                        analyticsData?.rootCauseAnalysis && 
                        analyticsData?.companyDetailed &&
                        analyticsData.problemDetection.success !== false &&
                        analyticsData.rootCauseAnalysis.success !== false
    
    // If we have valid data, no need to load
    if (hasValidData) {
      setLoading(false)
      setIsLoading(false)
      return
    }

    // If context is already loading, wait for it (but don't set local loading to true)
    if (contextLoading) {
      return
    }

    // If no data exists and not currently loading, trigger refresh
    // This will load data automatically when page opens
    if (!isLoading && !loading) {
      refreshAnalytics(user.companyId, user.sector).catch(err => {
        console.error('Error auto-loading analytics:', err)
        setError('Failed to load analysis data. Please try refreshing.')
        setLoading(false)
        setIsLoading(false)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.companyId, user?.sector, analyticsData, contextLoading])

  const loadData = async () => {
    if (!user || !user.companyId || isLoading) return // Prevent concurrent requests

    const startTime = performance.now();
    const requestId = `${user.companyId}_${user.sector}_${Date.now()}`;
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[Frontend] 🚀 Problem Analysis - START Loading`);
    console.log(`[Frontend] Request ID: ${requestId}`);
    console.log(`[Frontend] Company: ${user.companyId}, Sector: ${user.sector}`);
    console.log(`[Frontend] Timestamp: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(80)}\n`);

    try {
      setIsLoading(true)
      setLoading(true)
      setError(null)
      
      // Get companyId and sector from user
      const companyId = user.companyId
      const sector = user.sector || 'pharmacy'

      // Load all analytics data with individual error handling
      const apiCallsStartTime = performance.now();
      const [problemsData, analysisData, detailedData] = await Promise.allSettled([
        (async () => {
          const startTime = performance.now();
          console.log(`[Frontend] ⏱️  API Call 1: detectCompanyProblems - START`);
          try {
            const result = await detectCompanyProblems(companyId, sector);
            const duration = performance.now() - startTime;
            console.log(`[Frontend] ⏱️  API Call 1: detectCompanyProblems - COMPLETE - Duration: ${duration.toFixed(2)}ms`);
            return result;
          } catch (err) {
            const duration = performance.now() - startTime;
            console.error(`[Frontend] ❌ API Call 1: detectCompanyProblems - ERROR after ${duration.toFixed(2)}ms:`, err);
            throw err;
          }
        })(),
        (async () => {
          const startTime = performance.now();
          console.log(`[Frontend] ⏱️  API Call 2: analyzeCompanyRootCause - START`);
          try {
            const result = await analyzeCompanyRootCause(companyId, sector);
            const duration = performance.now() - startTime;
            console.log(`[Frontend] ⏱️  API Call 2: analyzeCompanyRootCause - COMPLETE - Duration: ${duration.toFixed(2)}ms`);
            return result;
          } catch (err) {
            const duration = performance.now() - startTime;
            console.error(`[Frontend] ❌ API Call 2: analyzeCompanyRootCause - ERROR after ${duration.toFixed(2)}ms:`, err);
            throw err;
          }
        })(),
        (async () => {
          const startTime = performance.now();
          console.log(`[Frontend] ⏱️  API Call 3: fetchCompanyDetailedAnalytics - START`);
          try {
            const result = await fetchCompanyDetailedAnalytics(companyId);
            const duration = performance.now() - startTime;
            console.log(`[Frontend] ⏱️  API Call 3: fetchCompanyDetailedAnalytics - COMPLETE - Duration: ${duration.toFixed(2)}ms`);
            return result;
          } catch (err) {
            const duration = performance.now() - startTime;
            console.error(`[Frontend] ❌ API Call 3: fetchCompanyDetailedAnalytics - ERROR after ${duration.toFixed(2)}ms:`, err);
            throw err;
          }
        })()
      ]).then(results => {
        const apiCallsDuration = performance.now() - apiCallsStartTime;
        console.log(`[Frontend] ⏱️  All API Calls - Total Duration: ${apiCallsDuration.toFixed(2)}ms`);
        
        return results.map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value
          } else {
            // Handle rejected promises
            const error = result.reason
            if (index === 0) {
              // Problem Detection failed
              return { success: false, error: error.message, problems: [] }
            } else if (index === 1) {
              // Root Cause Analysis failed
              return { success: false, error: error.message, analysis: null, rootCauses: [] }
            } else {
              // Detailed Analytics failed
              return { topProducts: [], employeePerformance: [] }
            }
          }
        });
      })

      // Handle problems data
      if (problemsData.success === false) {
        const errorMsg = problemsData.error || 'Unknown error'
        // Only show timeout errors if it's actually a timeout
        if (errorMsg.includes('timeout') || errorMsg.includes('Request timeout')) {
          setError(prev => {
            const newError = 'Problem Detection is taking longer than expected. The analysis is still processing in the background. Please wait or try refreshing later.'
            if (prev && prev.includes('Problem Detection')) {
              return prev.replace(/Problem Detection.*?(\n|$)/g, '').trim() + (prev.trim() ? '\n' : '') + newError
            }
            return newError
          })
        } else {
          const fullErrorMsg = `Problem Detection Error: ${errorMsg}`
          setError(prev => prev && !prev.includes('Problem Detection') ? `${prev}\n${fullErrorMsg}` : fullErrorMsg)
        }
      } else if (problemsData.success !== false) {
        setProblems(problemsData)
        setError(prev => {
          if (prev && prev.includes('Problem Detection')) {
            return prev.replace(/Problem Detection.*?(\n|$)/g, '').trim() || null
          }
          return prev
        })
      }

      // Handle analysis data
      if (analysisData.success === false) {
        const errorMsg = analysisData.error || 'Unknown error'
        // Only show timeout errors if it's actually a timeout
        if (errorMsg.includes('timeout') || errorMsg.includes('Request timeout')) {
          setError(prev => {
            const newError = 'Root Cause Analysis is taking longer than expected. The analysis is still processing in the background. Please wait or try refreshing later.'
            if (prev && prev.includes('Root Cause Analysis')) {
              return prev.replace(/Root Cause Analysis.*?(\n|$)/g, '').trim() + (prev.trim() ? '\n' : '') + newError
            }
            return newError
          })
        } else {
          const fullErrorMsg = `Root Cause Analysis Error: ${errorMsg}`
          setError(prev => prev && !prev.includes('Root Cause Analysis') ? `${prev}\n${fullErrorMsg}` : fullErrorMsg)
        }
      } else if (analysisData.success !== false) {
        setAnalysis(analysisData)
        setError(prev => {
          if (prev && prev.includes('Root Cause Analysis')) {
            return prev.replace(/Root Cause Analysis.*?(\n|$)/g, '').trim() || null
          }
          return prev
        })
      }

      // Handle detailed analytics
      if (detailedData) {
        setDetailedAnalytics(detailedData)
      }

      // Update context with new data
      await refreshAnalytics(companyId, sector)

      // If all succeeded, clear all errors
      if (problemsData.success !== false && analysisData.success !== false) {
        setError(null)
      }
      
      const totalDuration = performance.now() - startTime;
      console.log(`\n${'='.repeat(80)}`);
      console.log(`[Frontend] ✅ Problem Analysis - COMPLETE Loading`);
      console.log(`[Frontend] Request ID: ${requestId}`);
      console.log(`[Frontend] ⏱️  TOTAL DURATION: ${totalDuration.toFixed(2)}ms (${(totalDuration/1000).toFixed(2)}s)`);
      console.log(`${'='.repeat(80)}\n`);
    } catch (error) {
      const totalDuration = performance.now() - startTime;
      console.error(`\n${'='.repeat(80)}`);
      console.error(`[Frontend] ❌ Problem Analysis - ERROR Loading`);
      console.error(`[Frontend] Request ID: ${requestId}`);
      console.error(`[Frontend] ⏱️  FAILED AFTER: ${totalDuration.toFixed(2)}ms (${(totalDuration/1000).toFixed(2)}s)`);
      console.error(`[Frontend] Error:`, error);
      console.error(`${'='.repeat(80)}\n`);
      setError(`Failed to load analysis: ${error.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
      setIsLoading(false)
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

  if (!user || !user.companyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-600">User data incomplete. Please login again.</p>
          <button
            onClick={() => {
              localStorage.removeItem('user')
              localStorage.removeItem('token')
              window.location.href = '/'
            }}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Problem Analysis</h1>
          <p className="text-gray-600">اكتشاف وتحليل المشاكل في المبيعات</p>
          <p className="text-sm text-gray-500 mt-1">
            Company: {user.companyName || user.companyId} | Sector: {user.sector}
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('problems')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'problems'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🔍 Problem Detection
              </button>
              <button
                onClick={() => setActiveTab('rootCause')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'rootCause'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🔬 Root Cause Analysis
              </button>
            </nav>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="mb-6 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {analyticsData?.lastUpdated && (
              <span>Last updated: {new Date(analyticsData.lastUpdated).toLocaleString()}</span>
            )}
          </div>
          <button
            onClick={async () => {
              if (!user?.companyId || !user?.sector) return
              try {
                setLoading(true)
                await refreshAnalytics(user.companyId, user.sector)
                // Wait a bit for context to update
                setTimeout(() => {
                  setLoading(false)
                }, 100)
              } catch (err) {
                console.error('Error refreshing analytics:', err)
                setError(err.message)
                setLoading(false)
              }
            }}
            disabled={loading || contextLoading}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            {loading || contextLoading ? 'Loading...' : '🔄 Refresh Analysis'}
          </button>
        </div>

        {loading && (
          <div className="bg-white rounded-lg shadow p-8 mb-6 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4"></div>
            <p className="text-gray-600">Loading analysis... This may take a while if there's a lot of data.</p>
          </div>
        )}

        {/* Error Message */}
        {error && !loading && (
          <div className={`border rounded-lg p-4 mb-6 ${
            error.includes('taking longer') || error.includes('still processing')
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start">
              <span className={`mr-2 text-xl ${
                error.includes('taking longer') || error.includes('still processing')
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}>
                {error.includes('taking longer') || error.includes('still processing') ? '⏳' : '⚠️'}
              </span>
              <div className="flex-1">
                <h3 className={`font-semibold mb-2 ${
                  error.includes('taking longer') || error.includes('still processing')
                    ? 'text-yellow-800'
                    : 'text-red-800'
                }`}>
                  {error.includes('taking longer') || error.includes('still processing')
                    ? 'Analysis in Progress'
                    : 'Error Loading Analysis'}
                </h3>
                <p className={`text-sm whitespace-pre-line ${
                  error.includes('taking longer') || error.includes('still processing')
                    ? 'text-yellow-700'
                    : 'text-red-600'
                }`}>
                  {error}
                </p>
                {!error.includes('taking longer') && !error.includes('still processing') && (
                  <p className="text-red-500 text-xs mt-2">
                    Possible causes:
                    <br />• No sales data in MongoDB for this company/sector
                    <br />• Backend server is slow or timing out
                    <br />• Check browser console and backend logs for details
                  </p>
                )}
                {!error.includes('taking longer') && !error.includes('still processing') && (
                  <button
                    onClick={() => {
                      setError(null);
                      loadData();
                    }}
                    className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Problem Detection Tab */}
        {activeTab === 'problems' && problems && (
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
                    <p className="text-gray-700 mb-4">{problem.description}</p>
                    
                    {/* Metrics if available */}
                    {problem.metrics && (
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 mb-4 border border-gray-200">
                        <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                          <span className="mr-2">📊</span>
                          Key Metrics
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {Object.entries(problem.metrics).map(([key, value]) => {
                            const formattedKey = key
                              .replace(/([A-Z])/g, ' $1')
                              .replace(/^./, str => str.toUpperCase())
                              .trim();
                            
                            let formattedValue = value;
                            if (typeof value === 'number') {
                              if (key.toLowerCase().includes('revenue')) {
                                // Revenue: no decimal places (whole numbers)
                                formattedValue = `$${Math.round(value).toLocaleString()}`;
                              } else if (key.toLowerCase().includes('price') || key.toLowerCase().includes('sale')) {
                                // Price and Sale Amount: 2 decimal places
                                formattedValue = `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                              } else if (key.toLowerCase().includes('count') || key.toLowerCase().includes('sales')) {
                                formattedValue = value.toLocaleString();
                              } else {
                                formattedValue = value.toLocaleString();
                              }
                            }
                            
                            return (
                              <div key={key} className="bg-white rounded-md p-3 shadow-sm border border-gray-200">
                                <div className="text-xs font-medium text-gray-500 mb-1">{formattedKey}</div>
                                <div className="text-sm font-semibold text-gray-900">{formattedValue}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* Recommendation Section - Improved Design */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border-l-4 border-blue-500">
                      <p className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                        <span className="mr-2">💡</span>
                        Recommendation
                      </p>
                      <div className="text-sm text-blue-800 leading-relaxed">
                        {problem.recommendation.includes(')') ? (
                          // Split by numbered list items (1), 2), etc.)
                          problem.recommendation.split(/(?=\d+\))/).map((part, idx) => {
                            if (part.trim()) {
                              return (
                                <p key={idx} className="mb-2 pl-4 relative">
                                  {idx > 0 && <span className="absolute left-0 text-blue-600 font-bold">•</span>}
                                  {part.trim()}
                                </p>
                              );
                            }
                            return null;
                          })
                        ) : (
                          // If no numbered list, split by periods or display as is
                          problem.recommendation.split('. ').filter(p => p.trim()).map((part, idx, arr) => (
                            <p key={idx} className="mb-2">
                              {part.trim()}{idx < arr.length - 1 ? '.' : ''}
                            </p>
                          ))
                        )}
                      </div>
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
                    <span className="font-semibold">${Math.round(problems.currentPeriod?.revenue || 0).toLocaleString()}</span>
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
                    <span className="font-semibold">${Math.round(problems.marketAverage?.revenue || 0).toLocaleString()}</span>
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

        {/* Root Cause Analysis Tab */}
        {activeTab === 'rootCause' && !loading && (
          <div className="space-y-6">
            {!analysis || (analysis.success === false) ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-500">
                  {contextLoading || loading 
                    ? 'Loading root cause analysis...' 
                    : 'No root cause analysis data available. Data will load automatically, or click "Refresh Analysis" to reload.'}
                </p>
              </div>
            ) : (
              <>
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
                    <p className="text-gray-700 mb-4">{cause.description}</p>
                    
                    {/* Details Section - Improved Design */}
                    {cause.details && (
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 mb-4 border border-gray-200">
                        <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                          <span className="mr-2">📊</span>
                          Key Metrics
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {Object.entries(cause.details).map(([key, value]) => {
                            // Skip complex nested objects that are arrays of objects
                            if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
                              return null; // Skip arrays of objects
                            }
                            
                            // Format key for display
                            const formattedKey = key
                              .replace(/([A-Z])/g, ' $1')
                              .replace(/^./, str => str.toUpperCase())
                              .trim();
                            
                            // Format value based on type
                            let formattedValue = value;
                            if (value === null || value === undefined) {
                              formattedValue = 'N/A';
                            } else if (typeof value === 'number') {
                              if (key.toLowerCase().includes('revenue')) {
                                // Revenue: no decimal places (whole numbers)
                                formattedValue = `$${Math.round(value).toLocaleString()}`;
                              } else if (key.toLowerCase().includes('price') || key.toLowerCase().includes('sale')) {
                                // Price and Sale Amount: 2 decimal places
                                formattedValue = `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                              } else if (key.toLowerCase().includes('count') || key.toLowerCase().includes('sales') || key.toLowerCase().includes('employee')) {
                                formattedValue = value.toLocaleString();
                              } else if (key.toLowerCase().includes('difference') || key.toLowerCase().includes('diff') || key.toLowerCase().includes('%')) {
                                formattedValue = typeof value === 'string' ? value : `${value}%`;
                              } else {
                                formattedValue = value.toLocaleString(undefined, { maximumFractionDigits: 2 });
                              }
                            } else if (typeof value === 'string') {
                              formattedValue = value;
                            } else if (typeof value === 'object' && value !== null) {
                              // Handle nested objects (like priceRange)
                              if (value.min !== undefined && value.max !== undefined) {
                                formattedValue = `$${value.min.toFixed(2)} - $${value.max.toFixed(2)}`;
                              } else if (Array.isArray(value)) {
                                formattedValue = value.length > 0 ? value.slice(0, 3).join(', ') + (value.length > 3 ? '...' : '') : 'N/A';
                              } else {
                                // For other objects, show key-value pairs
                                const objEntries = Object.entries(value).slice(0, 2);
                                formattedValue = objEntries.map(([k, v]) => `${k}: ${v}`).join(', ');
                              }
                            }
                            
                            return (
                              <div key={key} className="bg-white rounded-md p-3 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                <div className="text-xs font-medium text-gray-500 mb-1">{formattedKey}</div>
                                <div className="text-sm font-semibold text-gray-900 break-words">{formattedValue}</div>
                              </div>
                            );
                          }).filter(Boolean)}
                        </div>
                      </div>
                    )}
                    
                    {/* Recommendation Section - Improved Design */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border-l-4 border-blue-500">
                      <p className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                        <span className="mr-2">💡</span>
                        Recommendation
                      </p>
                      <div className="text-sm text-blue-800 leading-relaxed">
                        {cause.recommendation.includes(')') ? (
                          // Split by numbered list items (1), 2), etc.)
                          cause.recommendation.split(/(?=\d+\))/).map((part, idx) => {
                            if (part.trim()) {
                              return (
                                <p key={idx} className="mb-2 pl-4 relative">
                                  {idx > 0 && <span className="absolute left-0 text-blue-600 font-bold">•</span>}
                                  {part.trim()}
                                </p>
                              );
                            }
                            return null;
                          })
                        ) : (
                          // If no numbered list, split by periods or display as is
                          cause.recommendation.split('. ').filter(p => p.trim()).map((part, idx, arr) => (
                            <p key={idx} className="mb-2">
                              {part.trim()}{idx < arr.length - 1 ? '.' : ''}
                            </p>
                          ))
                        )}
                      </div>
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
                    {analysis.analysis.brands.company && analysis.analysis.brands.company.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={analysis.analysis.brands.company.slice(0, 5)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="_id" 
                            angle={-45}
                            textAnchor="end"
                            height={60}
                            interval={0}
                          />
                          <YAxis 
                            label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }}
                            domain={[0, 100]}
                          />
                          <Tooltip 
                            formatter={(value, name, props) => [
                              `${value.toFixed(1)}% ($${props.payload.revenue?.toLocaleString() || 0})`,
                              'Percentage'
                            ]}
                            labelFormatter={(label) => `Brand: ${label}`}
                          />
                          <Bar dataKey="percentage" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-gray-400 border-2 border-dashed rounded">
                        No brand data available
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Market Top Brands</h3>
                    {analysis.analysis.brands.market && analysis.analysis.brands.market.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={analysis.analysis.brands.market.slice(0, 5)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="_id" 
                            angle={-45}
                            textAnchor="end"
                            height={60}
                            interval={0}
                          />
                          <YAxis 
                            label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }}
                            domain={[0, 100]}
                          />
                          <Tooltip 
                            formatter={(value, name, props) => [
                              `${value.toFixed(1)}% ($${props.payload.revenue?.toLocaleString() || 0})`,
                              'Percentage'
                            ]}
                            labelFormatter={(label) => `Brand: ${label}`}
                          />
                          <Bar dataKey="percentage" fill="#82ca9d" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-gray-400 border-2 border-dashed rounded">
                        No market brand data available
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Employee Performance Analysis Chart */}
            {analysis.analysis?.employees && analysis.analysis.employees.company && analysis.analysis.employees.company.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Employee Performance Analysis</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium mb-2">Company Top Employees</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analysis.analysis.employees.company.slice(0, 5)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="employeeName" 
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          interval={0}
                        />
                        <YAxis 
                          label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }}
                          domain={[0, 100]}
                        />
                        <Tooltip 
                          formatter={(value, name, props) => [
                            `${value.toFixed(1)}% ($${props.payload.revenue?.toLocaleString() || 0})`,
                            'Percentage'
                          ]}
                          labelFormatter={(label) => `Employee: ${label}`}
                        />
                        <Bar dataKey="percentage" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Market Average</h3>
                    <div className="h-[200px] flex flex-col justify-center items-center bg-gray-50 rounded-lg p-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600 mb-2">Average Sales per Employee</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {Math.round(analysis.analysis.employees.marketAverage?.avgSalesPerEmployee || 0)}
                        </p>
                        <p className="text-sm text-gray-600 mt-4 mb-2">Average Revenue per Employee</p>
                        <p className="text-2xl font-bold text-green-600">
                          ${Math.round(analysis.analysis.employees.marketAverage?.avgRevenuePerEmployee || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Employee Performance Section */}
            {detailedAnalytics?.employeePerformance && detailedAnalytics.employeePerformance.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Employee Performance</h2>
                <EmployeePerformanceTable data={detailedAnalytics.employeePerformance} />
              </div>
            )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProblemAnalysis

