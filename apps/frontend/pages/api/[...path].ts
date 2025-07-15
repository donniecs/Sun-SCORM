import { NextApiRequest, NextApiResponse } from 'next';

const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3001';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { method, headers, body } = req;
    
    // Extract the path after /api/
    const path = req.url?.replace('/api/', '') || '';
    
    // Forward the request to the API Gateway
    const response = await fetch(`${API_GATEWAY_URL}/${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': headers.authorization || '',
      },
      body: method !== 'GET' ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    
    // Forward the response status and data
    res.status(response.status).json(data);
  } catch (error) {
    console.error('API Proxy Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
}
