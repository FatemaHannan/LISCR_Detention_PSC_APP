// Analytics - tracks page views and key actions (no PII)
// Can be connected to PostHog or Google Analytics later

const events = [];

export function trackPage(page) {
  events.push({ type: 'page', page, ts: new Date().toISOString() });
  if (process.env.NODE_ENV === 'development') console.log('[Analytics] Page:', page);
}

export function trackEvent(name, props = {}) {
  events.push({ type: 'event', name, props, ts: new Date().toISOString() });
  if (process.env.NODE_ENV === 'development') console.log('[Analytics] Event:', name, props);
}

export function getSessionSummary() {
  return {
    pages: events.filter(e => e.type === 'page').length,
    events: events.filter(e => e.type === 'event').length,
    session_start: events[0]?.ts || null,
  };
}
