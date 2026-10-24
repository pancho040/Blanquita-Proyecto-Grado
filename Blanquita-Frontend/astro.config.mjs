
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',

  adapter: cloudflare(),

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'print-js',
        'react-pdf',
        'qr-scanner',
        'recharts',
        'sonner',
        'next-themes',
        'lucide-react',
        '@lucide/lab',
        'date-fns',
        'date-fns/locale',
        'react-day-picker',
        'class-variance-authority',
        'clsx',
        'cn',
        'tailwind-merge',
        '@base-ui/react/accordion',
        '@base-ui/react/alert-dialog',
        '@base-ui/react/button',
        '@base-ui/react/dialog',
        '@base-ui/react/input',
        '@base-ui/react/menu',
        '@base-ui/react/merge-props',
        '@base-ui/react/navigation-menu',
        '@base-ui/react/popover',
        '@base-ui/react/progress',
        '@base-ui/react/scroll-area',
        '@base-ui/react/select',
        '@base-ui/react/separator',
        '@base-ui/react/tabs',
        '@base-ui/react/toggle',
        '@base-ui/react/toggle-group',
        '@base-ui/react/tooltip',
        '@base-ui/react/use-render',
      ],
    },
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve('./src') },
        { find: /^pdfjs-dist$/, replacement: 'pdfjs-dist/legacy/build/pdf.mjs' },
      ],
    },
  },
});
