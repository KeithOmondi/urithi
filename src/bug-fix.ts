// src/scripts/bug-fix.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import { env } from "./config/env";
import Record from "./models/record.model";

dotenv.config();

async function run() {
  if (!env.MONGO_URI) {
    throw new Error("❌ MONGO_URI missing");
  }

  await mongoose.connect(env.MONGO_URI);
  console.log("🔧 Starting lead-time repair...");

  const result = await Record.updateMany(
    {},
    [
      {
        $set: {
          receivingLeadTime: {
            $cond: [
              {
                $and: [
                  { $ne: ["$dateOfReceipt", null] },
                  { $ne: ["$dateReceived", null] },
                ],
              },
              {
                $ceil: {
                  $divide: [
                    {
                      $abs: {
                        $subtract: [
                          { $toDate: "$dateReceived" },
                          { $toDate: "$dateOfReceipt" },
                        ],
                      },
                    },
                    1000 * 60 * 60 * 24,
                  ],
                },
              },
              null,
            ],
          },
          forwardingLeadTime: {
            $cond: [
              {
                $and: [
                  { $ne: ["$dateReceived", null] },
                  { $ne: ["$dateForwardedToGP", null] },
                ],
              },
              {
                $ceil: {
                  $divide: [
                    {
                      $abs: {
                        $subtract: [
                          { $toDate: "$dateForwardedToGP" },
                          { $toDate: "$dateReceived" },
                        ],
                      },
                    },
                    1000 * 60 * 60 * 24,
                  ],
                },
              },
              null,
            ],
          },
        },
      },
      {
        $unset: "leadTime",
      },
    ],
    {
      updatePipeline: true, // 🔥 REQUIRED
    }
  );

  console.log(`✅ Records matched: ${result.matchedCount}`);
  console.log(`✏️ Records modified: ${result.modifiedCount}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
