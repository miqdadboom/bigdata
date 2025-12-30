// Simple in-memory cache middleware
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds for dashboard
const CACHE_TTL_ANALYSIS = 60000; // 60 seconds for analysis (longer because it's more expensive)

const getCacheKey = (req) => {
  return `${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`;
};

const cacheMiddleware = (ttl = CACHE_TTL) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = getCacheKey(req);
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < ttl) {
      return res.json(cached.data);
    }

    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      cache.set(key, {
        data,
        timestamp: Date.now()
      });
      return originalJson(data);
    };

    next();
  };
};

// Default cache middleware (30 seconds)
const defaultCacheMiddleware = cacheMiddleware(CACHE_TTL);
// Analysis cache middleware (60 seconds)
const analysisCacheMiddleware = cacheMiddleware(CACHE_TTL_ANALYSIS);

// Clear cache for specific patterns
const clearCache = (pattern) => {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
};

module.exports = { 
  cacheMiddleware: defaultCacheMiddleware, 
  analysisCacheMiddleware,
  clearCache 
};

