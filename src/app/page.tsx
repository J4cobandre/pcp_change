"use client";
import { useState, useEffect, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { PDFDocument } from "pdf-lib";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function Home() {
  const [insurance, setInsurance] = useState("Healthfirst");
  const [location, setLocation] = useState("Hicksville");
  const [fields, setFields] = useState<{ field: string; required: boolean }[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const sigCanvas = useRef<SignatureCanvas | null>(null);

  useEffect(() => {
    fetch(`/api/get-form?insurance=${insurance}`)
      .then((res) => res.json())
      .then((data) => {
        // Only show fields that users need to fill in the website (Exclude Provider, Date, ProviderID)
        setFields(data.fields.filter((field: { field: string }) => !["Provider", "ProviderID", "Date"].includes(field.field)));
  
        // Fetch provider data when insurance & location change
        fetch(`/api/get-provider?insurance=${insurance}&location=${location}`)
          .then(res => res.json())
          .then(providerData => {
            if (providerData.provider_name && providerData.npi) {
              setFormData(prev => ({
                ...prev,
                Provider: providerData.provider_name,
                ProviderID: providerData.npi
              }));
            }
          })
          .catch(err => console.error("Provider fetch failed", err));
  
        // Initialize form data
        const initialFormData = data.fields.reduce((acc: Record<string, string>, field: { field: string }) => {
          acc[field.field] = "";
          return acc;
        }, {});
  
        setFormData(initialFormData);
      });
  }, [insurance, location]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleInitialSubmit = () => {
    if (sigCanvas.current && sigCanvas.current.isEmpty()) {
      alert("❌ Please provide a signature.");
      return;
    }
  
    if (sigCanvas.current) {
      const signatureData = sigCanvas.current.toDataURL();
      setFormData((prevData) => ({ ...prevData, Signature: signatureData }));
    }
  
    // ✅ Validate Birth Date on Button Click
    if ("Birth Date" in formData) {
      const dateRegex = /^(0[1-9]|1[0-2])\/([0-2][0-9]|3[01])\/\d{4}$/;
      if (!dateRegex.test(formData["Birth Date"])) {
        alert("❌ Birth Date is invalid. Please enter MM/DD/YYYY before proceeding.");
        return;
      }
    }
  
    // ✅ Validate All Other Required Fields
    for (const field of fields) {
      if (field.field === "Provider" || field.field === "ProviderID" || field.field === "Date") {
        continue; // Skip auto-filled fields
      }
  
      if (field.required && !formData[field.field]) {
        alert(`❌ Please fill in the required field: ${field.field}`);
        return;
      }
    }
  
    setReviewing(true);
  };

  const getTodayDate = (): string => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Ensure 2-digit month
    const day = String(today.getDate()).padStart(2, '0'); // Ensure 2-digit day
    const year = today.getFullYear(); // Get full year
  
    return `${month}/${day}/${year}`; // Format: MM/DD/YYYY
  };

  const uploadPdfToStorage = async (pdfBytes: Uint8Array, fileName: string) => {
    const storage = getStorage();
    const storageRef = ref(storage, `pcp_forms/${fileName}`);
    const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
  
    try {
      await uploadBytes(storageRef, pdfBlob);
      const downloadUrl = await getDownloadURL(storageRef);
      return downloadUrl;
    } catch (error) {
      console.error("❌ PDF Upload Failed:", error);
      return null;
    }
  };
  
  const fillAndGeneratePDF = async () => {
    try {
      const pdfTemplatePath =
      insurance === "Healthfirst"
        ? "/forms/healthfirst-form.pdf"
        : insurance === "United Healthcare"
        ? "/forms/unitedhealthcare-form.pdf"
        : insurance === "Anthem/Empire"
        ? "/forms/anthem-form.pdf"
        : insurance === "Aetna"
        ? "/forms/aetna-form.pdf"
        : insurance === "Fidelis"
        ? "/forms/fidelis-form.pdf"
        : insurance === "Humana"
        ? "/forms/humana-form.pdf"
        : insurance === "Wellcare"
        ? "/forms/wellcare-form.pdf"
        : insurance === "Wellpoint"
        ? "/forms/wellpoint-form.pdf"
        : "/forms/elder-form.pdf"; 
  
      const existingPdfBytes = await fetch(pdfTemplatePath).then(res => res.arrayBuffer());
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const form = pdfDoc.getForm();
  
      if (!form) {
        console.error("⚠ Failed to retrieve form fields.");
        return;
      }
  
      // 🔥 Get Provider Name + ID for the PDF
      let providerData = { provider_name: "N/A", npi: "N/A" };
      try {
        const response = await fetch(`/api/get-provider?insurance=${insurance}&location=${location}`);
        if (response.ok) {
          providerData = await response.json();
        } else {
          console.warn("⚠ No provider data found in database.");
        }
      } catch (err) {
        console.error("❌ Error fetching provider details:", err);
      }
      
      // 🔥 Split Provider Name into First & Last Name
      const providerNameTrimmed = providerData.provider_name.trim();
      const splitProviderName = providerData.provider_name.trim().split(" ");
      const providerFirstName = splitProviderName.length > 1 ? splitProviderName[0] : providerData.provider_name;
      const providerLastName = splitProviderName.length > 1 ? splitProviderName.slice(1).join(" ") : "";

      // 🔥 Fetch Provider Signature from `/signatures/` Directory (PNG)
      const providerSignaturePath = `/signatures/${providerData.provider_name.trim()}.png`;

      try {
        // **Fetch and embed provider signature**
        const providerSignatureBytes = await fetch(providerSignaturePath).then(res => res.arrayBuffer()); 
        const providerSignatureImage = await pdfDoc.embedPng(providerSignatureBytes); 

        const providerSignatureField = form.getButton("ProviderSignature");
        if (providerSignatureField) {
          providerSignatureField.setImage(providerSignatureImage); // ✅ Embedded like patient signature
        } else {
          console.warn("⚠ No Provider Signature field found in the PDF.");
        }
      } catch (err) {
        console.warn(`⚠ Provider Signature Not Found at: ${providerSignaturePath}`);
      }

      // 🔥 Dynamically Map Fields Based on Template
      const fieldMappings = insurance === "Healthfirst"
      ? [
          { pdfField: 'FirstName', formField: 'First Name' },
          { pdfField: 'LastName', formField: 'Last Name' },
          { pdfField: 'MemberID', formField: 'Subscriber ID' },
          { pdfField: 'PhoneNumber', formField: 'Phone Number' },
          { pdfField: 'Date', value: getTodayDate() },
          { pdfField: 'Provider', value: providerData.provider_name },
          { pdfField: 'ProviderID', value: providerData.npi }
        ]
      : insurance === "United Healthcare"
      ? [
          { pdfField: 'SubscriberID', formField: 'Subscriber ID' },
          { pdfField: 'FullName', formField: 'Full Name' },
          { pdfField: 'Address', formField: 'Address' },
          { pdfField: 'City', formField: 'City' },
          { pdfField: 'State', formField: 'State' },
          { pdfField: 'ZipCode', formField: 'Zip Code' },
          { pdfField: 'PhoneNumber', formField: 'Phone Number' },
          { pdfField: 'Date', value: getTodayDate() },
          { pdfField: 'Provider', value: providerData.provider_name },
          { pdfField: 'ProviderID', value: providerData.npi }
        ]
        : insurance === "Anthem/Empire"
        ? [
            { pdfField: 'FullName', formField: 'Full Name' },
            { pdfField: 'BirthDate', formField: 'Birth Date' },
            { pdfField: 'SubscriberID', formField: 'Subscriber ID' },
            { pdfField: 'State', formField: 'State' },
            { pdfField: 'PhoneNumber', formField: 'Phone Number' },
            { pdfField: 'Date', value: getTodayDate() },
            { pdfField: 'Provider', value: providerData.provider_name },
            { pdfField: 'ProviderID', value: providerData.npi }
          ]
        : insurance === "Aetna"
        ? [
            { pdfField: 'FirstName', formField: 'First Name' },
            { pdfField: 'MiddleInitial', formField: 'Middle Initial' },
            { pdfField: 'LastName', formField: 'Last Name' },
            { pdfField: 'BirthDate', formField: 'Birth Date' },
            { pdfField: 'SubscriberID', formField: 'Subscriber ID' },
            { pdfField: 'SSN', formField: 'SSN' },
            { pdfField: 'Address', formField: 'Address' },
            { pdfField: 'PhoneNumber', formField: 'Phone Number' },
            { pdfField: 'City', formField: 'City' },
            { pdfField: 'State', formField: 'State' },
            { pdfField: 'Zip', formField: 'Zip' },
            { pdfField: 'Date', value: getTodayDate() },
            { pdfField: 'Provider', value: providerData.provider_name },
            { pdfField: 'ProviderID', value: providerData.npi },
            { pdfField: 'FullName', value: `${formData["First Name"] || ''} ${formData["Middle Initial"] ? formData["Middle Initial"] + ' ' : ''}${formData["Last Name"] || ''}`.trim() }
          ]
        :  insurance === "Fidelis"
        ? [
            { pdfField: 'FirstName', formField: 'First Name' },
            { pdfField: 'LastName', formField: 'Last Name' },
            { pdfField: 'BirthDate', formField: 'Birth Date' },
            { pdfField: 'PolicyNumber', formField: 'Subscriber ID' },
            { pdfField: 'Date', value: getTodayDate() },
            { pdfField: 'Provider First Name', value: providerFirstName }, // 🔥 Insert Split First Name
            { pdfField: 'Provider Last Name', value: providerLastName }
          ]
        :  insurance === "Humana"
        ? [
            { pdfField: 'FullName', formField: 'Full Name' },
            { pdfField: 'BirthDate', formField: 'Birth Date' },
            { pdfField: 'SubscriberID', formField: 'Subscriber ID' },
            { pdfField: 'PhoneNumber', formField: 'Phone Number' },
            { pdfField: 'PCP Name', formField: 'Previous PCP' },
            { pdfField: 'PCP Location', formField: 'Previous PCP Location' },
            { pdfField: 'Date', value: getTodayDate() },
            { pdfField: 'Provider', value: providerData.provider_name },
          ]
        : insurance === "Wellcare"
        ? [
            { pdfField: 'FirstName', formField: 'First Name' },
            { pdfField: 'LastName', formField: 'Last Name' },
            { pdfField: 'BirthDate', formField: 'Birth Date' },
            { pdfField: 'PhoneNumber', formField: 'Phone Number' },
            { pdfField: 'SubscriberID', formField: 'Subscriber ID' },
            { pdfField: 'Date', value: getTodayDate() },
            { pdfField: 'PCP Name', formField: 'Previous PCP' },
            { pdfField: 'PCP Address', formField: 'Previous PCP Location' },
            { pdfField: 'Provider', value: providerData.provider_name },
            { pdfField: 'ProviderID', value: providerData.npi },
          ]
        :  insurance === "Wellpoint"
        ? [
            { pdfField: 'FullName', formField: 'Full Name' },
            { pdfField: 'BirthDate', formField: 'Birth Date' },
            { pdfField: 'PhoneNumber', formField: 'Phone Number' },
            { pdfField: 'State', formField: 'State' },
            { pdfField: 'SubscriberID', formField: 'Subscriber ID' },
            { pdfField: 'MedicaidID', formField: 'Medicaid ID' },
            { pdfField: 'Date', value: getTodayDate() },
            { pdfField: 'Provider', value: providerData.provider_name },
            { pdfField: 'ProviderID', value: providerData.npi }
          ]
        :  insurance === "Elder Plan"
        ? [
            { pdfField: 'FullName', formField: 'Full Name' },
            { pdfField: 'SubscriberID', formField: 'Subscriber ID' },
            { pdfField: 'PhoneNumber', formField: 'Phone Number' },
            { pdfField: 'Email', formField: 'Email' },
            { pdfField: 'Address', formField: 'Address' },
            { pdfField: 'City', formField: 'City' },
            { pdfField: 'Zip', formField: 'Zip' },
            { pdfField: 'Date', value: getTodayDate() },
            { pdfField: 'PCP Name', formField: 'Previous PCP' },
            { pdfField: 'Provider', value: providerData.provider_name }
          ]
        : []; //
  
      // 🔥 Fill PDF Form Fields
      fieldMappings.forEach(mapping => {
        const field = form.getTextField(mapping.pdfField);
        if (field) {
          const value = mapping.value ? mapping.value : (mapping.formField ? formData[mapping.formField] : '') || '';
          field.setText(value);
        } else {
          console.warn(`⚠ Field not found in PDF: ${mapping.pdfField}`);
        }
      });
  
      // 🔥 Insert Signature if Available
      if (formData.Signature) {
        const signatureImageBytes = await fetch(formData.Signature).then(res => res.arrayBuffer());
        const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
        
        const signatureField = form.getButton("Signature");
        if (signatureField) {
          signatureField.setImage(signatureImage);
        } else {
          console.warn("⚠ No signature field found in the PDF.");
        }
      }
  
      // 🔹 Upload PDF to Firebase Storage
      const pdfBytes = await pdfDoc.save();
      const pdfBase64 = Buffer.from(pdfBytes).toString("base64"); // Convert to Base64
  
      // Call API to Upload PDF
      fetch("/api/upload-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insurance,
          location,
          pdfBuffer: pdfBase64,
        }),
      })
        .then((res) => res.json())
        .then(async (data) => { // Use async/await to handle the faxing
          console.log("✅ PDF Uploaded:", data.pdfUrl);
  
          try {
            // Call the fax API after successful PDF upload
            const faxResponse = await fetch("/api/send-fax", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pdfUrl: data.pdfUrl }),
            });
            console.log("📠 Fax Response:", await faxResponse.json());
  
            if (!faxResponse.ok) {
              console.error("❌ Fax sending failed");
            }
            setSubmitted(true);
            console.log("Form is now submitted");
          } catch (faxError) {
            console.error("❌ Faxing failed:", faxError);
            alert("Faxing failed, please try again.");
            setSubmitted(true);
          }
        })
        .catch((error) => {
          console.error("❌ Failed to upload PDF:", error);
          alert("Failed to upload the PDF.");
          setSubmitted(true);
        });
    } catch (error) {
      console.error("❌ PDF Generation Failed:", error);
      alert("PDF generation failed, please try again.");
    }
  };

  const handleFinalSubmit = async () => {
    fetch("/api/submit-form", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insurance, location, ...formData }),
    })
      .then(() => {
        console.log("Submitting the form");
        setSubmitted(true);
        console.log("Form is now submitted"); // add this line
        fillAndGeneratePDF();
      })
      .catch(() => alert("Something went wrong!"));
  };

  const clearSignature = () => sigCanvas.current?.clear();

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-[#f5fbf4] p-6 font-['Adamina']">
      <div className="bg-white shadow-md rounded-lg p-6 w-full max-w-lg border-t-4 border-[#9acf8c]">
        <h1 className="text-2xl font-bold text-center text-[#1e3565] mb-6">PCP Change Form</h1>
  
        {!submitted ? (
          <>
            {!reviewing && (
              <>
                <label className="font-semibold text-[#1e3565]">Select Insurance:</label>
                <select
                  value={insurance}
                  onChange={(e) => setInsurance(e.target.value)}
                  className="p-2 border rounded w-full bg-white text-[#1e3565]"
                >
                  <option value="Healthfirst">Healthfirst</option>
                  <option value="United Healthcare">United Healthcare</option>
                  <option value="Anthem/Empire">Anthem/Empire</option>
                  <option value="Aetna">Aetna</option>
                  <option value="Fidelis">Fidelis</option>
                  <option value="Humana">Humana</option>
                  <option value="Wellcare">Wellcare</option>
                  <option value="Wellpoint">Wellpoint</option>
                  <option value="Elder Plan">Elder Plan</option>
                </select>
  
                <label className="font-semibold text-[#1e3565]">Select Location:</label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="p-2 border rounded w-full bg-white text-[#1e3565] mb-4"
                >
                  <option value="Astoria">Astoria</option>
                  <option value="Bartow">Bartow</option>
                  <option value="BX174">BX174</option>
                  <option value="Corona">Corona</option>
                  <option value="Crown Heights">Crown Heights</option>
                  <option value="Hicksville">Hicksville</option>
                  <option value="Jackson Heights">Jackson Heights</option>
                  <option value="Jamaica">Jamaica</option>
                  <option value="LIC">Long Island City</option>
                  <option value="Manhattan">Manhattan</option>
                  <option value="Mineola">Mineola</option>
                  <option value="Stuytown">Stuytown</option>
                  <option value="Williamsburg">Williamsburg</option>
                  <option value="Televisit">Televisit</option>
                </select>
              </>
            )}
  
            {/* Form Fields */}
            <div className="space-y-4 mt-4">
              {fields
                .filter(({ field }) => field !== "Provider" && field !== "ProviderID")
                .map(({ field, required }) => (
                  <div key={field}>
                    <label className="block font-medium text-[#1e3565]">
                      {field} {required && "*"}
                    </label>
  
                    {field === "Signature" ? (
                      <div className="border p-2 rounded bg-white">
                        {!reviewing ? (
                          <>
                            <SignatureCanvas
                              ref={sigCanvas}
                              canvasProps={{ className: "w-full h-24 bg-white border rounded" }}
                            />
                            <button
                              onClick={clearSignature}
                              className="mt-2 bg-gray-500 text-white px-3 py-1 rounded w-full"
                            >
                              Clear Signature
                            </button>
                          </>
                        ) : (
                          <img
                            src={formData.Signature}
                            alt="Signature Preview"
                            className="w-full h-24 border rounded"
                          />
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        name={field}
                        value={formData[field] || ""}
                        onChange={handleChange}
                        className="p-2 border w-full rounded bg-white"
                      />
                    )}
                  </div>
                ))}
            </div>
  
            <div className="mt-6 flex justify-between">
              {reviewing ? (
                <>
                  <button
                    onClick={() => setReviewing(false)}
                    className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-700 transition"
                  >
                    Edit Information
                  </button>
  
                  <button
                    onClick={fillAndGeneratePDF}
                    className="bg-[#1e3565] text-white px-6 py-2 rounded hover:bg-[#9acf8c] transition"
                  >
                    Submit
                  </button>
                </>
              ) : (
                <button
                  onClick={handleInitialSubmit}
                  className="w-full bg-[#1e3565] text-white p-3 rounded hover:bg-[#9acf8c] transition"
                >
                  Review Information
                </button>
              )}
            </div>
          </>
        ) : (
          // Show Thank You Page After Submission
          <div className="text-center mt-6">
            <h2 className="text-green-600 text-lg font-bold">Thank You!</h2>
            <p className="mt-2 text-gray-700">
              Your form has been submitted successfully.
            </p>
          </div>
        )}
      </div>
    </main>
  );  
}