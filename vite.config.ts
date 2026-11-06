import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({plugins:[react(),tailwindcss()],optimizeDeps:{include:['d3-array','d3-scale','d3-shape','@number-flow/react','motion/react','clsx','tailwind-merge','radix-ui','cmdk']},resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},server:{host:'127.0.0.1',port:5173,strictPort:true,watch:{ignored:['**/.local/**','**/dist/**','**/.taste-skill/**']},proxy:{'/api':'http://127.0.0.1:4317'}},build:{outDir:'dist'}});
