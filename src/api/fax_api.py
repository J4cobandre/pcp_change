from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import tempfile
import urllib.parse
import requests
from ringcentral import SDK

app = Flask(__name__)
CORS(app)

# Load credentials from environment variables
def load_credentials():
    return {
        'clientId': os.environ.get('RINGCENTRAL_CLIENT_ID'),
        'clientSecret': os.environ.get('RINGCENTRAL_CLIENT_SECRET'),
        'server': os.environ.get('RINGCENTRAL_SERVER', 'https://platform.ringcentral.com'),
        'jwt': {
            'autofax': os.environ.get('RINGCENTRAL_JWT')
        }
    }

# Initialize RingCentral SDK
credentials = load_credentials()
rcsdk = SDK(
    credentials['clientId'], 
    credentials['clientSecret'], 
    credentials['server']
)
platform = rcsdk.platform()

def initialize_platform():
    """Log in to RingCentral platform"""
    try:
        platform.login(jwt=credentials['jwt']['autofax'])
        print("✅ Successfully logged into RingCentral")
    except Exception as error:
        print(f"❌ Failed to authenticate to RingCentral: {error}")
        raise

def get_fax_number_from_pdf_name(file_url):
    """Determine fax number based on filename"""
    filename = os.path.basename(urllib.parse.urlparse(file_url).path)
    
    mapping = {
        'Healthfirst': '+15166651328',
        'UHC': '+15166651328',
        'Aetna': '+15166651328',
        'Fidelis': '+15166651328',
        'Wellcare': '+15166651328',
        'Humana': '+15166651328',
        'Wellpoint': '+15166651328',
        'Elder Plan': '+15166651328'
    }

    for key, fax_number in mapping.items():
        if key.lower() in filename.lower():
            return fax_number
    
    return None

def format_fax_number(fax_number):
    """Ensure fax number is in E.164 format"""
    if not fax_number.startswith('+'):
        # Remove non-digit characters and prepend +1
        return f'+1{"".join(filter(str.isdigit, fax_number))}'
    return fax_number

def download_pdf_from_firebase(file_url):
    """Download PDF from Firebase"""
    try:
        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            print(f"📥 Starting PDF download from: {file_url}")
            
            # Download the file
            response = requests.get(file_url)
            
            if response.status_code != 200:
                raise Exception(f"Failed to download PDF. Status: {response.status_code}")
            
            # Write to temporary file
            temp_file.write(response.content)
            temp_file_path = temp_file.name
        
        print(f"✅ PDF downloaded and saved at: {temp_file_path}")
        return temp_file_path
    
    except Exception as error:
        print(f"❌ Error downloading PDF from Firebase: {error}")
        return None

def send_fax(file_url, recipient):
    """Send fax using RingCentral"""
    temp_file_path = None
    try:
        # Initialize platform
        initialize_platform()

        # Format recipient number
        formatted_recipient = format_fax_number(recipient)
        print(f"📡 Preparing to send fax to: {formatted_recipient}")

        # Download PDF
        temp_file_path = download_pdf_from_firebase(file_url)
        
        if not temp_file_path:
            raise Exception("Failed to download PDF from Firebase")

        # Prepare fax parameters
        body_params = {
            'to': [{'phoneNumber': formatted_recipient}],
            'faxResolution': 'High',
            'coverPageText': 'PCP Change Form'
        }

        # Create multipart builder
        builder = rcsdk.create_multipart_builder()
        builder.set_body(body_params)

        # Add PDF attachment
        with open(temp_file_path, 'rb') as f:
            attachment = (os.path.basename(temp_file_path), f.read(), 'application/pdf')
            builder.add(attachment)

        # Send fax
        account_id = '~'
        extension_id = '~'
        request = builder.request(f'/restapi/v1.0/account/{account_id}/extension/{extension_id}/fax')
        response = platform.send_request(request)

        # Check response
        if not response.ok:
            error_message = f"Failed to send fax: {response.status} {response.reason}"
            print(f"❌ Response error: {error_message}")
            print(f"❌ Error response body: {response.text}")
            raise Exception(error_message)

        print("✅ FAX sent successfully")
        return "fax_sent"

    except Exception as error:
        print(f"❌ Error sending fax: {error}")
        raise
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                print(f"🧹 Deleted temp file: {temp_file_path}")
            except Exception as unlink_error:
                print(f"⚠️ Warning: Could not delete temporary file: {unlink_error}")
            
def handler(request):
    # Handle CORS preflight requests
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
        return ('', 204, headers)
    
    # Convert Flask-style request to Vercel request
    if request.method == 'POST':
        data = request.get_json()
        
        # Your existing send_fax_route logic
        try:
            pdf_url = data.get('pdfUrl') if data else None

            if not pdf_url:
                return jsonify({
                    'success': False,
                    'error': 'PDF URL is required'
                }), 400

            fax_number = get_fax_number_from_pdf_name(pdf_url)

            if not fax_number:
                return jsonify({
                    'success': False,
                    'error': 'Fax number not found'
                }), 400

            print(f"Received PDF URL: {pdf_url}")
            print(f"Mapped fax number: {fax_number}")

            try:
                # Send fax
                send_fax(pdf_url, fax_number)

                # Return successful response
                return jsonify({
                    'success': True,
                    'message': 'Fax sent successfully'
                }), 200

            except Exception as fax_error:
                print(f"❌ Fax sending error: {fax_error}")
                return jsonify({
                    'success': False,
                    'error': 'Failed to send fax',
                    'details': str(fax_error)
                }), 500

        except Exception as error:
            print(f"❌ Unexpected error in send_fax_route: {error}")
            return jsonify({
                'success': False,
                'error': 'Internal server error',
                'details': str(error)
            }), 500

# This is important for Vercel
app.route('/api/send-fax', methods=['POST', 'OPTIONS'])(handler)

# For local development
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)