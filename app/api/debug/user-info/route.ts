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
            .select('*')
            .eq('name', userIdentifier)
            .single();

        return NextResponse.json({
            session_info: {
                name: session.user.name,
                email: session.user.email,
                image: session.user.image,
                twitter_handle_from_session: (session.user as any).twitterHandle || null
            },
            database_info: {
                found: !userError && !!user,
                user_data: user || null,
                error: userError?.message || null
            },
            identifier_used: userIdentifier
        });

    } catch (error) {
        console.error('Error getting user info:', error);
        return NextResponse.json({
            error: 'Failed to get user info',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}