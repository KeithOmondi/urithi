/// <reference types="node" />
import mongoose from "mongoose";
import dotenv from "dotenv";
import Record, { Form60Compliance, StatusAtGP } from "./models/record.model";
import Court from "./models/court.model";

dotenv.config();

const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://localhost:27017/orhc";
const DB_NAME = process.env.DB_NAME;

interface RawRecord {
  causeNo: string;
  nameOfDeceased: string;
  dateReceived: string;       // eCitizen date
  dateOfReceipt: string;      // registry receipt date
  dateForwardedToGP?: string;
  form60Compliance: Form60Compliance;
  statusAtGP: StatusAtGP;
  rejectionReason?: string;
  courtName: string;
}

// ─── SOURCE: Registry_Report_2026-01-30.pdf ──────────────────────────────────
// FILTERED: RUIRU LAW COURTS · MURANG'A HIGH COURT · KIAMBU HIGH COURT
// Note: No THIKA records appear anywhere in this report.
//
// Date approximation policy (applied where eCitizen date is missing):
//   dateReceived ≈ dateOfReceipt − 5 days  (typical ~5-day forwarding cycle)

const RAW_RECORDS: RawRecord[] = [

  // ── RUIRU LAW COURTS — pages 14-15 ───────────────────────────────────────
  // dateOfReceipt: 2026-01-27 | dateForwardedToGP: 2026-01-29 (2d FWD lead)

  {
    causeNo: "E006 OF 2026",
    nameOfDeceased: "JOSEPH WACHIRA MAINA",
    dateOfReceipt: "2026-01-27",
    dateReceived: "2026-01-13",   // eCitizen from report, REC lead 14d
    dateForwardedToGP: "2026-01-29",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },
  {
    causeNo: "E001 OF 2026",
    nameOfDeceased: "CECILIA MUTHONI KIMANI",
    dateOfReceipt: "2026-01-27",
    dateReceived: "2026-01-09",   // REC lead 18d
    dateForwardedToGP: "2026-01-29",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },
  {
    causeNo: "E190 OF 2025",
    nameOfDeceased: "MARGARET NJERI MUIRURI",
    dateOfReceipt: "2026-01-27",
    dateReceived: "2026-01-13",   // REC lead 14d
    dateForwardedToGP: "2026-01-29",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },
  {
    causeNo: "E112 OF 2025",
    nameOfDeceased: "NANCY WAMBUI MUCHERU",
    dateOfReceipt: "2026-01-27",
    dateReceived: "2025-09-01",   // REC lead 148d
    dateForwardedToGP: "2026-01-29",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },
  {
    // CORRIGENDA — eCitizen date shown as dash; approximated as dateOfReceipt − 5d
    causeNo: "E015 OF 2025",
    nameOfDeceased: "HANNAH WAIRIMU JUMA",
    dateOfReceipt: "2026-01-27",
    dateReceived: "2026-01-22",   // approximated: 2026-01-27 − 5d
    dateForwardedToGP: "2026-01-29",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },

  // ── RUIRU LAW COURTS — pages 60-62 ───────────────────────────────────────
  // dateOfReceipt: 2026-01-15 | dateForwardedToGP: 2026-01-16 (1d FWD lead)

  {
    causeNo: "E199/2025",
    nameOfDeceased: "JOSEPH MBURU NJUGUNA",
    dateOfReceipt: "2026-01-15",
    dateReceived: "2026-01-06",   // REC lead 9d
    dateForwardedToGP: "2026-01-16",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },
  {
    causeNo: "E198/2025",
    nameOfDeceased: "KIAI NGUGI",
    dateOfReceipt: "2026-01-15",
    dateReceived: "2025-12-24",   // REC lead 22d
    dateForwardedToGP: "2026-01-16",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },
  {
    causeNo: "E196/2025",
    nameOfDeceased: "KKIRU KAMA",              // as written in source report
    dateOfReceipt: "2026-01-15",
    dateReceived: "2025-12-18",   // REC lead 28d
    dateForwardedToGP: "2026-01-16",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },
  {
    causeNo: "E195/2025",
    nameOfDeceased: "WAIRIMU GACHONDE KIHIHU",
    dateOfReceipt: "2026-01-15",
    dateReceived: "2026-01-08",   // REC lead 7d
    dateForwardedToGP: "2026-01-16",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },
  {
    causeNo: "E194/2025",
    nameOfDeceased: "EUNICE WAMBUI NDIRITU",
    dateOfReceipt: "2026-01-15",
    dateReceived: "2025-12-18",   // REC lead 28d
    dateForwardedToGP: "2026-01-16",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },
  {
    causeNo: "E192/2025",
    nameOfDeceased: "JOHN MAINGI NG'ANG'A",
    dateOfReceipt: "2026-01-15",
    dateReceived: "2025-12-15",   // REC lead 31d
    dateForwardedToGP: "2026-01-16",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },
  {
    causeNo: "E191/2025",
    nameOfDeceased: "JOHN NDUNGU KIRURI",
    dateOfReceipt: "2026-01-15",
    dateReceived: "2025-12-31",   // REC lead 15d
    dateForwardedToGP: "2026-01-16",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },
  {
    causeNo: "E188/2025",
    nameOfDeceased: "ISABELLA WANJIRU NDONGA",
    dateOfReceipt: "2026-01-15",
    dateReceived: "2025-12-11",   // REC lead 35d
    dateForwardedToGP: "2026-01-16",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },
  {
    causeNo: "E187/2025",
    nameOfDeceased: "ISAAC MURIUKI NGATIA",
    dateOfReceipt: "2026-01-15",
    dateReceived: "2025-12-05",   // REC lead 41d
    dateForwardedToGP: "2026-01-16",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },
  {
    causeNo: "E184/2025",
    nameOfDeceased: "PENINA WANJIRU MARIGA",
    dateOfReceipt: "2026-01-15",
    dateReceived: "2025-12-01",   // REC lead 45d
    dateForwardedToGP: "2026-01-16",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },
  {
    causeNo: "E176/2025",
    nameOfDeceased: "ELIZABETH NYAMBURA MUIRURI",
    dateOfReceipt: "2026-01-15",
    dateReceived: "2025-11-20",   // REC lead 56d
    dateForwardedToGP: "2026-01-16",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },
  {
    causeNo: "E175/2025",
    nameOfDeceased: "FRANCIS JOHN MUTEITHIA",
    dateOfReceipt: "2026-01-15",
    dateReceived: "2025-12-01",   // REC lead 45d
    dateForwardedToGP: "2026-01-16",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },
  {
    causeNo: "E174/2025",
    nameOfDeceased: "DANIEL KIBURI CHEGE",
    dateOfReceipt: "2026-01-15",
    dateReceived: "2025-11-20",   // REC lead 56d
    dateForwardedToGP: "2026-01-16",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },
  {
    causeNo: "E097/2025",
    nameOfDeceased: "BETH NJERI NJIRI",
    dateOfReceipt: "2026-01-15",
    dateReceived: "2025-10-27",   // REC lead 80d
    dateForwardedToGP: "2026-01-16",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },
  {
    causeNo: "E066/2025",
    nameOfDeceased: "GITUNDU GITAU",
    dateOfReceipt: "2026-01-15",
    dateReceived: "2025-05-23",   // REC lead 237d
    dateForwardedToGP: "2026-01-16",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },
  {
    causeNo: "E009/2025",
    nameOfDeceased: "PENNINAH WANDIA MUHUHU",
    dateOfReceipt: "2026-01-15",
    dateReceived: "2025-02-18",   // REC lead 331d
    dateForwardedToGP: "2026-01-16",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },

  // ── RUIRU LAW COURTS — page 107 (CORRIGENDA, REJECTED, no forwarding) ────

  {
    causeNo: "E015/2025",
    nameOfDeceased: "HANNAH WAIRIMU JUMA",
    dateOfReceipt: "2026-01-15",
    dateReceived: "2025-03-04",   // REC lead 317d
    form60Compliance: Form60Compliance.REJECTED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "RUIRU LAW COURTS",
  },

  // ── MURANG'A HIGH COURT — page 20 (PENDING, no forwarding) ──────────────

  {
    causeNo: "E030/2025",
    nameOfDeceased: "BERNARD KIMANI MAINA",
    dateOfReceipt: "2026-01-26",
    dateReceived: "2026-01-21",   // REC lead 5d
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "MURANG'A HIGH COURT",
  },

  // ── MURANG'A HIGH COURT — page 38 ────────────────────────────────────────
  // dateOfReceipt: 2026-01-19 | dateForwardedToGP: 2026-01-29 (10d FWD lead)

  {
    causeNo: "E032/2025",
    nameOfDeceased: "VERONICA CYLIA WANGOI",
    dateOfReceipt: "2026-01-19",
    dateReceived: "2025-07-03",   // REC lead 200d
    dateForwardedToGP: "2026-01-29",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "MURANG'A HIGH COURT",
  },

  // ── KIAMBU HIGH COURT — pages 21, 23, 24 ─────────────────────────────────
  // dateOfReceipt: 2026-01-26 | dateForwardedToGP: 2026-01-29 (3d FWD lead)

  {
    causeNo: "E180/2025",
    nameOfDeceased: "SARAH NDUTA KIAMBI",
    dateOfReceipt: "2026-01-26",
    dateReceived: "2026-01-19",   // REC lead 7d
    dateForwardedToGP: "2026-01-29",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "KIAMBU HIGH COURT",
  },
  {
    causeNo: "E182/2025",
    nameOfDeceased: "MICHAEL KARANJA KIMANI",
    dateOfReceipt: "2026-01-26",
    dateReceived: "2025-12-31",   // REC lead 26d
    dateForwardedToGP: "2026-01-29",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "KIAMBU HIGH COURT",
  },
  {
    causeNo: "E176/2025",
    nameOfDeceased: "JACKSON KAGECHE GIKANGA",
    dateOfReceipt: "2026-01-26",
    dateReceived: "2025-12-16",   // REC lead 41d
    dateForwardedToGP: "2026-01-29",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "KIAMBU HIGH COURT",
  },
  {
    causeNo: "E169/2025",
    nameOfDeceased: "EDWARD JACKSON NJOROGE",
    dateOfReceipt: "2026-01-26",
    dateReceived: "2025-12-11",   // REC lead 46d
    dateForwardedToGP: "2026-01-29",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "KIAMBU HIGH COURT",
  },
  {
    causeNo: "E172/2025",
    nameOfDeceased: "ESTHER WAHITO KINUTHIA",
    dateOfReceipt: "2026-01-26",
    dateReceived: "2025-12-12",   // REC lead 45d
    dateForwardedToGP: "2026-01-29",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "KIAMBU HIGH COURT",
  },
  {
    causeNo: "E171/2025",
    nameOfDeceased: "JOYCE WAMBUI MBAI",
    dateOfReceipt: "2026-01-26",
    dateReceived: "2025-12-15",   // REC lead 42d
    dateForwardedToGP: "2026-01-29",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "KIAMBU HIGH COURT",
  },
  {
    causeNo: "E167/2025",
    nameOfDeceased: "SAMUEL NJOROGE NJENGA",
    dateOfReceipt: "2026-01-26",
    dateReceived: "2025-12-02",   // REC lead 55d
    dateForwardedToGP: "2026-01-29",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "KIAMBU HIGH COURT",
  },
  {
    causeNo: "E161/2025",
    nameOfDeceased: "HEZRON WAINAINA IGUKU",
    dateOfReceipt: "2026-01-26",
    dateReceived: "2025-11-20",   // REC lead 67d
    dateForwardedToGP: "2026-01-29",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "KIAMBU HIGH COURT",
  },
  {
    causeNo: "E136/2025",
    nameOfDeceased: "NELSON KAMAU MUHIA",
    dateOfReceipt: "2026-01-26",
    dateReceived: "2025-09-26",   // REC lead 122d
    dateForwardedToGP: "2026-01-29",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "KIAMBU HIGH COURT",
  },
  {
    causeNo: "E114/2025",
    nameOfDeceased: "NANCY WANGUI THUKU",
    dateOfReceipt: "2026-01-26",
    dateReceived: "2025-12-08",   // REC lead 49d
    dateForwardedToGP: "2026-01-29",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "KIAMBU HIGH COURT",
  },
  {
    causeNo: "E030/2020",
    nameOfDeceased: "ISAAC MUTURI GACHOGU",
    dateOfReceipt: "2026-01-26",
    dateReceived: "2025-12-01",   // REC lead 56d
    dateForwardedToGP: "2026-01-29",
    form60Compliance: Form60Compliance.APPROVED,
    statusAtGP: StatusAtGP.PENDING,
    courtName: "KIAMBU HIGH COURT",
  },
];

// ─── SEED FUNCTION ────────────────────────────────────────────────────────────

async function seed() {
  await mongoose.connect(MONGO_URI, ...(DB_NAME ? [{ dbName: DB_NAME }] : []));
  console.log(
    "✅ Connected to MongoDB:",
    MONGO_URI,
    "| DB:",
    mongoose.connection.name,
  );

  const uniqueCourtNames = [...new Set(RAW_RECORDS.map((r) => r.courtName))];
  const courtMap = new Map<string, mongoose.Types.ObjectId>();

  for (const name of uniqueCourtNames) {
    const court = await Court.findOne({ name: new RegExp(`^${name}$`, "i") });
    if (!court) {
      const all: { name: string }[] = await Court.find(
        {},
        { name: 1 },
      ).lean();
      console.error(`❌ Court '${name}' not found.`);
      console.error(
        "Courts in DB:",
        all.map((c) => `"${c.name}"`).join(", "),
      );
      await mongoose.disconnect();
      process.exit(1);
    }
    courtMap.set(name, court._id);
    console.log(`✅ Found court: ${court.name} (${court._id})`);
  }

  const lastRecord = await Record.findOne().sort({ no: -1 }).select("no");
  let nextNo = lastRecord ? lastRecord.no + 1 : 1;
  console.log(`ℹ️  Starting record no from: ${nextNo}`);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const raw of RAW_RECORDS) {
    const courtId = courtMap.get(raw.courtName)!;

    try {
      const exists = await Record.findOne({
        courtStation: courtId,
        causeNo: raw.causeNo.toUpperCase(),
      });

      if (exists) {
        console.log(
          `⚠️  Skipping duplicate: ${raw.causeNo} — ${raw.nameOfDeceased}`,
        );
        skipped++;
        continue;
      }

      const doc = new Record({
        no: nextNo++,
        courtStation: courtId,
        causeNo: raw.causeNo,
        nameOfDeceased: raw.nameOfDeceased,
        dateReceived: new Date(raw.dateReceived),
        dateOfReceipt: new Date(raw.dateOfReceipt),
        dateForwardedToGP: raw.dateForwardedToGP
          ? new Date(raw.dateForwardedToGP)
          : undefined,
        form60Compliance: raw.form60Compliance,
        statusAtGP: raw.statusAtGP,
        rejectionReason: raw.rejectionReason,
        kpiAlertSent: false,
      });

      await doc.save();
      console.log(
        `✅ Inserted [${doc.no}] ${raw.causeNo} — ${raw.nameOfDeceased}`,
      );
      inserted++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `❌ Failed: ${raw.causeNo} — ${raw.nameOfDeceased}:`,
        message,
      );
      failed++;
    }
  }

  console.log(`\n🎉 Done.`);
  console.log(`   ✅ Inserted:  ${inserted}`);
  console.log(`   ⚠️  Skipped:   ${skipped} (duplicates)`);
  console.log(`   ❌ Failed:    ${failed}`);
  await mongoose.disconnect();
}

seed().catch((err: unknown) => {
  console.error(
    "Fatal error:",
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});