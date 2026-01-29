import mongoose from "mongoose";
import { env } from "./env";

const MONGO_URI = env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error("❌ MONGO_URI is missing in environment variables.");
}

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(env.MONGO_URI, {
      dbName: env.DB_NAME || "PRF60",
    });

    console.log(
      `🟢 MongoDB connected to database '${mongoose.connection.name}'`
    );
  } catch (error) {
    console.error("🔴 MongoDB connection error:", error);
    setTimeout(connectDB, 5000);
  }
};


// Disconnect helper
export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log("🟡 MongoDB disconnected");
  } catch (err) {
    console.error("🔴 Error disconnecting MongoDB:", err);
  }
};

// Graceful shutdown (e.g., docker stop, nodemon restart)
process.on("SIGINT", async () => {
  await disconnectDB();
  process.exit(0);
});
