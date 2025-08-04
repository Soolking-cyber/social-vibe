import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { authOptions } from '@/auth';
import { createJobsFactoryService, usdcService } from '@/lib/contract';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const userIdentifier = session.user.email || session.user.name;
    
    // Get user wallet info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('wallet_address, usdc_balance')
      .eq('name', userIdentifier)
      .single();

    if (userError || !user || !user.wallet_address) {
      return NextResponse.json({ 
        error: 'Wallet not found' 
      }, { status: 404 });
    }

    const results: any = {
      user_wallet: user.wallet_address,
      database_usdc: parseFloat(user.usdc_balance?.toString() || '0'),
      contract_address: process.env.JOBS_FACTORY_CONTRACT_ADDRESS,
      usdc_contract: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      tests: {}
    };

    // Test 1: Check USDC balance on-chain
    try {
      console.log('Testing USDC balance...');
      const usdcBalance = await usdcService.getBalance(user.wallet_address);
      const usdcBalanceFormatted = parseFloat(ethers.formatUnits(usdcBalance, 6));
      results.tests.usdc_balance = {
        success: true,
        raw_balance: usdcBalance.toString(),
        formatted_balance: usdcBalanceFormatted,
        has_usdc: usdcBalanceFormatted > 0
      };
    } catch (error) {
      results.tests.usdc_balance = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 2: Check contract accessibility
    try {
      console.log('Testing contract accessibility...');
      const jobsFactoryService = createJobsFactoryService(process.env.JOBS_FACTORY_CONTRACT_ADDRESS!);
      const contractBalance = await jobsFactoryService.getContractBalance();
      const contractBalanceFormatted = parseFloat(jobsFactoryService.formatUSDC(contractBalance));
      results.tests.contract_access = {
        success: true,
        contract_balance: contractBalanceFormatted,
        is_deployed: true
      };
    } catch (error) {
      results.tests.contract_access = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        is_deployed: false
      };
    }

    // Test 3: Check active jobs count
    try {
      console.log('Testing active jobs...');
      const jobsFactoryService = createJobsFactoryService(process.env.JOBS_FACTORY_CONTRACT_ADDRESS!);
      const activeJobs = await jobsFactoryService.getActiveJobs();
      results.tests.active_jobs = {
        success: true,
        count: activeJobs.length,
        job_ids: activeJobs.map((id: any) => Number(id))
      };
    } catch (error) {
      results.tests.active_jobs = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 4: Check provider connection
    try {
      console.log('Testing provider connection...');
      const provider = new ethers.JsonRpcProvider(
        `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
      );
      const blockNumber = await provider.getBlockNumber();
      const network = await provider.getNetwork();
      results.tests.provider = {
        success: true,
        block_number: blockNumber,
        chain_id: Number(network.chainId),
        network_name: network.name
      };
    } catch (error) {
      results.tests.provider = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error('Contract test error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}