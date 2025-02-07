import { NextRequest, NextResponse } from "next/server";
import { adminStorage, adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { insurance, location, pdfBuffer } = await req.json();

    if (!insurance || !location || !pdfBuffer) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const fileName = `${insurance}_PCP_Form_${Date.now()}.pdf`;
    const bucket = adminStorage.bucket();
    const file = bucket.file(`pcp_forms/${fileName}`);

    // Uploading PDF as Buffer
    await file.save(Buffer.from(pdfBuffer, "base64"), {
      metadata: { contentType: "application/pdf" },
      public: true,
    });

    const downloadUrl = `https://storage.googleapis.com/${bucket.name}/pcp_forms/${fileName}`;

    await adminDb.collection("pcp_submissions").add({
      insurance,
      location,
      pdfUrl: downloadUrl,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ message: "Form uploaded successfully!", pdfUrl: downloadUrl }, { status: 200 });

  } catch (error) {
    console.error("❌ Upload Error:", error);
    return NextResponse.json({ error: "Failed to upload PDF" }, { status: 500 });
  }
}