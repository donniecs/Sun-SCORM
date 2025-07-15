/**
 * @file Frontend Application - RUSTICI KILLER
 * @description Next.js frontend for developer/admin dashboard
 * @version 0.1.0
 */

import { NextApiRequest, NextApiResponse } from 'next';

const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3001';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Health check endpoint
    const response = await fetch(`${API_GATEWAY_URL}/health`);
    const data = await response.json();
    
    res.status(200).json({ 
      message: 'Rustici Killer Frontend API - Phase 12 Complete',
      version: '0.12.0',
      timestamp: new Date().toISOString(),
      gateway: data
    });
  } catch (error) {
    console.error('API Gateway connection error:', error);
    res.status(500).json({ 
      message: 'Rustici Killer Frontend API - Gateway Unavailable',
      version: '0.12.0',
      timestamp: new Date().toISOString(),
      error: 'Could not connect to API Gateway'
    });
  }
}
