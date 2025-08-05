import { NextRequest, NextResponse } from 'next/server';

// Validation interfaces
interface VerifyActionRequest {
  jobId: string;
  actionType: 'like' | 'retweet' | 'comment';
  targetUrl: string;
  verificationData: {
    method: string;
    confidence: 'high' | 'medium' | 'low';
    details: string;
    interactionDetected?: boolean;
    browserVerified?: boolean;
    timeAnalysis?: {
      timeSpent: number;
      expectedRange: [number, number];
      withinRange: boolean;
    };
    timestamp: number;
  };
}

// Validation function
function validateRequest(body: any): { valid: boolean; data?: VerifyActionRequest; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be an object' };
  }

  const { jobId, actionType, targetUrl, verificationData } = body;

  if (!jobId || typeof jobId !== 'string' || jobId.length === 0) {
    return { valid: false, error: 'jobId must be a non-empty string' };
  }

  if (!['like', 'retweet', 'comment'].includes(actionType)) {
    return { valid: false, error: 'actionType must be like, retweet, or comment' };
  }

  if (!targetUrl || typeof targetUrl !== 'string') {
    return { valid: false, error: 'targetUrl must be a valid URL string' };
  }

  if (!verificationData || typeof verificationData !== 'object') {
    return { valid: false, error: 'verificationData must be an object' };
  }

  const { method, confidence, details, timestamp } = verificationData;

  if (!method || typeof method !== 'string') {
    return { valid: false, error: 'verificationData.method must be a string' };
  }

  if (!['high', 'medium', 'low'].includes(confidence)) {
    return { valid: false, error: 'verificationData.confidence must be high, medium, or low' };
  }

  if (!details || typeof details !== 'string') {
    return { valid: false, error: 'verificationData.details must be a string' };
  }

  if (!timestamp || typeof timestamp !== 'number') {
    return { valid: false, error: 'verificationData.timestamp must be a number' };
  }

  return { valid: true, data: body as VerifyActionRequest };
}

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const userLimit = rateLimitStore.get(identifier);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (userLimit.count >= maxRequests) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

// Mock database functions (replace with your actual database)
async function getJob(jobId: string) {
  // Mock job data - replace with actual database query
  const mockJobs = {
    '1': { id: '1', actionType: 'like', reward: '0.05', status: 'active' },
    '2': { id: '2', actionType: 'retweet', reward: '0.08', status: 'active' },
    '3': { id: '3', actionType: 'comment', reward: '0.12', status: 'active' }
  };
  
  return mockJobs[jobId as keyof typeof mockJobs] || null;
}

async function markJobCompleted(jobId: string, verificationData: Record<string, any>) {
  // Mock completion - replace with actual database update
  console.log(`Job ${jobId} marked as completed:`, verificationData);
  return true;
}

async function creditUserReward(userId: string, amount: string) {
  // Mock reward crediting - replace with actual USDC transfer
  console.log(`Credited ${amount} USDC to user ${userId}`);
  return { txHash: `0x${Math.random().toString(16).substring(2, 66)}` };
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

    // Check rate limit
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = validateRequest(body);
    
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error },
        { status: 400 }
      );
    }

    const { jobId, actionType, verificationData } = validation.data!;

    // Get job details
    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.status !== 'active') {
      return NextResponse.json(
        { error: 'Job is no longer active' },
        { status: 400 }
      );
    }

    if (job.actionType !== actionType) {
      return NextResponse.json(
        { error: 'Action type mismatch' },
        { status: 400 }
      );
    }

    // Validate verification confidence
    const minConfidenceRequired = getMinConfidenceForReward(job.reward);
    if (!isConfidenceSufficient(verificationData.confidence, minConfidenceRequired)) {
      return NextResponse.json(
        { 
          error: 'Verification confidence too low',
          details: `Required: ${minConfidenceRequired}, Got: ${verificationData.confidence}`,
          suggestion: 'Please ensure you actually completed the action and try again'
        },
        { status: 400 }
      );
    }

    // Additional security checks
    const securityCheck = performSecurityChecks(verificationData);
    if (!securityCheck.passed) {
      return NextResponse.json(
        { 
          error: 'Security check failed',
          details: securityCheck.reason
        },
        { status: 400 }
      );
    }

    // Mark job as completed
    await markJobCompleted(jobId, {
      ...verificationData,
      completedAt: new Date().toISOString(),
      clientIP
    });

    // Credit user reward (in production, this would be a blockchain transaction)
    const userId = 'user123'; // Get from authentication
    const rewardResult = await creditUserReward(userId, job.reward);

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Action verified successfully!',
      reward: job.reward,
      currency: 'USDC',
      verification: {
        method: verificationData.method,
        confidence: verificationData.confidence,
        interactionDetected: verificationData.interactionDetected,
        browserVerified: verificationData.browserVerified
      },
      transaction: rewardResult,
      completedAt: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error('Verification error:', error);

    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { 
          error: 'Invalid JSON in request body',
          details: error.message
        },
        { status: 400 }
      );
    }

    // Handle other known errors
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: 'Request processing failed',
          details: error.message
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get minimum confidence required based on reward amount
 */
function getMinConfidenceForReward(reward: string): 'high' | 'medium' | 'low' {
  const amount = parseFloat(reward);
  
  if (amount >= 0.10) return 'high';    // High-value jobs need high confidence
  if (amount >= 0.05) return 'medium';  // Medium-value jobs need medium confidence
  return 'low';                         // Low-value jobs accept low confidence
}

/**
 * Check if verification confidence meets requirements
 */
function isConfidenceSufficient(actual: 'high' | 'medium' | 'low', required: 'high' | 'medium' | 'low'): boolean {
  const confidenceOrder = { 'low': 1, 'medium': 2, 'high': 3 };
  return confidenceOrder[actual] >= confidenceOrder[required];
}

/**
 * Perform additional security checks
 */
function performSecurityChecks(verificationData: VerifyActionRequest['verificationData']): { passed: boolean; reason?: string } {
  // Check for suspiciously fast completion
  if (verificationData.timeAnalysis && !verificationData.timeAnalysis.withinRange) {
    if (verificationData.timeAnalysis.timeSpent < verificationData.timeAnalysis.expectedRange[0]) {
      return {
        passed: false,
        reason: 'Action completed too quickly to be genuine'
      };
    }
  }

  // Check for missing interaction detection on high-value jobs
  if (verificationData.confidence === 'high' && !verificationData.interactionDetected) {
    return {
      passed: false,
      reason: 'High confidence verification requires interaction detection'
    };
  }

  // Check timestamp freshness (within last 10 minutes)
  const maxAge = 10 * 60 * 1000; // 10 minutes
  if (Date.now() - verificationData.timestamp > maxAge) {
    return {
      passed: false,
      reason: 'Verification data is too old'
    };
  }

  return { passed: true };
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'twitter-verification-api',
    timestamp: new Date().toISOString(),
    features: {
      embeddedVerification: true,
      multiLayerDetection: true,
      rateLimiting: true,
      securityChecks: true
    }
  });
}