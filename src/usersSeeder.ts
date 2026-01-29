/**
 * usersSeeder.ts
 * ----------------------
 * Fully bulletproof seeder for Users.
 * Ensures data goes to the correct DB (env.DB_NAME) and never to `test`.
 */

import "dotenv/config"; // Load .env
import mongoose from "mongoose";
import { env } from "./config/env";

const users = [
  {
    firstName: "Hon. Clara",
    lastName: "Otieno",
    email: "claraotieno23@gmail.com",
    pjNumber: "43244",
    password: "43244",
    role: "admin", // or UserRole.ADMIN if enum is available
  },
  {
    firstName: "Hon. Edith",
    lastName: "Malizu",
    email: "edithmalizu@gmail.com",
    pjNumber: "10001",
    password: "10001",
    role: "user",
  },
  {
    firstName: "James",
    lastName: "Kamotho",
    email: "jimkamau177@gmail.com",
    pjNumber: "66242",
    password: "66242",
    role: "user",
  },
  {
    firstName: "Easter",
    lastName: "Kasina",
    email: "essykasina@gmail.com",
    pjNumber: "22400",
    password: "22400",
    role: "user",
  },
  {
    firstName: "Britney",
    lastName: "Ouma",
    email: "oumabritney@gmail.com",
    pjNumber: "000132",
    password: "000132",
    role: "user",
  },
  {
    firstName: "Cynthia",
    lastName: "Atieno",
    email: "cynthia.atieno06@gmail.com",
    pjNumber: "68870",
    password: "68870",
    role: "user",
  },
  {
    firstName: "Dennis",
    lastName: "Isoe",
    email: "johnpaulopenda2005@gmail.com",
    pjNumber: "37283",
    password: "37293",
    role: "user",
  },
];

async function seedUsers() {
  try {
    // 🔥 Connect to MongoDB with explicit DB name
    await mongoose.connect(env.MONGO_URI, {
      dbName: env.DB_NAME,
    });

    console.log(`✅ Connected to MongoDB: ${mongoose.connection.name}`);

    // Lazy-import the User model AFTER connection
    const { User } = await import("./models/User");

    // Clear existing users
    await User.deleteMany({});
    console.log("🧹 Cleared existing users");

    // Seed users one by one so middleware/hooks run
    for (const user of users) {
      await User.create(user);
      console.log(`👤 Seeded: ${user.firstName} ${user.lastName}`);
    }

    console.log("🎉 Successfully seeded users");

    // Disconnect cleanly
    await mongoose.disconnect();
    console.log("🟡 MongoDB disconnected");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding error:", err);
    process.exit(1);
  }
}

seedUsers();
