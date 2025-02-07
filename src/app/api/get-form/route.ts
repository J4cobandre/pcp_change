export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const insurance = searchParams.get("insurance");

  const insuranceTemplates: { [key: string]: { field: string; required: boolean }[] } = {
    "Healthfirst": [
      { field: "First Name", required: true },
      { field: "Last Name", required: true },
      { field: "Subscriber ID", required: true },
      { field: "Phone Number", required: true },
      { field: "Signature", required: true },
    ],
    "United Healthcare": [
      { field: "Subscriber ID", required: true },
      { field: "Full Name", required: true },
      { field: "Address", required: true },
      { field: "City", required: true },
      { field: "State", required: true },
      { field: "Zip Code", required: true },
      { field: "Phone Number", required: true },
      { field: "Signature", required: true },
    ],
    "Anthem/Empire": [
      { field: "Full Name", required: true },
      { field: "Birth Date", required: true },
      { field: "Subscriber ID", required: true },
      { field: "State", required: true },
      { field: "Phone Number", required: true },
      { field: "Signature", required: true },
    ],
    "Aetna": [
      { field: "First Name", required: true },
      { field: "Middle Initial", required: false },
      { field: "Last Name", required: true },
      { field: "Birth Date", required: true },
      { field: "Subscriber ID", required: true },
      { field: "SSN", required: true },
      { field: "Address", required: true },
      { field: "Phone Number", required: true },
      { field: "City", required: true },
      { field: "State", required: true },
      { field: "Zip", required: true },
      { field: "Signature", required: true },
    ],
    "Fidelis": [
      { field: "First Name", required: true },
      { field: "Last Name", required: true },
      { field: "Birth Date", required: true },
      { field: "Subscriber ID", required: true },
      { field: "Signature", required: true },
    ],
    "Humana": [
      { field: "Full Name", required: true },
      { field: "Birth Date", required: true },
      { field: "Subscriber ID", required: true },
      { field: "Phone Number", required: true },
      { field: "Previous PCP", required: true },
      { field: "Previous PCP Location", required: true },
      { field: "Signature", required: true },
    ],
    "Wellcare": [
      { field: "First Name", required: true },
      { field: "Last Name", required: true },
      { field: "Birth Date", required: true },
      { field: "Phone Number", required: true },
      { field: "Subscriber ID", required: true },
      { field: "Previous PCP", required: true },
      { field: "Previous PCP Location", required: true },
      { field: "Signature", required: true },
    ],
    "Wellpoint": [
      { field: "Full Name", required: true },
      { field: "Birth Date", required: true },
      { field: "Phone Number", required: true },
      { field: "State", required: true },
      { field: "Subscriber ID", required: true },
      { field: "Medicaid ID", required: true },
      { field: "Signature", required: true },
    ],
    "Elder Plan": [
      { field: "Full Name", required: true },
      { field: "Subscriber ID", required: true },
      { field: "Phone Number", required: true },
      { field: "Email", required: true },
      { field: "Address", required: true },
      { field: "City", required: true },
      { field: "Zip", required: true },
      { field: "Previous PCP", required: true },
      { field: "Signature", required: true },
    ]
  };

  // 🔹 Fields for PDF Only (Not displayed in the UI)
  const pdfOnlyFields = [
    { field: "Provider", required: true },
    { field: "ProviderID", required: true },
    { field: "Date", required: true }
  ];

  return Response.json({ 
    fields: insuranceTemplates[insurance || ""] || [], 
    pdfFields: pdfOnlyFields
  });
}