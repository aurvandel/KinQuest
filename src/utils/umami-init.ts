/**
 * Initialize Umami Analytics and Session Replay
 * Dynamically injects tracking and replay scripts based on environment configuration
 */

export function initializeUmami(): void {
  const trackingEnabled = import.meta.env.VITE_UMAMI_TRACKING_ENABLED === 'true';
  const replayEnabled = import.meta.env.VITE_UMAMI_REPLAY_ENABLED === 'true';
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
