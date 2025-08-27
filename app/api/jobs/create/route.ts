import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const userIdentifier = session.user.email || session.user.name;

    if (!userIdentifier) {
      return NextResponse.json({
        error: 'Unable to identify user'
      }, { status: 401 });
    }

    const {
      tweet_url,
      action_type,
      price_per_action,
      max_actions,
      comment_text
    } = await request.json();

    // Validate input
    if (!tweet_url || !action_type || !price_per_action || !max_actions) {
      return NextResponse.json({
        error: 'Missing required fields'
      }, { status: 400 });
    }

    // Get user info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, usdc_balance')
      .eq('name', userIdentifier)
      .single();

    if (userError || !user) {
      return NextResponse.json({
        error: 'User not found'
      }, { status: 404 });
    }

    // Calculate costs
    const pricePerActionNum = parseFloat(price_per_action);
    const totalBudget = pricePerActionNum * max_actions;
    const platformFee = totalBudget * 0.1;
    const totalCost = totalBudget + platformFee;

    // Check USDC balance
    const currentBalance = parseFloat(user.usdc_balance?.toString() || '0');
    
    if (currentBalance < totalCost) {
      return NextResponse.json({
        error: `Insufficient USDC balance. Required: ${totalCost.toFixed(2)}, Available: ${currentBalance.toFixed(2)}. Please deposit USDC first.`
      }, { status: 400 });
    }

    // Create job in database
    const { data: jobRecord, error: jobError } = await supabase
      .from('jobs')
      .insert({
        user_id: user.id,
        tweet_url: tweet_url,
        action_type: action_type,
        price_per_action: pricePerActionNum,
        max_actions: max_actions,
        total_budget: totalBudget,
        platform_fee: platformFee,
        completed_actions: 0,
        comment_text: comment_text || null,
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      console.error('Failed to create job:', jobError);
      return NextResponse.json({
        error: 'Failed to create job'
      }, { status: 500 });
    }

    // Update user balance
    const newBalance = currentBalance - totalCost;
    await supabase
      .from('users')
      .update({
        usdc_balance: newBalance,
        last_balance_update: new Date().toISOString()
      })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      jobId: jobRecord.id,
      message: `Job created successfully!`,
      totalCost: totalCost.toFixed(2),
      newBalance: newBalance.toFixed(2)
    });

  } catch (error) {
    console.error('Create job API error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}