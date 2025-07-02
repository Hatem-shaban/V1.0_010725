// Performance Configuration for StartupStack
export const PERFORMANCE_CONFIG = {
    // API Timeouts (in milliseconds)
    AI_OPERATIONS_TIMEOUT: 12000, // Reduced from 15s
    CHECKOUT_TIMEOUT: 8000,
    AUTH_TIMEOUT: 5000,
    
    // Cache Settings
    USER_CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
    STATIC_CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours
    
    // Database Query Limits
    MAX_RETRIES: 2, // Reduced from 3
    RETRY_DELAY_BASE: 1000, // 1 second base delay
    
    // UI Performance
    DEBOUNCE_DELAY: 300, // For search inputs
    ANIMATION_DURATION: 200, // Reduced animation time
    
    // OpenAI Settings
    OPENAI_MODEL: 'gpt-3.5-turbo-0125', // Faster variant
    MAX_TOKENS: 600, // Reduced for faster responses
    TEMPERATURE: 0.7,
    
    // Resource Hints
    PRECONNECT_DOMAINS: [
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com',
        'https://assets.lemonsqueezy.com'
    ],
    
    DNS_PREFETCH_DOMAINS: [
        '//ygnrdquwnafkbkxirtae.supabase.co',
        '//api.openai.com',
        '//api.lemonsqueezy.com'
    ],
    
    // Batch Processing
    BATCH_SIZE: 10, // For bulk operations
    CONCURRENT_REQUESTS: 3, // Max concurrent API calls
    
    // Memory Management
    MAX_CACHE_SIZE: 50, // Maximum cached items
    CLEANUP_INTERVAL: 10 * 60 * 1000 // 10 minutes
};

// Performance Monitoring Utilities
export const PerformanceUtils = {
    // Debounce function for user inputs
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Throttle function for scroll events
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // Cache implementation with size limits
    createCache(maxSize = PERFORMANCE_CONFIG.MAX_CACHE_SIZE) {
        const cache = new Map();
        
        return {
            get(key) {
                if (cache.has(key)) {
                    // Move to end (most recently used)
                    const value = cache.get(key);
                    cache.delete(key);
                    cache.set(key, value);
                    return value;
                }
                return null;
            },
            
            set(key, value) {
                if (cache.has(key)) {
                    cache.delete(key);
                } else if (cache.size >= maxSize) {
                    // Remove least recently used
                    const firstKey = cache.keys().next().value;
                    cache.delete(firstKey);
                }
                cache.set(key, value);
            },
            
            clear() {
                cache.clear();
            },
            
            size() {
                return cache.size;
            }
        };
    },
    
    // Performance observer for monitoring
    observePerformance() {
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    // Log slow operations (> 1 second)
                    if (entry.duration > 1000) {
                        console.warn(`Slow operation detected: ${entry.name} - ${entry.duration}ms`);
                    }
                }
            });
            
            observer.observe({ entryTypes: ['measure', 'navigation'] });
        }
    },
    
    // Memory cleanup utility
    cleanupMemory() {
        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
        
        // Clear old localStorage items
        const now = Date.now();
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith('cache_')) {
                try {
                    const item = JSON.parse(localStorage.getItem(key));
                    if (item.expiry && item.expiry < now) {
                        localStorage.removeItem(key);
                    }
                } catch (e) {
                    // Remove invalid cache items
                    localStorage.removeItem(key);
                }
            }
        }
    }
};

// Set up periodic cleanup
if (typeof window !== 'undefined') {
    setInterval(PerformanceUtils.cleanupMemory, PERFORMANCE_CONFIG.CLEANUP_INTERVAL);
}
