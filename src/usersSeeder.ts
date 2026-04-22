import "dotenv/config"; // Load .env
import mongoose from "mongoose";
import { env } from "./config/env";
import { User, UserRole } from "./models/User";

// Seed data
const users = [
  {
    firstName: "Hon. Clara",
    lastName: "Otieno",
    email: "claraotieno23@gmail.com",
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
    email: "denniskeith62@gmail.com",
    pjNumber: "00045",
    role: UserRole.USER,
  },
{
    firstName: "Eva",
    lastName: "Kimeiywo",
    email: "evakimeiywo@gmail.com",
    pjNumber: "00000",
    role: UserRole.GP,
  },
  {
    firstName: "Miriam",
    lastName: "Nderitu",
    email: "mirndesh@gmail.com",
    pjNumber: "00001",
    role: UserRole.GP,
  },
  {
    firstName: "Hon. E.",
    lastName: "Malizu",
    email: "malizuedith@gmail.com",
    pjNumber: "12345",
    role: UserRole.GP,
  },
  
];

async function seedUsers() {
  try {
    await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME });
    console.log(`✅ Connected to MongoDB: ${mongoose.connection.name}`);

    // 1. REMOVED: await User.deleteMany({}); 
    // This ensures existing users stay in the database.

    for (const userData of users) {
      // 2. USE upsert logic to prevent duplicate errors 
      // This checks if a user with that email or pjNumber already exists
      const existingUser = await User.findOne({ 
        $or: [{ email: userData.email }, { pjNumber: userData.pjNumber }] 
      });

      if (!existingUser) {
        await User.create(userData);
        console.log(`👤 Seeded New: ${userData.firstName} ${userData.lastName}`);
      } else {
        console.log(`⏩ Skipped (Already Exists): ${userData.firstName} ${userData.lastName}`);
      }
    }

    console.log("🎉 Script execution finished");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding error:", err);
    process.exit(1);
  }
}

seedUsers();
