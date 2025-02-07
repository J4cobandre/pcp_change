import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic"; // Ensure the API route runs on the server

export async function POST(req: NextRequest) {
  try {
    const { insurance, location, pdfUrl } = await req.json();

    if (!insurance || !location || !pdfUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await adminDb.collection("pcp_submissions").add({
      insurance,
      location,
      pdfUrl,
      timestamp: new Date().toISOString(), // Store human-readable timestamp
    });

    return NextResponse.json({ message: "Form submitted successfully!" }, { status: 200 });

  } catch (error) {
    console.error("❌ Database Error:", error);
    return NextResponse.json({ error: "Failed to save submission" }, { status: 500 });
  }
}