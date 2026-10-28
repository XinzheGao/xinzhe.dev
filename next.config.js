module.exports = {
  // Keep production builds from overwriting a running development server.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  reactStrictMode: true,
  // Preserve the request origin when locale URLs are internally rewritten.
  skipProxyUrlNormalize: true,
  trailingSlash: false,
  async redirects() {
    return [
      { source: '/blog/:slug', destination: '/writing/:slug', permanent: true },
      ...['stack', 'home'].map((slug) => ({ source: `/${slug}`, destination: '/', permanent: false }))
    ]
  },
  experimental: {
    optimizePackageImports: ['framer-motion', '@supabase/supabase-js', 'react-tweet']
  }
}
