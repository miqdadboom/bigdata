import axios from 'axios'

// Use proxy in development, or direct URL
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 120 seconds (2 minutes) timeout for complex aggregations
})

// Add request interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout - Backend server may be slow or unavailable')
    }
    if (error.response) {
      // Server responded with error status
      throw new Error(error.response.data?.error || `Server error: ${error.response.status}`)
    } else if (error.request) {
      // Request made but no response
      throw new Error('Network Error - Cannot connect to backend server. Make sure backend is running on http://localhost:5000')
    } else {
      // Something else happened
      throw new Error(error.message || 'An unexpected error occurred')
    }
  }
)

// Dashboard API
export const fetchDashboardData = async (filters = {}) => {
  const params = new URLSearchParams()
  if (filters.startDate) params.append('startDate', filters.startDate)
  if (filters.endDate) params.append('endDate', filters.endDate)
  if (filters.companyId) params.append('companyId', filters.companyId)
  if (filters.region) params.append('region', filters.region)

  const response = await api.get(`/analytics/dashboard?${params.toString()}`)
  return response.data
}

// Sales Analytics
export const fetchSalesSummary = async (filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  const response = await api.get(`/analytics/sales/summary?${params.toString()}`)
  return response.data
}

export const fetchSalesByRegion = async (filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  const response = await api.get(`/analytics/sales/by-region?${params.toString()}`)
  return response.data
}

export const fetchSalesTrends = async (filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  const response = await api.get(`/analytics/sales/trends?${params.toString()}`)
  return response.data
}

// Product Analytics
export const fetchTopProducts = async (filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  const response = await api.get(`/analytics/products/top-selling?${params.toString()}`)
  return response.data
}

export const fetchProductsByBrand = async (filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  const response = await api.get(`/analytics/products/by-brand?${params.toString()}`)
  return response.data
}

// Employee Analytics
export const fetchEmployeePerformance = async (filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  const response = await api.get(`/analytics/employees/performance?${params.toString()}`)
  return response.data
}

// Sector Analytics
export const fetchSectorOverview = async (sector, filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  const response = await api.get(`/analytics/sector/${sector}/overview?${params.toString()}`)
  return response.data
}

export const fetchSectorCompanies = async (sector, filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  const response = await api.get(`/analytics/sector/${sector}/companies?${params.toString()}`)
  return response.data
}

export const fetchSectorRegions = async (sector, filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  const response = await api.get(`/analytics/sector/${sector}/regions?${params.toString()}`)
  return response.data
}

export const fetchCompanyInSector = async (sector, companyId, filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  const response = await api.get(`/analytics/sector/${sector}/company/${companyId}?${params.toString()}`)
  return response.data
}

// Comparative Analytics
export const compareCompanyVsMarket = async (companyId, sector, filters = {}) => {
  const params = new URLSearchParams()
  params.append('sector', sector)
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  const response = await api.get(`/analytics/compare/company/${companyId}/vs-market?${params.toString()}`)
  return response.data
}

export const compareCompanyVsRegion = async (companyId, sector, region, filters = {}) => {
  const params = new URLSearchParams()
  params.append('sector', sector)
  params.append('region', region)
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  const response = await api.get(`/analytics/compare/company/${companyId}/vs-region?${params.toString()}`)
  return response.data
}

export const compareCompanyTrend = async (companyId, sector, filters = {}) => {
  const params = new URLSearchParams()
  params.append('sector', sector)
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  const response = await api.get(`/analytics/compare/company/${companyId}/trend?${params.toString()}`)
  return response.data
}

// Problem Detection (with longer timeout for complex analysis)
export const detectCompanyProblems = async (companyId, sector, filters = {}) => {
  const params = new URLSearchParams()
  params.append('sector', sector)
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  // Use longer timeout for problem detection (5 minutes - 300 seconds)
  // This is needed because the analysis can take 2+ minutes with large datasets
  const response = await api.get(`/analytics/problems/company/${companyId}?${params.toString()}`, {
    timeout: 300000 // 5 minutes (300 seconds)
  })
  return response.data
}

export const detectRegionProblems = async (region, sector, filters = {}) => {
  const params = new URLSearchParams()
  params.append('sector', sector)
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  const response = await api.get(`/analytics/problems/region/${region}?${params.toString()}`)
  return response.data
}

// Root Cause Analysis (with longer timeout for complex analysis)
export const analyzeCompanyRootCause = async (companyId, sector, filters = {}) => {
  const params = new URLSearchParams()
  params.append('sector', sector)
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  // Use longer timeout for root cause analysis (5 minutes - 300 seconds)
  // This is needed because the analysis can take 2+ minutes with large datasets
  const response = await api.get(`/analytics/root-cause/company/${companyId}?${params.toString()}`, {
    timeout: 300000 // 5 minutes (300 seconds)
  })
  return response.data
}

// Auth API
export const login = async (username, password) => {
  const response = await api.post('/auth/login', { username, password })
  return response.data
}

export const getCurrentUser = async () => {
  const token = localStorage.getItem('token')
  const response = await api.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  })
  return response.data
}

// Company Analytics
export const fetchCompanyAnalytics = async (companyId, filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  const response = await api.get(`/analytics/company/${companyId}?${params.toString()}`)
  return response.data
}

// Company Detailed Analytics (Top Products & Employee Performance)
export const fetchCompanyDetailedAnalytics = async (companyId, filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  const response = await api.get(`/analytics/company/${companyId}/detailed?${params.toString()}`)
  return response.data
}

// Sector Analytics (Market)
export const fetchSectorMarketAnalytics = async (sector, filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value)
  })
  const response = await api.get(`/analytics/sector/${sector}/market?${params.toString()}`)
  return response.data
}

export default api

