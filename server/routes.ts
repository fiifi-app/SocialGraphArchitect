import type { Express } from "express";
import { createServer, type Server } from "http";
import googleAuthRoutes from "./routes/google-auth";

export async function registerRoutes(app: Express): Promise<Server | null> {
  /**
   * This application uses Supabase as the database.
   * Most CRUD operations are performed directly from the frontend using Supabase hooks.
   * The backend only handles OAuth flows and serves the frontend.
   */

  // Google Calendar OAuth routes
  app.use('/api/auth/google', googleAuthRoutes);

  // Only create HTTP server if not in serverless environment (Vercel)
  if (process.env.VERCEL) {
    return null;
  }

  const httpServer = createServer(app);
  return httpServer;
}
