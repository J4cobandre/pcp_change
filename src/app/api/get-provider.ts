import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';

// Initialize SQLite Database
const db = new Database('par_log.db', { fileMustExist: true });

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const insurance = url.searchParams.get("insurance");
    const location = url.searchParams.get("location");

    if (!insurance || !location) {
      return NextResponse.json({ error: "Missing insurance or location" }, { status: 400 });
    }

    // Define mappings so "Healthfirst" gets matched properly
    const insuranceMappings: Record<string, string[]> = {
      "Healthfirst": ["Healthfirst Medicaid", "Healthfirst Medicare", "Healthfirst Other LOB"],
      // Add mappings for other insurances later
    };

    // Get mapped insurance names
    const mappedInsurances = insuranceMappings[insurance] || [insurance];

    // Run the query to get the best provider based on priority
    const stmt = db.prepare(`
      SELECT provider_name, npi
      FROM provider
      WHERE provider.insurance IN (${mappedInsurances.map(() => '?').join(',')})
      AND provider.location = ?
      ORDER BY provider.priority ASC
      LIMIT 1
    `);

    const provider = stmt.get(...mappedInsurances, location);

    if (!provider) {
      return NextResponse.json({ message: "No provider found" }, { status: 404 });
    }

    return NextResponse.json(provider, { status: 200 });

  } catch (error) {
    return NextResponse.json({ error: "Database query failed" }, { status: 500 });
  }
}