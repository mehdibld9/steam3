import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (!req.session?.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export function requireModOrAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (!req.session?.isAdmin && !req.session?.isModerator) {
    res.status(403).json({ error: "Moderator or admin access required" });
    return;
  }
  next();
}
