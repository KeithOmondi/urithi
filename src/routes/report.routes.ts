// routes/report.routes.ts
import express from "express";
import { getRegistryAnalytics } from "../controllers/report.controller";

const router = express.Router();

router.get("/analytics", getRegistryAnalytics);

export default router;