import http from "http";
import { connectDB } from "./config/db";
import mongoose from "mongoose";
import { env } from "./config/env";

let server: http.Server;

const startServer = async () => {
  await connectDB();

  // Lazy-import models after connection
  await import("./models/User");
  await import("./models/record.model");
  // ...all other models

  // Now import app AFTER models are ready
  const { default: app } = await import("./app");

  server = app.listen(env.PORT, () => {
    console.log(`✅ Server running on port ${env.PORT}`);
  });
};

startServer();
