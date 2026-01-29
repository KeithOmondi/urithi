import os from "os";
import mongoose from "mongoose";
import { env } from "./env";

const formatBytes = (bytes: number) =>
  `${Math.round((bytes / 1024 / 1024) * 100) / 100} MB`;

export const getSystemMetrics = () => {
  const memoryUsage = process.memoryUsage();

  return {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),

    memory: {
      rss: formatBytes(memoryUsage.rss),
      heapTotal: formatBytes(memoryUsage.heapTotal),
      heapUsed: formatBytes(memoryUsage.heapUsed)
    },

    cpu: {
      loadAverage: os.loadavg(), // 1, 5, 15 min
      cores: os.cpus().length
    },

    version: {
      app: env.APP_VERSION,
      commit: env.COMMIT_HASH,
      node: process.version
    }
  };
};

export const isDatabaseReady = () => {
  return mongoose.connection.readyState === 1;
};
