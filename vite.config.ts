import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://github.com/vuetifyjs/vuetify-loader/tree/next/packages/vite-plugin
import vuetify from 'vite-plugin-vuetify'

// https://vitejs.dev/config/
export default defineConfig({
   plugins: [
      vue(),
      vuetify({ autoImport: true }),
   ],
   resolve: {
      alias: {
         '@': fileURLToPath(new URL('./src', import.meta.url))
      }
   },
   server: {
      proxy: {
         '/api/oil-price': {
            target: 'https://oil-price.bangchak.co.th',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/oil-price/, '/ApiOilPrice2/th'),
            secure: false
         }
      }
   }
})
