import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { jobId } = await request.json();
        const testJobId = jobId || 1; // Default test job ID

        const userIdentifier = session.user.email || session.user.name;

        // Get user from database
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, name')
            .eq('name', userIdentifier)
            .single();

        if (userError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        console.log(`Testing job completion insertion for user ${user.id}, job ${testJobId}`);

        // Test 1: Check if job_completions table exists and structure
        const { data: tableInfo, error: tableError } = await supabase
            .from('job_completions')
            .select('*')
            .limit(1);

        console.log('Table check result:', { tableInfo, tableError });

        // Test 2: Try to insert a test record
        const testRecord = {
            job_id: parseInt(testJobId),
            user_id: user.id,
            reward_amount: 0.001, // Small test amount
            completed_at: new Date().toISOString()
        };

        console.log('Attempting to insert:', testRecord);

        const { data: insertResult, error: insertError } = await supabase
            .from('job_completions')
            .insert(testRecord)
            .select()
            .single();

        console.log('Insert result:', { insertResult, insertError });

        if (insertError) {
            return NextResponse.json({
                success: false,
                error: 'Insert failed',
                details: {
                    error_message: insertError.message,
                    error_code: insertError.code,
                    error_details: insertError.details,
                    error_hint: insertError.hint,
                    test_record: testRecord,
                    table_check: { tableInfo, tableError }
                }
            });
        }

        // Test 3: Try to read it back
        const { data: readBack, error: readError } = await supabase
            .from('job_completions')
            .select('*')
            .eq('id', insertResult.id)
            .single();

        // Clean up - delete the test record
        await supabase
            .from('job_completions')
            .delete()
            .eq('id', insertResult.id);

        return NextResponse.json({
            success: true,
            message: 'Job completion insertion test passed',
            results: {
                user_info: { id: user.id, name: user.name },
                insert_result: insertResult,
                read_back_result: readBack,
                read_back_error: readError
            }
        });

    } catch (error) {
        console.error('Error in job completion insert test:', error);
        return NextResponse.json({
            error: 'Test failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}