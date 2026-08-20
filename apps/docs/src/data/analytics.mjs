// Google Analytics 4 wiring, shared by the Starlight head config and the
// standalone home layout so the measurement ID lives in exactly one place.
export const GA_ID = 'G-L99BJFSR09';

export const GA_SRC = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;

// Standard gtag bootstrap, skipped on local hosts so dev and preview
// traffic never pollutes the property.
export const GA_INLINE = [
  "if (!['localhost', '127.0.0.1'].includes(location.hostname)) {",
  '  window.dataLayer = window.dataLayer || [];',
  '  function gtag() { dataLayer.push(arguments); }',
  "  gtag('js', new Date());",
  `  gtag('config', '${GA_ID}');`,
  '}',
].join('\n');
