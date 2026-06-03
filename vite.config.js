import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist'
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Alligator Landing',
        short_name: 'AL Property',
        description: 'Alligator Landing Property Manager',
        theme_color: '#1A4F8A',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ]
})

Click Commit changes

Once both are committed Vercel will automatically kick off a new deployment. Paste the full build log here if any new errors come up!You said: x Build failed in 2.x Build failed in 2.31s
error during build:
[vite-plugin-pwa:build] [plugin vite-plugin-pwa:build] There was an error during the build:
  [vite]: Rollup failed to resolve import "/src/main.jsx" from "/vercel/path0/index.html".
This is most likely unintended because it can break your application at runtime.
If you do want to externalize this module explicitly add it to
build.rollupOptions.external
Additionally, handling the error in the 'buildEnd' hook caused the following error:
  [vite]: Rollup failed to resolve import "/src/main.jsx" from "/vercel/path0/index.html".
This is most likely unintended because it can break your application at runtime.
If you do want to externalize this module explicitly add it to
build.rollupOptions.external
    at getRollupError (file:///vercel/path0/node_modules/rollup/dist/es/shared/parseAst.js:317:41)
    at file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:23873:39
    at async catchUnfinishedHookActions (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:23331:16)
    at async rollupInternal (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:23856:5)
    at async build (file:///vercel/path0/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:65709:14)
    at async CAC.<anonymous> (file:///vercel/path0/node_modules/vite/dist/node/cli.js:829:5)
Error: Command "npm run build" exited with 1Show more4:18 PMClaude responded: The PWA plugin is causing the conflict.The PWA plugin is causing the conflict. Let's simplify — remove the PWA plugin entirely for now and get it live first, then add it back later.
Edit vite.config.js in GitHub — replace everything with this:
jsimport { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist'
  }
})
Edit package.json in GitHub — replace everything with this:
json{
  "name": "alligator-landing",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "lucide-react": "^0.303.0",
    "date-fns": "^3.0.6"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8"
  }
}
  ]
})
