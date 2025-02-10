import * as admin from "firebase-admin";

// ✅ Initialize only if Firebase Admin is not already initialized
if (!admin.apps.length) {
  try {
    // Parse the service account key from environment variable
    const serviceAccountKeyStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (!serviceAccountKeyStr) {
      throw new Error("Firebase service account key is not defined");
    }

    const serviceAccountKey = JSON.parse(serviceAccountKeyStr);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountKey),
      storageBucket: "gs://pcpchangepatient.firebasestorage.app",
    });
  } catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
    // Optionally, you could throw the error to prevent app startup
    // throw error;
  }
}

export const adminDb = admin.firestore();
export const adminStorage = admin.storage();
