import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';
import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';

const isVercel = Boolean(process.env.VERCEL);

export default defineConfig({
  output: 'server',

  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },

  devToolbar: {
    enabled: false,
  },

  adapter: isVercel ? vercel() : node({
    mode: 'standalone'
  }),

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    define: {
      'globalThis.IS_REACT_ACT_ENVIRONMENT': 'false',
    },
    resolve: {
      alias: {
        '@': path.resolve('./src'),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        '@base-ui/react',
        '@base-ui/react/accordion',
        '@base-ui/react/alert-dialog',
        '@base-ui/react/button',
        '@base-ui/react/dialog',
        '@base-ui/react/input',
        '@base-ui/react/menu',
        '@base-ui/react/merge-props',
        '@base-ui/react/navigation-menu',
        '@base-ui/react/popover',
        '@base-ui/react/select',
        '@base-ui/react/separator',
        '@base-ui/react/tabs',
        '@base-ui/react/toggle',
        '@base-ui/react/toggle-group',
        '@base-ui/react/tooltip',
        '@base-ui/react/use-render',
        'leaflet',
        'date-fns',
        'date-fns/locale',
        'lucide-react',
        'sonner',
        'clsx',
        'tailwind-merge',
        'class-variance-authority'
      ],
    },
  },
});
