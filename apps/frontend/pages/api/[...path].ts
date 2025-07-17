import { NextApiRequest, NextApiResponse } from 'next';

const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';

/**
 * Handle incoming API requests by forwarding them to an API Gateway.
 * @example
 * handler(req, res)
 * Sends response with forwarded data or error message
 * @param {NextApiRequest} req - Incoming request object containing method, headers, and body.
 * @param {NextApiResponse} res - Response object used to send data back to the client.
 * @returns {void} Sends a JSON response back to the client with the forwarded data or an error message.
 * @description
 *   - Extracts the specific API path from the request URL for routing.
 *   - Forwards request method, headers, and body to the API Gateway.
 *   - Handles both GET and non-GET HTTP methods appropriately.
 *   - Manages errors by logging them and sending a 500 status response.
 */
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
      body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
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
