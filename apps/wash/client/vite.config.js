import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// The page talks to this product's own server (port 5011) through /api. core-ui and core-pos live outside this folder, so allow reading them;
// core-pos is plain CommonJS, so ask the build to convert it as well (Dev A: check this builds, see docs/products/wash/CLIENT.md).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:5011' }, fs: { allow: ['../../..'] } },
  build: { commonjsOptions: { include: [/node_modules/, /packages[\\/]core-pos/] } },
});
