import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/auth';
import { createJobsFactoryService } from '@/lib/contract';
import { walletService } from '@/lib/wallet';


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(_request: NextRequest) {
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

    // Get user info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, wallet_address, wallet_private_key, eth_balance, usdc_balance')
      .eq('name', userIdentifier)
      .single();

    if (userError || !user || !user.wallet_address || !user.wallet_private_key) {
      return NextResponse.json({
        error: 'Wallet not found or not properly configured'
      }, { status: 404 });
    }

    // Calculate earned balance from completed jobs
    const { data: completions } = await supabase
      .from('job_completions')
      .select('job_id, reward_amount')
      .eq('user_id', user.id);

    const earnedBalance = completions?.reduce((sum, completion) => {
      const amount = typeof completion.reward_amount === 'string'
        ? parseFloat(completion.reward_amount)
        : completion.reward_amount;
      return sum + amount;
    }, 0) || 0;

    const ethBalance = parseFloat(user.eth_balance?.toString() || '0');
    const withdrawalThreshold = 10.0;

    // Check minimum withdrawal amount
    if (earnedBalance < withdrawalThreshold) {
      return NextResponse.json({
        error: `Minimum withdrawal amount is ${withdrawalThreshold} USDC. Current earned balance: ${earnedBalance.toFixed(2)} USDC`
      }, { status: 400 });
    }

    console.log(`=== WITHDRAWAL REQUEST FOR USER: ${userIdentifier} ===`);
    console.log(`Earned balance: ${earnedBalance} USDC`);
    console.log(`Cached ETH balance: ${ethBalance} ETH`);

    // Get real-time ETH balance from blockchain (not cached)
    let realTimeEthBalance = ethBalance;
    try {
      console.log(`Fetching real-time ETH balance for wallet: ${user.wallet_address}`);
      const freshBalances = await walletService.getBalances(user.wallet_address);
      realTimeEthBalance = parseFloat(freshBalances.eth);
      console.log(`Real-time ETH balance: ${realTimeEthBalance} ETH`);

      // Update cached balance in database
      await supabase
        .from('users')
        .update({
          eth_balance: realTimeEthBalance,
          last_balance_update: new Date().toISOString()
        })
        .eq('id', user.id);

    } catch (balanceError) {
      console.error('Error fetching real-time ETH balance:', balanceError);
      console.log(`Falling back to cached balance: ${ethBalance} ETH`);
      // Fall back to cached balance if blockchain fetch fails
    }

    // Check ETH balance for gas fees using real-time balance
    console.log(`Checking ETH balance: ${realTimeEthBalance} >= 0.0001 ?`);
    if (realTimeEthBalance < 0.0001) { // Minimum ETH for gas
      console.log(`❌ Insufficient ETH: ${realTimeEthBalance} < 0.0001`);
      return NextResponse.json({
        error: `Insufficient ETH balance for gas fees. Current ETH balance: ${realTimeEthBalance.toFixed(6)} ETH. Please add ETH to your wallet.`
      }, { status: 400 });
    }
    console.log(`✅ Sufficient ETH for gas: ${realTimeEthBalance} ETH`)

    try {
      // Initialize contract service
      const jobsFactoryService = createJobsFactoryService(process.env.JOBS_FACTORY_CONTRACT_ADDRESS!);

      // Since we track earnings in database (not contract), use database balance
      console.log(`Using database-tracked earned balance: ${earnedBalance} USDC`);
      console.log(`Database tracks individual job completions for efficiency`);

      // Verify we have enough earned balance from database
      if (earnedBalance < 10) {
        console.log(`❌ Insufficient earned balance: ${earnedBalance} < 10`);
        return NextResponse.json({
          error: `Insufficient earned balance for withdrawal. Current earned: ${earnedBalance.toFixed(2)} USDC (need 10 USDC minimum)`
        }, { status: 400 });
      }
      console.log(`✅ Sufficient earned balance: ${earnedBalance} USDC`);

      // Check if contract has enough USDC to pay out
      // We'll transfer from contract's USDC balance, not user earnings tracking
      const contractUsdcBalance = await walletService.getUsdcBalance(process.env.JOBS_FACTORY_CONTRACT_ADDRESS!);
      const contractBalance = parseFloat(contractUsdcBalance);
      console.log(`Contract USDC balance: ${contractBalance} USDC`);

      if (contractBalance < earnedBalance) {
        console.log(`❌ Contract insufficient funds: ${contractBalance} < ${earnedBalance}`);
        return NextResponse.json({
          error: `Contract has insufficient USDC balance. Contract balance: ${contractBalance.toFixed(2)} USDC, Withdrawal amount: ${earnedBalance.toFixed(2)} USDC`
        }, { status: 400 });
      }
      console.log(`✅ Contract has sufficient USDC: ${contractBalance} USDC`)

      // Decrypt private key and create signer
      const privateKey = walletService.decrypt(user.wallet_private_key);
      const wallet = walletService.createWalletFromPrivateKey(privateKey);

      // Connect service with signer
      jobsFactoryService.connectSigner(wallet);

      // Use the factory contract's withdrawal mechanism
      // The contract should handle transferring USDC from its own balance to the user

      console.log(`Processing withdrawal of ${earnedBalance} USDC via factory contract`);

      // First, we need to credit the user's earnings in the contract
      // Since we track completions in database, we need to sync them to contract
      console.log(`Syncing ${completions?.length || 0} job completions to contract...`);

      // For each completion, ensure it's recorded in the contract
      if (completions && completions.length > 0) {
        for (const completion of completions) {
          try {
            // Try to complete the job on contract (this will credit the user)
            console.log(`Syncing job completion ${completion.job_id}...`);
            const completeTx = await jobsFactoryService.completeJob(completion.job_id);
            await completeTx.wait();
            console.log(`✅ Synced job ${completion.job_id} to contract`);
          } catch (syncError: any) {
            // Job might already be completed on contract, which is fine
            if (syncError.message?.includes('already completed') ||
              syncError.message?.includes('Job not active') ||
              syncError.message?.includes('User has already completed')) {
              console.log(`⚠️ Job ${completion.job_id} already completed on contract`);
            } else {
              console.error(`❌ Failed to sync job ${completion.job_id}:`, syncError.message);
              // Continue with other jobs - don't fail the entire withdrawal
            }
          }
        }
      }

      console.log(`Now attempting withdrawal from factory contract...`);

      // Check contract earnings before attempting withdrawal
      const contractEarnings = await jobsFactoryService.getUserEarnings(user.wallet_address);
      const availableForWithdrawal = parseFloat(
        jobsFactoryService.formatUSDC(contractEarnings.availableForWithdrawal)
      );

      console.log(`Contract shows ${availableForWithdrawal} USDC available for withdrawal`);

      if (availableForWithdrawal < 10) {
        console.log(`❌ Contract has insufficient credited earnings: ${availableForWithdrawal} < 10`);
        return NextResponse.json({
          error: `Contract has insufficient credited earnings. Available: ${availableForWithdrawal.toFixed(2)} USDC. This might mean job completions weren't properly synced to the contract.`
        }, { status: 400 });
      }

      // Now withdraw earnings from the contract
      const withdrawTx = await jobsFactoryService.withdrawEarnings();
      const receipt = await withdrawTx.wait();
      console.log(`✅ Factory contract withdrawal completed: ${withdrawTx.hash}`);

      // Parse withdrawal amount from transaction receipt
      let withdrawnAmount = earnedBalance.toString();

      // Try to get actual withdrawn amount from event logs
      try {
        const withdrawalEvent = receipt.logs.find((log: any) =>
          log.topics && log.topics.length > 1
        );

        if (withdrawalEvent) {
          const decoded = jobsFactoryService.contract.interface.parseLog(withdrawalEvent);
          if (decoded && decoded.args.amount) {
            withdrawnAmount = jobsFactoryService.formatUSDC(decoded.args.amount);
            console.log(`Actual withdrawn amount from event: ${withdrawnAmount} USDC`);
          }
        }
      } catch (eventError) {
        console.error('Error parsing withdrawal event:', eventError);
        // Use database amount as fallback
        console.log(`Using database amount as fallback: ${withdrawnAmount} USDC`);
      }

      // Update user wallet balance in database
      const newUsdcBalance = parseFloat(user.usdc_balance?.toString() || '0') + parseFloat(withdrawnAmount);

      await supabase
        .from('users')
        .update({
          usdc_balance: newUsdcBalance,
          last_balance_update: new Date().toISOString()
        })
        .eq('id', user.id);

      // Clear job completions after successful withdrawal (they've been "cashed out")
      await supabase
        .from('job_completions')
        .delete()
        .eq('user_id', user.id);

      // Record withdrawal transaction
      await supabase
        .from('wallet_transactions')
        .insert({
          user_id: user.id,
          transaction_hash: withdrawTx.hash,
          transaction_type: 'earnings_withdrawal',
          token_type: 'USDC',
          amount: parseFloat(withdrawnAmount),
          from_address: process.env.JOBS_FACTORY_CONTRACT_ADDRESS!, // Factory contract address
          to_address: user.wallet_address,
          status: 'confirmed'
        });

      return NextResponse.json({
        success: true,
        transactionHash: withdrawTx.hash,
        withdrawnAmount,
        newEarnedBalance: "0.00", // Reset to 0 after withdrawal
        newUsdcBalance: newUsdcBalance.toFixed(2),
        message: `Successfully withdrew ${withdrawnAmount} USDC to your wallet! Your earned balance has been reset.`
      });

    } catch (contractError) {
      console.error('Contract withdrawal failed:', contractError);
      return NextResponse.json({
        error: `Withdrawal failed: ${contractError instanceof Error ? contractError.message : 'Unknown error'}`
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Withdraw earnings API error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}