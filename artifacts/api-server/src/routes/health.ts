// @ts-nocheck
import express from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router = express.Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
