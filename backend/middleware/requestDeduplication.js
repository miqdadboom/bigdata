/**
 * Request Deduplication Middleware
 * Prevents duplicate processing when multiple requests come for the same analysis
 * If a request is already processing, subsequent requests wait for the same result
 */

const { cacheMiddleware } = require('./cache');

// Map to track ongoing requests: key = "companyId:sector:type", value = Promise
const ongoingRequests = new Map();

// Track logged messages to avoid repetition
const loggedDedupMessages = new Map();
const DEDUP_LOG_INTERVAL = 30000; // Log same message only once per 30 seconds

/**
 * Create a unique key for a request
 */
const getRequestKey = (companyId, sector, type = 'analysis') => {
  return `${companyId}:${sector}:${type}`;
};

/**
 * Request Deduplication Middleware
 * Wraps an async handler to prevent duplicate concurrent requests
 * 
 * @param {Function} handler - The async handler function
 * @param {string} type - Request type ('rootCause', 'problemDetection', etc.)
 * @returns {Function} Wrapped handler
 */
const deduplicateRequest = (handler, type = 'analysis') => {
  return async (req, res, next) => {
    const { companyId, sector: sectorParam } = req.params;
    const { sector: sectorQuery } = req.query;
    const sector = sectorParam || sectorQuery;
    
    // For routes without companyId (like sector analytics), use sector only
    if (!sector) {
      // If required params are missing, let the handler deal with it
      return handler(req, res, next);
    }

    // Create request key: use companyId if available, otherwise use sector only
    const requestKey = companyId 
      ? getRequestKey(companyId, sector, type)
      : `sector:${sector}:${type}`;
    
    // Check if response was already sent by cache middleware (if cache is before deduplication)
    // If cache hit, response is already sent, so we don't need deduplication
    if (res.headersSent) {
      return; // Response already sent by cache, nothing to do
    }
    
    // Check if there's already a request in progress
    if (ongoingRequests.has(requestKey)) {
      // Only log once per 30 seconds to avoid spam
      const lastLog = loggedDedupMessages.get(requestKey);
      if (!lastLog || Date.now() - lastLog > DEDUP_LOG_INTERVAL) {
        console.log(`[Request Deduplication] Request already in progress for ${requestKey}, waiting for result...`);
        loggedDedupMessages.set(requestKey, Date.now());
      }
      
      try {
        // Wait for the existing request to complete and get its result
        const result = await ongoingRequests.get(requestKey);
        
        // Return the same result
        return res.json(result);
      } catch (error) {
        // If the previous request failed, remove it and let this one proceed
        ongoingRequests.delete(requestKey);
        console.log(`[Request Deduplication] Previous request failed, starting new one for ${requestKey}`);
        // Continue to handler below
      }
    }

    // Create a promise that will resolve with the handler's result
    const requestPromise = new Promise((resolve, reject) => {
      // Store original json and end methods
      const originalJson = res.json.bind(res);
      const originalEnd = res.end.bind(res);
      let responseData = null;
      let responseSent = false;
      let responseStatus = 200;
      
      // Override json to capture the response
      res.json = function(data) {
        if (!responseSent) {
          responseData = data;
          responseStatus = res.statusCode || 200;
          responseSent = true;
          resolve(data); // Resolve promise with the data
        }
        res.json = originalJson; // Restore original
        return originalJson.call(this, data);
      };
      
      // Also override end in case response is sent differently
      res.end = function(chunk, encoding) {
        if (!responseSent && chunk) {
          try {
            // Try to parse JSON if it's a string
            const data = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;
            responseData = data;
            responseStatus = res.statusCode || 200;
            responseSent = true;
            resolve(data);
          } catch (e) {
            // Not JSON, ignore
          }
        }
        res.end = originalEnd; // Restore original
        return originalEnd.call(this, chunk, encoding);
      };
      
      // Call the handler
      // Use a timeout to prevent hanging requests
      const timeout = setTimeout(() => {
        if (!responseSent) {
          ongoingRequests.delete(requestKey);
          reject(new Error('Request timeout in deduplication'));
        }
      }, 300000); // 5 minutes timeout
      
      handler(req, res, (err) => {
        clearTimeout(timeout);
        if (err) {
          if (!responseSent) {
            ongoingRequests.delete(requestKey);
            reject(err);
          }
          return next(err);
        }
      });
    });

    // Store the promise
    ongoingRequests.set(requestKey, requestPromise);

    try {
      // Wait for the handler to complete
      await requestPromise;
    } catch (error) {
      // Remove from map on error
      ongoingRequests.delete(requestKey);
      // Pass error to next middleware
      next(error);
    } finally {
      // Clean up after a short delay to allow concurrent requests to see the result
      setTimeout(() => {
        ongoingRequests.delete(requestKey);
      }, 2000); // 2 second delay
    }
  };
};

module.exports = {
  deduplicateRequest,
  getRequestKey,
  ongoingRequests
};
