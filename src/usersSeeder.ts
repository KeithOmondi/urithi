import "dotenv/config"; // Load .env
import mongoose from "mongoose";
import { env } from "./config/env";
import { User, UserRole } from "./models/User"; // Import User model & enum

// Seed data
const users = [
  {
    firstName: "Hon. Clara",
    lastName: "Otieno",
    email: "kd.omondi1@gmail.com",
    pjNumber: "43244",
    role: UserRole.ADMIN,
  },
  {
    firstName: "Hon. Edith",
    lastName: "Malizu",
    email: "edithmalizu@gmail.com",
    pjNumber: "46446",
    role: UserRole.USER,
  },
  {
    firstName: "James",
    lastName: "Kamotho",
    email: "jimkamau177@gmail.com",
    pjNumber: "66242",
    role: UserRole.USER,
  },
  {
    firstName: "Easter",
    lastName: "Kasina",
    email: "essykasina@gmail.com",
    pjNumber: "22400",
    role: UserRole.USER,
  },
  {
    firstName: "Britney",
    lastName: "Ouma",
    email: "oumabritney@gmail.com",
    pjNumber: "000132",
    role: UserRole.USER,
  },
  {
    firstName: "Cynthia",
    lastName: "Atieno",
    email: "cynthia.atieno06@gmail.com",
    pjNumber: "68870",
    role: UserRole.USER,
  },
  {
    firstName: "Dennis",
    lastName: "Isoe",
    email: "johnpaulopenda2005@gmail.com",
    pjNumber: "37293",
    role: UserRole.USER,
  },
  {
    firstName: "Dennis",
    lastName: "Keith",
    email: "denniskeith62@@gmail.com",
    pjNumber: "00045",
    role: UserRole.USER,
  },
];

async function seedUsers() {
  try {
    // Connect to MongoDB with explicit DB name
    await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME });
    console.log(`✅ Connected to MongoDB: ${mongoose.connection.name}`);

    // Clear existing users
    await User.deleteMany({});
    console.log("🧹 Cleared existing users");

    // Seed users one by one so schema hooks run properly
    for (const user of users) {
      await User.create(user);
      console.log(`👤 Seeded: ${user.firstName} ${user.lastName} (${user.pjNumber})`);
    }

    console.log("🎉 Successfully seeded users");

    // Disconnect
    await mongoose.disconnect();
    console.log("🟡 MongoDB disconnected");

    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding error:", err);
    process.exit(1);
  }
}

seedUsers();
