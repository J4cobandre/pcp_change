import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';

const db = new Database('database/par_log.db', { fileMustExist: true });

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const insurance = url.searchParams.get("insurance");
    const location = url.searchParams.get("location");

    console.log("🚀 Incoming Request:", { insurance, location });

    if (!insurance || !location) {
      console.error("❌ Missing parameters:", { insurance, location });
      return NextResponse.json({ error: "Missing insurance or location" }, { status: 400 });
    }

    // 🔹 **Location Mappings (Frontend -> Database Values)**
    const locationMappings: Record<string, string> = {
      "Astoria": "Astoria",
      "Bartow": "Bartow",
      "BX174": "BX174",
      "Corona": "Corona",
      "Crown Heights": "Crown Heights",
      "Hicksville": "Hicksville",
      "Jackson Heights": "Jackson Heights",
      "Jamaica": "Jamaica",
      "LIC": "Long Island City",
      "Manhattan": "Manhattan",
      "Mineola": "Mineola",
      "Stuytown": "Stuytown",
      "Williamsburg": "Williamsburg",
      "Televisit": "Televisit"
    };

    const dbLocation = locationMappings[location] || location;

    // 🔹 **Insurance Mappings**
    const insuranceMappings: Record<string, string[]> = {
      "Healthfirst": ["Healthfirst Medicaid", "Healthfirst Medicare", "Healthfirst Other LOB"],
      "United Healthcare": ["UHC Medicare", "UHC Medicaid NY", "UHC Other LOB"],
      "Anthem/Empire": ["BCBS Empire","BC Empire"],
    };

    const mappedInsurances = insuranceMappings[insurance] || [insurance];

    console.log("🔍 Mapped Insurances:", mappedInsurances, "🗺 Mapped Location:", dbLocation);

    // **SQL Query Using UNION for Prioritized Matching**
    const stmt = db.prepare(`
      SELECT provider_name, npi 
      FROM (
        -- 🔹 First, get exact location match
        SELECT provider_name, npi, priority, 1 AS match_type
        FROM providers
        WHERE insurance IN (${mappedInsurances.map(() => '?').join(',')})
        AND LOWER(location) = LOWER(?)

        UNION

        -- 🔹 If no match, get 'ALL' locations option
        SELECT provider_name, npi, priority, 2 AS match_type
        FROM providers
        WHERE insurance IN (${mappedInsurances.map(() => '?').join(',')})
        AND LOWER(location) = 'all'
      )
      ORDER BY match_type ASC, priority ASC
      LIMIT 1;
    `);

    console.log("⬇ SQL Query:", stmt.source);
    console.log("📥 Query Params:", [...mappedInsurances, dbLocation, ...mappedInsurances]);

    const provider = stmt.get(...mappedInsurances, dbLocation, ...mappedInsurances);

    if (!provider) {
      console.warn("⚠ No provider found for:", { insurance, dbLocation });
      return NextResponse.json({ message: "No provider found" }, { status: 404 });
    }

    console.log("✅ Provider Found:", provider);
    return NextResponse.json(provider, { status: 200 });

  } catch (error) {
    console.error("❌ Database Query Failed:", error);
    return NextResponse.json({ error: "Database query failed" }, { status: 500 });
  }
}