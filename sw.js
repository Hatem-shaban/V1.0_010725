// Service Worker for StartupStack Performance Optimization
const CACHE_NAME = 'startupstack-v1.0.1';
const STATIC_CACHE_NAME = 'startupstack-static-v1.0.1';

// Static assets to cache
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/app.js',
    '/performance-config.js',
    '/performance-monitor.js',
    'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// API endpoints to cache with strategy
const API_CACHE_PATTERNS = [
    /\.netlify\/functions\/ai-operations/,
    /\.netlify\/functions\/send-/
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE_NAME).then((cache) => {
                return cache.addAll(STATIC_ASSETS);
            }),
            caches.open(CACHE_NAME)
        ]).then(() => {
            self.skipWaiting();
        })
    );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other non-http requests
    if (!request.url.startsWith('http')) {
        return;
    }
    
    // Different strategies for different types of requests
    if (STATIC_ASSETS.some(asset => request.url.includes(asset))) {
        // Cache First strategy for static assets
        event.respondWith(cacheFirstStrategy(request, STATIC_CACHE_NAME));
    } else if (API_CACHE_PATTERNS.some(pattern => pattern.test(request.url))) {
        // Network First strategy for API calls
        event.respondWith(networkFirstStrategy(request, CACHE_NAME));
    } else if (request.url.includes('.css') || request.url.includes('.js') || request.url.includes('.woff')) {
        // Cache First for external CSS/JS files
        event.respondWith(cacheFirstStrategy(request, STATIC_CACHE_NAME));
    } else {
        // Stale While Revalidate for other requests
        event.respondWith(staleWhileRevalidateStrategy(request, CACHE_NAME));
    }
});

// Cache First Strategy - for static assets
async function cacheFirstStrategy(request, cacheName) {
    try {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        return new Response('Offline content not available', { status: 503 });
    }
}

// Network First Strategy - for API calls
async function networkFirstStrategy(request, cacheName) {
    try {
        const networkResponse = await fetch(request, {
            headers: {
                ...request.headers,
                'Cache-Control': 'no-cache'
            }
        });
        
        // Cache successful API responses for offline access
        if (networkResponse.status === 200) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        return new Response(JSON.stringify({
            error: 'Offline - please check your internet connection',
            offline: true
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Stale While Revalidate Strategy - for dynamic content
async function staleWhileRevalidateStrategy(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    // Return cached version immediately if available
    if (cachedResponse) {
        // Update cache in background
        fetch(request).then((networkResponse) => {
            if (networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
            }
        }).catch(error => {
            // Silent fail for background updates
        });
        
        return cachedResponse;
    }
    
    // If no cache, fetch from network
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        return new Response('Content not available offline', { status: 503 });
    }
}

// Background sync for failed requests
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    // Retry failed API requests when back online
    // Implementation for retrying failed requests
    // This could include sending queued AI operations, etc.
}

// Push notification handling (for future use)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        
        const options = {
            body: data.body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            actions: data.actions || []
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow(event.notification.data?.url || '/')
    );
});

// Message handling from main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CACHE_CLEAR') {
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );
        }).then(() => {
            event.ports[0].postMessage({ success: true });
        });
    }
});
