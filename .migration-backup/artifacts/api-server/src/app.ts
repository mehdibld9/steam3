// @ts-nocheck
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

const app = express();

app.set("trust proxy", 1);

const PgSession = connectPgSimple(session);

const pinoMiddleware = (typeof pinoHttp === "function" ? pinoHttp : (pinoHttp as any).default) as typeof pinoHttp;

app.use(
  pinoMiddleware({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new PgSession({
      pool,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET ?? (process.env.NODE_ENV === "production"
      ? (() => { throw new Error("SESSION_SECRET env var is required in production"); })()
      : "steamshare-dev-secret"),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  }),
);

app.use("/api", router);

// Vercel serves the Vite build from outputDirectory; express.static is ignored there.
const serveStatic = !process.env.VERCEL;

if (serveStatic) {
  const staticDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../steamshare/dist/public",
  );

  app.use(express.static(staticDir));

  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
