import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Verify required environment variables are available at build time
// Only check in production builds (Vercel) to allow local dev without .env
if (process.env.NODE_ENV === 'production' && (process.env.VERCEL || process.env.CI)) {
  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    console.error('\n❌ BUILD FAILED: Missing required environment variables\n');
    console.error('Missing variables:');
    console.error('  VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ MISSING');
    console.error('  VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ MISSING');
    console.error('\n⚠️  Vite requires VITE_* variables at BUILD TIME (not runtime).');
    console.error('\n📝 To fix:');
    console.error('1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables');
    console.error('2. Add: VITE_SUPABASE_URL (set for Production, Preview, Development)');
    console.error('3. Add: VITE_SUPABASE_ANON_KEY (set for Production, Preview, Development)');
    console.error('4. Redeploy the application\n');
    process.exit(1);
  } else {
    console.log('✅ Environment variables verified for build');
  }
}

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  // Explicitly define environment variables for Vite
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || ''),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || ''),
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
