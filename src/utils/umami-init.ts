/**
 * Initialize Umami Analytics, Session Replay, and Performance Tracking
 * Dynamically injects tracking and replay scripts based on environment configuration
 * Auto-tracks Web Vitals and custom performance metrics
 */

interface WebVital {
  name: string;
  value: number;
  rating?: 'good' | 'needs-improvement' | 'poor';
}

declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: Record<string, any>) => void;
    };
  }
}

/**
 * Track Web Vitals using the Web Vitals API
 * Sends LCP, FID, CLS, TTFB, INP metrics to Umami
 */
function initializeWebVitalsTracking(): void {
  const performanceEnabled = import.meta.env.VITE_UMAMI_PERFORMANCE_ENABLED === 'true';
  
  if (!performanceEnabled || !window.umami) {
    return;
  }

  // Use native Web Vitals API (available in modern browsers)
  if ('PerformanceObserver' in window) {
    // Track Largest Contentful Paint (LCP)
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        const value = lastEntry.renderTime || lastEntry.loadTime || 0;
        
        window.umami?.track('web_vital_lcp', {
          value: Math.round(value),
          rating: getLCPRating(value)
        });
        console.debug('📊 Web Vital LCP tracked:', value);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      console.warn('LCP tracking unavailable:', e);
    }

    // Track First Input Delay (FID) / Interaction to Next Paint (INP)
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          const duration = entry.processingDuration || entry.duration;
          const eventName = entry.name === 'first-input' ? 'web_vital_fid' : 'web_vital_inp';
          
          window.umami?.track(eventName, {
            value: Math.round(duration),
            rating: getFIDRating(duration)
          });
          console.debug(`📊 Web Vital ${eventName} tracked:`, duration);
        });
      });
      fidObserver.observe({ entryTypes: ['first-input', 'event'] });
    } catch (e) {
      console.warn('FID/INP tracking unavailable:', e);
    }

    // Track Cumulative Layout Shift (CLS)
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            window.umami?.track('web_vital_cls', {
              value: Math.round(clsValue * 1000) / 1000,
              rating: getCLSRating(clsValue)
            });
            console.debug('📊 Web Vital CLS tracked:', clsValue);
          }
        });
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      console.warn('CLS tracking unavailable:', e);
    }

    // Track Time to First Byte (TTFB)
    try {
      const ttfbObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.responseStart && entry.fetchStart) {
            const ttfb = entry.responseStart - entry.fetchStart;
            window.umami?.track('web_vital_ttfb', {
              value: Math.round(ttfb),
              rating: getTTFBRating(ttfb)
            });
            console.debug('📊 Web Vital TTFB tracked:', ttfb);
          }
        });
      });
      ttfbObserver.observe({ entryTypes: ['navigation'] });
    } catch (e) {
      console.warn('TTFB tracking unavailable:', e);
    }
  }
}

/**
 * Rating thresholds for Core Web Vitals
 */
function getLCPRating(value: number): 'good' | 'needs-improvement' | 'poor' {
  if (value <= 2500) return 'good';
  if (value <= 4000) return 'needs-improvement';
  return 'poor';
}

function getFIDRating(value: number): 'good' | 'needs-improvement' | 'poor' {
  if (value <= 100) return 'good';
  if (value <= 300) return 'needs-improvement';
  return 'poor';
}

function getCLSRating(value: number): 'good' | 'needs-improvement' | 'poor' {
  if (value <= 0.1) return 'good';
  if (value <= 0.25) return 'needs-improvement';
  return 'poor';
}

function getTTFBRating(value: number): 'good' | 'needs-improvement' | 'poor' {
  if (value <= 800) return 'good';
  if (value <= 1800) return 'needs-improvement';
  return 'poor';
}

/**
 * Track custom performance metrics (API calls, page navigation, etc.)
 */
function initializeCustomPerformanceTracking(): void {
  const performanceEnabled = import.meta.env.VITE_UMAMI_PERFORMANCE_ENABLED === 'true';
  
  if (!performanceEnabled || !window.umami) {
    return;
  }

  // Track page load time
  if (document.readyState === 'loading') {
    window.addEventListener('load', () => {
      const pageLoadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
      window.umami?.track('performance_page_load', {
        value: Math.round(pageLoadTime),
        category: 'page_performance'
      });
      console.debug('📊 Page load time tracked:', pageLoadTime, 'ms');
    });
  } else {
    const pageLoadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
    window.umami?.track('performance_page_load', {
      value: Math.round(pageLoadTime),
      category: 'page_performance'
    });
    console.debug('📊 Page load time tracked:', pageLoadTime, 'ms');
  }

  // Wrap fetch to track API performance
  // Use a flag to prevent infinite recursion if umami.track() makes fetch calls
  let isTracking = false;
  const originalFetch = window.fetch;
  
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
    const startTime = performance.now();
    
    // Extract URL from different input types
    let urlString = '';
    try {
      if (typeof input === 'string') {
        urlString = input;
      } else if (input instanceof URL) {
        urlString = input.toString();
      } else if (input instanceof Request) {
        urlString = input.url;
      } else {
        // Fallback for unknown types
        urlString = String(input);
      }
    } catch (e) {
      console.warn('Failed to extract URL from fetch input:', e);
      // Continue without tracking if URL extraction fails
      return originalFetch.call(this, input, init);
    }

    // Perform the actual fetch
    return originalFetch.call(this, input, init)
      .then((response) => {
        // Skip tracking umami's own requests to prevent infinite loops
        if (!isTracking && !urlString.includes('umami')) {
          isTracking = true;
          const duration = performance.now() - startTime;
          try {
            const pathname = new URL(urlString, window.location.origin).pathname;
            window.umami?.track('api_call', {
              url: pathname,
              method: (init?.method || 'GET').toUpperCase(),
              status: response.status,
              duration: Math.round(duration),
              category: 'api_performance'
            });
          } catch (e) {
            console.warn('Failed to track API call:', e);
          } finally {
            isTracking = false;
          }
        }
        return response;
      })
      .catch((error) => {
        // Skip tracking umami's own requests to prevent infinite loops
        if (!isTracking && !urlString.includes('umami')) {
          isTracking = true;
          const duration = performance.now() - startTime;
          try {
            const pathname = new URL(urlString, window.location.origin).pathname;
            window.umami?.track('api_call', {
              url: pathname,
              method: (init?.method || 'GET').toUpperCase(),
              status: 'error',
              duration: Math.round(duration),
              error: error?.message || String(error),
              category: 'api_performance'
            });
          } catch (e) {
            console.warn('Failed to track API error:', e);
          } finally {
            isTracking = false;
          }
        }
        throw error;
      });
  };
}

export function initializeUmami(): void {
  const trackingEnabled = import.meta.env.VITE_UMAMI_TRACKING_ENABLED === 'true';
  const replayEnabled = import.meta.env.VITE_UMAMI_REPLAY_ENABLED === 'true';
  const performanceEnabled = import.meta.env.VITE_UMAMI_PERFORMANCE_ENABLED === 'true';
  const scriptUrl = import.meta.env.VITE_UMAMI_SCRIPT_URL;
  const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;
  const trackingScript = import.meta.env.VITE_UMAMI_TRACKING_SCRIPT || 'umami.js';
  const replayScript = import.meta.env.VITE_UMAMI_REPLAY_SCRIPT || 'recorder.js';

  // Require both URL and website ID to proceed
  if (!scriptUrl || !websiteId) {
    console.info('Umami: Tracking disabled (missing configuration)');
    return;
  }

  // Initialize tracking script
  if (trackingEnabled) {
    const script = document.createElement('script');
    script.defer = true;
    script.src = `${scriptUrl}/${trackingScript}`;
    script.setAttribute('data-website-id', websiteId);
    document.head.appendChild(script);
    console.info('✅ Umami tracking enabled');

    // Wait for Umami to load before initializing performance tracking
    if (performanceEnabled) {
      script.onload = () => {
        initializeWebVitalsTracking();
        initializeCustomPerformanceTracking();
        console.info('✅ Umami performance tracking enabled');
      };

      // Fallback in case onload doesn't fire
      setTimeout(() => {
        if (window.umami) {
          initializeWebVitalsTracking();
          initializeCustomPerformanceTracking();
          console.info('✅ Umami performance tracking enabled (fallback)');
        }
      }, 1000);
    }
  }

  // Initialize replay script
  if (replayEnabled) {
    const sampleRate = import.meta.env.VITE_UMAMI_SAMPLE_RATE || '0.15';
    const maskLevel = import.meta.env.VITE_UMAMI_MASK_LEVEL || 'moderate';
    const maxDuration = import.meta.env.VITE_UMAMI_MAX_DURATION || '300000';

    const script = document.createElement('script');
    script.defer = true;
    script.src = `${scriptUrl}/${replayScript}`;
    script.setAttribute('data-website-id', websiteId);
    script.setAttribute('data-sample-rate', sampleRate);
    script.setAttribute('data-mask-level', maskLevel);
    script.setAttribute('data-max-duration', maxDuration);
    document.head.appendChild(script);
    console.info('✅ Umami session replay enabled');
  }
}
