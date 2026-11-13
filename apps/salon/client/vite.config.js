import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// The page talks to this product's own server (port 5007) through /api. core-ui and core-pos live outside this folder, so allow reading them;
// core-pos is plain CommonJS, so ask the build to convert it as well (Dev A: check this builds, see docs/products/salon/CLIENT.md).
export default defineConfig({
  plugins: [react()], resolve: { dedupe: ['react', 'react-dom'] },
  server: { proxy: { '/api': 'http://127.0.0.1:5007' }, fs: { allow: ['../../..'] } },
  build: { commonjsOptions: { include: [/node_modules/, /packages[\\/]core-pos/] } },
});
