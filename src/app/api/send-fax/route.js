import axios from 'axios';

export async function POST(request) {
  try {
    const { pdfUrl } = await request.json();

    // Use Vercel-specific environment variable
    const PYTHON_FAX_API_URL = process.env.PYTHON_FAX_API_URL || '/api/send-fax';

    try {
      const response = await axios.post(PYTHON_FAX_API_URL, { 
        pdfUrl 
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Fax sending failed');
      }

      return new Response(JSON.stringify({
        success: true,
        message: response.data.message
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (axiosError) {
      console.error('Axios error:', axiosError);
      
      return new Response(JSON.stringify({
        success: false,
        error: axiosError.response?.data?.error || 'Backend error occurred',
        details: axiosError.response?.data
      }), { 
        status: axiosError.response?.status || 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error.message
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}