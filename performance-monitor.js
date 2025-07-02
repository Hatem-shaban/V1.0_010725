// Performance monitoring and optimization utilities
(function() {
    'use strict';
    
    // Performance metrics collection
    const performanceMetrics = {
        pageLoadStart: performance.now(),
        apiCalls: [],
        errors: [],
        userInteractions: []
    };
    
    // Monitor API call performance
    function monitorFetch() {
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const startTime = performance.now();
            const url = args[0];
            
            return originalFetch.apply(this, args)
                .then(response => {
                    const endTime = performance.now();
                    const duration = endTime - startTime;
                    
                    performanceMetrics.apiCalls.push({
                        url: url,
                        duration: duration,
                        status: response.status,
                        timestamp: Date.now()
                    });
                    
                    // Track slow API calls for internal monitoring
                    if (duration > 3000) {
                        // Could send to analytics service here
                    }
                    
                    return response;
                })
                .catch(error => {
                    const endTime = performance.now();
                    const duration = endTime - startTime;
                    
                    performanceMetrics.errors.push({
                        url: url,
                        error: error.message,
                        duration: duration,
                        timestamp: Date.now()
                    });
                    
                    throw error;
                });
        };
    }
    
    // Monitor user interactions
    function monitorInteractions() {
        ['click', 'submit', 'input'].forEach(eventType => {
            document.addEventListener(eventType, function(event) {
                performanceMetrics.userInteractions.push({
                    type: eventType,
                    target: event.target.tagName + (event.target.id ? '#' + event.target.id : ''),
                    timestamp: Date.now()
                });
                
                // Keep only last 50 interactions to prevent memory bloat
                if (performanceMetrics.userInteractions.length > 50) {
                    performanceMetrics.userInteractions = performanceMetrics.userInteractions.slice(-50);
                }
            });
        });
    }
    
    // Image lazy loading optimization
    function optimizeImages() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                            observer.unobserve(img);
                        }
                    }
                });
            });
            
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }
    
    // Optimize animations with requestAnimationFrame
    function optimizeAnimations() {
        const animatedElements = document.querySelectorAll('.animate-pulse, .animate-spin');
        
        // Pause animations when not visible
        if ('IntersectionObserver' in window) {
            const animationObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.style.animationPlayState = 'running';
                    } else {
                        entry.target.style.animationPlayState = 'paused';
                    }
                });
            });
            
            animatedElements.forEach(el => {
                animationObserver.observe(el);
            });
        }
    }
    
    // Memory usage monitoring
    function monitorMemory() {
        if ('memory' in performance) {
            const memoryInfo = performance.memory;
            
            // Track memory usage internally
            if (memoryInfo.usedJSHeapSize > memoryInfo.jsHeapSizeLimit * 0.8) {
                // Could trigger cleanup or send alert to monitoring service
            }
        }
    }
    
    // Network connection monitoring
    function monitorConnection() {
        if ('connection' in navigator) {
            const connection = navigator.connection;
            
            // Adjust behavior based on connection quality
            if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                // Disable non-essential animations on slow connections
                document.body.classList.add('slow-connection');
            }
            
            connection.addEventListener('change', () => {
                // Handle connection changes
            });
        }
    }
    
    // Performance report generation
    function generatePerformanceReport() {
        const navigation = performance.getEntriesByType('navigation')[0];
        const loadTime = navigation ? navigation.loadEventEnd - navigation.fetchStart : 0;
        
        return {
            pageLoad: {
                totalTime: loadTime,
                dnsLookup: navigation ? navigation.domainLookupEnd - navigation.domainLookupStart : 0,
                tcpConnect: navigation ? navigation.connectEnd - navigation.connectStart : 0,
                serverResponse: navigation ? navigation.responseEnd - navigation.requestStart : 0,
                domProcessing: navigation ? navigation.domContentLoadedEventEnd - navigation.responseEnd : 0
            },
            apiCalls: {
                total: performanceMetrics.apiCalls.length,
                averageTime: performanceMetrics.apiCalls.length > 0 
                    ? performanceMetrics.apiCalls.reduce((sum, call) => sum + call.duration, 0) / performanceMetrics.apiCalls.length 
                    : 0,
                slowCalls: performanceMetrics.apiCalls.filter(call => call.duration > 2000)
            },
            errors: performanceMetrics.errors,
            memory: 'memory' in performance ? {
                used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
                total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
                limit: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + 'MB'
            } : 'Not available'
        };
    }
    
    // Initialize monitoring
    function initializePerformanceMonitoring() {
        monitorFetch();
        monitorInteractions();
        optimizeImages();
        optimizeAnimations();
        monitorConnection();
        
        // Check memory usage every 30 seconds
        setInterval(monitorMemory, 30000);
        
        // Make performance report available globally
        window.getPerformanceReport = generatePerformanceReport;
        
        // Log performance metrics after page load
        window.addEventListener('load', () => {
            setTimeout(() => {
                const report = generatePerformanceReport();
                
                // Send performance data to analytics if needed
                if (window.gtag) {
                    window.gtag('event', 'page_load_time', {
                        value: Math.round(report.pageLoad.totalTime),
                        custom_map: { metric1: 'load_time' }
                    });
                }
            }, 1000);
        });
    }
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePerformanceMonitoring);
    } else {
        initializePerformanceMonitoring();
    }
    
    // Expose utilities globally
    window.PerformanceMonitor = {
        getReport: generatePerformanceReport,
        getMetrics: () => performanceMetrics,
        clearMetrics: () => {
            performanceMetrics.apiCalls = [];
            performanceMetrics.errors = [];
            performanceMetrics.userInteractions = [];
        }
    };
    
})();
