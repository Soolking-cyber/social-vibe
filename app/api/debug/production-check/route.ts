import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';

export async function GET() {
    try {
        // Check environment variables
        const envCheck = {
            NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            TWITTER_BEARER_TOKEN: !!process.env.TWITTER_BEARER_TOKEN,
            NEXTAUTH_URL: process.env.NEXTAUTH_URL,
            NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
            NODE_ENV: process.env.NODE_ENV,
            JOBS_FACTORY_CONTRACT_ADDRESS: !!process.env.JOBS_FACTORY_CONTRACT_ADDRESS,
            INFURA_PROJECT_ID: !!process.env.INFURA_PROJECT_ID,
        };

        // Check session
        let sessionCheck = null;
        try {
            const session = await getServerSession(authOptions);
            sessionCheck = {
                hasSession: !!session,
                hasUser: !!session?.user,
                userName: session?.user?.name,
                userEmail: session?.user?.email,
            };
        } catch (sessionError) {
            sessionCheck = {
                error: sessionError instanceof Error ? sessionError.message : 'Unknown session error'
            };
        }

        return NextResponse.json({
            success: true,
            environment: envCheck,
            session: sessionCheck,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
        }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        return NextResponse.json({
            success: true,
            receivedBody: body,
            bodyType: typeof body,
            hasJobId: 'jobId' in body,
            jobIdValue: body.jobId,
            jobIdType: typeof body.jobId,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
        }, { status: 500 });
    }
}