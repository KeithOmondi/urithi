import mongoose from "mongoose";
import dotenv from "dotenv";
import Record, { calculateLeadTime } from "./models/record.model";

dotenv.config();

const fixAllLeadTimes = async () => {
  console.log("🔧 Recalculating lead times for all records...");

  // Connect to DB with explicit database name
  await mongoose.connect(process.env.MONGO_URI || "", {
    dbName: process.env.DB_NAME, // <-- explicitly specify DB
  });
  console.log("✅ Connected to MongoDB");

  // Fetch all records with relevant dates
  const records = await Record.find().select(
    "_id causeNo dateOfReceipt dateReceived dateForwardedToGP receivingLeadTime forwardingLeadTime"
  );

  if (records.length === 0) {
    console.log("⚠️ No records found in the database.");
    await mongoose.disconnect();
    return;
  }

  console.log(`ℹ️ Found ${records.length} record(s). Checking for negative lead times...`);

  // Filter and log records with negative lead times
  const negatives = records.filter(
    (r) =>
      (r.receivingLeadTime !== null && r.receivingLeadTime < 0) ||
      (r.forwardingLeadTime !== null && r.forwardingLeadTime < 0)
  );

  if (negatives.length > 0) {
    console.log(`⚠️ Found ${negatives.length} record(s) with negative lead times:`);
    negatives.forEach((r) =>
      console.log(
        `  - ${r.causeNo}: receivingLeadTime=${r.receivingLeadTime}, forwardingLeadTime=${r.forwardingLeadTime}`
      )
    );
  } else {
    console.log("✅ No negative lead times detected.");
  }

  // Build bulk operations to recalculate all lead times
  const operations = records.map((r) => {
    const dateOfReceipt = r.dateOfReceipt ? new Date(r.dateOfReceipt) : null;
    const dateReceived = r.dateReceived ? new Date(r.dateReceived) : null;
    const dateForwardedToGP = r.dateForwardedToGP
      ? new Date(r.dateForwardedToGP)
      : null;

    return {
      updateOne: {
        filter: { _id: r._id },
        update: {
          $set: {
            receivingLeadTime:
              dateOfReceipt && dateReceived
                ? calculateLeadTime(dateOfReceipt, dateReceived)
                : null,
            forwardingLeadTime:
              dateReceived && dateForwardedToGP
                ? calculateLeadTime(dateReceived, dateForwardedToGP)
                : null,
          },
        },
      },
    };
  });

  // Execute bulkWrite
  const result = await Record.bulkWrite(operations);

  console.log(`✅ Recalculated lead times for ${result.modifiedCount} record(s).`);

  // Disconnect from DB
  await mongoose.disconnect();
  console.log("✅ Disconnected from MongoDB");
};

fixAllLeadTimes().catch((err) => {
  console.error("❌ Error fixing lead times:", err);
});
