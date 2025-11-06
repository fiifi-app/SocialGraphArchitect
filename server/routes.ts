import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import googleAuthRoutes from "./routes/google-auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  // Google Calendar OAuth routes
  app.use('/api/auth/google', googleAuthRoutes);

  const httpServer = createServer(app);

  return httpServer;
}
