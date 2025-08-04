import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('⚠️  DEPRECATED: /api/jobs/create endpoint called');
  console.log('Redirecting to contract-based job creation...');
  
  // This endpoint is deprecated - all job creation should go through the smart contract
  return NextResponse.json({
    error: 'This endpoint is deprecated. Please use /api/contract/create-job for on-chain job creation.',
    redirect: '/api/contract/create-job',
    message: 'All jobs must now be created on the smart contract to ensure USDC transfers.'
  }, { status: 410 }); // 410 Gone - resource no longer available
}