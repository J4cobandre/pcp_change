import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin"; // Firebase Admin Database Initialization
import { Timestamp } from 'firebase-admin/firestore'; // Add this import

export const dynamic = "force-dynamic"; // Ensure the API route is server-side only

export async function POST(req: NextRequest) {
  try {
    const { insurance, location, pdfUrl } = await req.json(); // Include PDF URL in the request

    // Validate request data
    if (!insurance || !location || !pdfUrl) {
      return NextResponse.json({ error: "Missing required fields: insurance, location, and pdfUrl are required." }, { status: 400 });
    }

    // Store the form submission info in Firestore
    const docRef = await adminDb.collection("pcp_submissions").add({
      insurance,
      location,
      pdfUrl,
      timestamp: Timestamp.now(), 
    });

    console.log("✅ Form submission stored in Firestore with ID:", docRef.id);

    // Trigger faxing using fetch to your send-fax API
    const faxResponse = await fetch('/api/send-fax', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfUrl }), // Include PDF URL for faxing
    });

    // Log and handle the fax response
    const faxData = await faxResponse.json();
    console.log("📠 Fax Response:", faxData);

    if (!faxResponse.ok) {
      console.error("❌ Fax sending failed:", faxData);
      // Consider adding error handling or retry logic here
    }

    return NextResponse.json({ message: "Form submitted and fax sent successfully!", submissionId: docRef.id }, { status: 200 });

  } catch (error) {
    console.error("❌ Error:", error);
    return NextResponse.json({ error: "Failed to save submission or send fax" }, { status: 500 });
  }
}