import "dotenv/config"; // Load .env
import mongoose from "mongoose";
import { env } from "./config/env";
import { User, UserRole } from "./models/User";

// Default password for seeded users
const DEFAULT_PASSWORD = "Password123!";

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
    firstName: "Dennis",
    lastName: "Keith",
    email: "denniskeith62@gmail.com",
    pjNumber: "00045",
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

    for (const userData of users) {
      // Check if user already exists by email or pjNumber
      const existingUser = await User.findOne({ 
        $or: [{ email: userData.email }, { pjNumber: userData.pjNumber }] 
      });

      if (!existingUser) {
        // Let the model's pre-save hook hash the password
        await User.create({
          ...userData,
          password: DEFAULT_PASSWORD, // Raw password - model will hash
          isActive: true,
        });
        console.log(`✅ Seeded: ${userData.firstName} ${userData.lastName} (${userData.role})`);
      } else {
        // Update existing user's password if missing or incorrect
        if (!existingUser.password) {
          existingUser.password = DEFAULT_PASSWORD; // Let model hash it
          await existingUser.save();
          console.log(`🔄 Updated password for: ${userData.firstName} ${userData.lastName}`);
        } else {
          console.log(`⏩ Skipped: ${userData.firstName} ${userData.lastName} (already exists)`);
        }
      }
    }

    console.log("\n📋 Seed Summary:");
    console.log(`✅ Processed ${users.length} user(s)`);
    console.log(`🔑 Password for all users: ${DEFAULT_PASSWORD}`);
    console.log("\n⚠️  IMPORTANT: Change passwords on first login!");
    console.log("\n🎉 Script execution finished");
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding error:", err);
    process.exit(1);
  }
}

seedUsers();