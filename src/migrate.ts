import { MongoClient, Db, Collection } from "mongodb";
import { env } from "../src/config/env";

/* =========================
   ENV VALIDATION
========================= */

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`❌ Missing environment variable: ${name}`);
  }
  return value;
}

const SOURCE_URI = requireEnv(env.MONGO_URI, "MONGO_URI");
const TARGET_URI = requireEnv(env.MONGO_URI_TARGET, "MONGO_URI_TARGET");

const SOURCE_DB = requireEnv(env.DB_NAME, "DB_NAME");
const TARGET_DB = requireEnv(env.DB_NAME_TARGET, "DB_NAME_TARGET");

/* =========================
   CONFIG
========================= */

const BATCH_SIZE = 1000;

/* =========================
   MIGRATION
========================= */

async function migrate(): Promise<void> {
  console.log("🚀 Starting MongoDB migration");

  const sourceClient = new MongoClient(SOURCE_URI);
  const targetClient = new MongoClient(TARGET_URI);

  try {
    await sourceClient.connect();
    await targetClient.connect();

    const sourceDb: Db = sourceClient.db(SOURCE_DB);
    const targetDb: Db = targetClient.db(TARGET_DB);

    const collections = await sourceDb.collections();

    for (const sourceCol of collections) {
      const collectionName = sourceCol.collectionName;
      console.log(`\n📦 Migrating collection: ${collectionName}`);

      const targetCol: Collection = targetDb.collection(collectionName);

      // ⚠️ Clears target collection (remove if merging is desired)
      await targetCol.deleteMany({});

      const cursor = sourceCol.find({});
      let batch: any[] = [];
      let migratedCount = 0;

      for await (const doc of cursor) {
        batch.push(doc);

        if (batch.length >= BATCH_SIZE) {
          await targetCol.insertMany(batch, { ordered: false });
          migratedCount += batch.length;
          console.log(`   ➜ ${migratedCount} documents migrated`);
          batch = [];
        }
      }

      if (batch.length > 0) {
        await targetCol.insertMany(batch, { ordered: false });
        migratedCount += batch.length;
      }

      console.log(`✅ ${collectionName} completed (${migratedCount} docs)`);
    }

    console.log("\n🎉 Migration completed successfully");
  } finally {
    await sourceClient.close();
    await targetClient.close();
  }
}

/* =========================
   RUN
========================= */

migrate().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
