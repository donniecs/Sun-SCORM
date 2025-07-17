/**
 * API Proxy for Sun-SCORM Platform
 * 
 * This proxy forwards all frontend API requests to the API Gateway
 * Enables frontend (port 3006) to communicate with API Gateway (port 3000)
 * 
 * Critical for PHASE 4 implementation - fixes frontend-backend connection failure
 */

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
    
    // Log proxy requests in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API PROXY] ${method} ${req.url} -> ${API_GATEWAY_URL}/${path}`);
    }
    
    // Prepare headers for forwarding
    const forwardHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Forward authorization header if present
    if (headers.authorization) {
      forwardHeaders['Authorization'] = headers.authorization;
    }
    
    // Forward the request to the API Gateway
    const response = await fetch(`${API_GATEWAY_URL}/${path}`, {
      method,
      headers: forwardHeaders,
      body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
    });

    // Handle different response types
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else if (contentType?.includes('application/zip')) {
      // Handle ZIP file downloads
      const buffer = await response.arrayBuffer();
      
      // Forward the content type and disposition headers
      res.setHeader('Content-Type', response.headers.get('content-type') || 'application/zip');
      if (response.headers.get('content-disposition')) {
        res.setHeader('Content-Disposition', response.headers.get('content-disposition') || '');
      }
      if (response.headers.get('content-length')) {
        res.setHeader('Content-Length', response.headers.get('content-length') || '');
      }
      
      res.status(response.status).send(Buffer.from(buffer));
    } else {
      // Handle other content types
      const text = await response.text();
      res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('API Proxy Error:', error);
    res.status(500).json({ 
      success: false, 
      error: {
        code: 'PROXY_ERROR',
        message: 'Failed to connect to API Gateway. Please ensure the backend is running.',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      }
    });
  }
}
