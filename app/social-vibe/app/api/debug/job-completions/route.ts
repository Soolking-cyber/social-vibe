import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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

        // Get all job completions for this user
        const { data: completions, error: completionsError } = await supabase
            .from('job_completions')
            .select('*')
            .eq('user_id', user.id)
            .order('completed_at', { ascending: false });

        // Get total count
        const { count: totalCount } = await supabase
            .from('job_completions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

        return NextResponse.json({
            user_info: {
                id: user.id,
                name: user.name
            },
            completions: completions || [],
            total_completions: totalCount || 0,
            completions_error: completionsError?.message || null
        });

    } catch (error) {
        console.error('Error getting job completions:', error);
        return NextResponse.json({
            error: 'Failed to get job completions',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}