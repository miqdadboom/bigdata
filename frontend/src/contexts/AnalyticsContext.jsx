import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { detectCompanyProblems, analyzeCompanyRootCause, fetchCompanyDetailedAnalytics } from '../services/api';

const AnalyticsContext = createContext();

export const useAnalytics = () => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within AnalyticsProvider');
  }
  return context;
};

export const AnalyticsProvider = ({ children }) => {
  const [analyticsData, setAnalyticsData] = useState({
    companyDetailed: null, // Top Products and Employee Performance
    problemDetection: null,
    rootCauseAnalysis: null,
    lastUpdated: null
  });
  const [loading, setLoading] = useState(false); // Loading state for analytics (Problem Analysis)
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  // Initialize user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setPreviousUser(parsedUser);
      } catch (e) {
        console.error('Error parsing user from localStorage:', e);
      }
    }
  }, []);

  // Track previous user to detect changes
  const [previousUser, setPreviousUser] = useState(null);

  // Listen for user changes and clear analytics data when user changes
  useEffect(() => {
    const checkUserChange = () => {
      const storedUser = localStorage.getItem('user');
      let currentUser = null;
      
      if (storedUser) {
        try {
          currentUser = JSON.parse(storedUser);
        } catch (e) {
          console.error('Error parsing user from localStorage:', e);
        }
      }

      // Check if user changed (different companyId or sector, or logged out)
      const userChanged = 
        (!previousUser && currentUser) ||  // User logged in
        (previousUser && !currentUser) ||   // User logged out
        (previousUser && currentUser && (previousUser.companyId !== currentUser.companyId || previousUser.sector !== currentUser.sector)); // Different user

      if (userChanged) {
        // Clear old analytics data when user changes
        setAnalyticsData({
          companyDetailed: null,
          problemDetection: null,
          rootCauseAnalysis: null,
          lastUpdated: null
        });
        setUser(currentUser);
        setPreviousUser(currentUser);
      }
    };

    // Check immediately on mount or when event is triggered
    checkUserChange();

    // Listen for custom storage events (triggered by login/logout in same tab)
    const handleCustomStorageEvent = () => {
      checkUserChange();
    };

    // Listen for storage changes (when user logs in/out in another tab)
    const handleStorageChange = (e) => {
      if (e.key === 'user' || e.key === null) {
        checkUserChange();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('userChanged', handleCustomStorageEvent);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userChanged', handleCustomStorageEvent);
    };
  }, [previousUser]);

  // Pre-fetch analytics data when user is available (background loading, doesn't block UI)
  const preFetchAnalytics = useCallback(async (companyId, sector) => {
    if (!companyId || !sector) return;

    try {
      // Only set loading if we're actively fetching (not background pre-fetch)
      // Background pre-fetch should not show loading state
      setError(null);

      // Fetch all analytics data in parallel (background loading)
      // Use the API functions that have proper timeout configuration
      const [detailedAnalytics, problemData, rootCauseData] = await Promise.all([
        // Company Detailed Analytics (Top Products & Employee Performance)
        fetchCompanyDetailedAnalytics(companyId).catch(err => {
          console.warn('Failed to fetch detailed analytics:', err);
          return null;
        }),
        // Problem Detection
        detectCompanyProblems(companyId, sector).catch(err => {
          console.warn('Failed to fetch problem detection:', err);
          return null;
        }),
        // Root Cause Analysis (with longer timeout - 5 minutes for complex analysis)
        analyzeCompanyRootCause(companyId, sector).catch(err => {
          console.warn('Failed to fetch root cause analysis:', err);
          return null;
        })
      ]);

      setAnalyticsData({
        companyDetailed: detailedAnalytics,
        problemDetection: problemData,
        rootCauseAnalysis: rootCauseData,
        lastUpdated: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error pre-fetching analytics:', err);
      setError(err.message);
    }
    // Note: We don't set loading to false here because this is background pre-fetch
    // The loading state is managed by the component that explicitly calls refreshAnalytics
  }, []);

  // Refresh analytics data (explicit refresh - shows loading state)
  const refreshAnalytics = useCallback(async (companyId, sector) => {
    if (!companyId || !sector) {
      setError('Company ID and Sector are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await preFetchAnalytics(companyId, sector);
    } finally {
      setLoading(false);
    }
  }, [preFetchAnalytics]);

  // Auto pre-fetch when user changes
  useEffect(() => {
    if (user?.companyId && user?.sector) {
      // Pre-fetch in background (don't block UI)
      preFetchAnalytics(user.companyId, user.sector);
    }
  }, [user?.companyId, user?.sector, preFetchAnalytics]);

  const value = {
    analyticsData,
    loading,
    error,
    refreshAnalytics,
    preFetchAnalytics,
    user,
    setUser
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
};

