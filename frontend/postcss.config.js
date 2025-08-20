/**
 * PostCSS configuration for Next.js with Tailwind CSS
 * Uses the @tailwindcss/postcss wrapper plugin to process Tailwind directives.
 */
/**
 * PostCSS configuration for Next.js with Tailwind CSS.
 * Uses the @tailwindcss/postcss plugin wrapper for Tailwind processing.
 */
module.exports = {
  // According to Next.js, plugins must be specified by package name strings
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};
