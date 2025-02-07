import * as admin from "firebase-admin";
import fs from "fs";
import path from "path";

const serviceAccountPath = path.join(process.cwd(), "config", "serviceAccountKey.json");

// ✅ Initialize only if Firebase Admin is not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"))),
    storageBucket: "gs://pcpchangepatient.firebasestorage.app",
  });
}

export const adminDb = admin.firestore();
export const adminStorage = admin.storage();