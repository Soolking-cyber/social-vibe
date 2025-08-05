import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import { authOptions } from '@/auth';
import { createJobsFactoryService, usdcService } from '@/lib/contract';
import { walletService } from '@/lib/wallet';

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

    // Get user wallet info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, wallet_address, wallet_private_key, usdc_balance')
      .eq('name', userIdentifier)
      .single();

    if (userError || !user || !user.wallet_address || !user.wallet_private_key) {
      return NextResponse.json({
        error: 'Wallet not found or not properly configured'
      }, { status: 404 });
    }

    // Calculate costs with proper decimal handling
    const pricePerActionNum = parseFloat(price_per_action);
    const totalBudget = Math.round(pricePerActionNum * max_actions * 1000000) / 1000000; // Round to 6 decimals
    const platformFee = Math.round(totalBudget * 0.1 * 1000000) / 1000000; // Round to 6 decimals
    const totalCost = Math.round((totalBudget + platformFee) * 1000000) / 1000000; // Round to 6 decimals

    console.log(`=== JOB CREATION REQUEST ===`);
    console.log(`User: ${userIdentifier}`);
    console.log(`Job details:`, { tweet_url, action_type, price_per_action, max_actions });
    console.log(`Calculated costs: Budget=${totalBudget}, Fee=${platformFee}, Total=${totalCost}`);

    // Check USDC balance in database first (quick check)
    const currentBalance = parseFloat(user.usdc_balance?.toString() || '0');
    console.log(`Database balance check: Required: ${totalCost}, Available: ${currentBalance}`);

    if (currentBalance < totalCost) {
      return NextResponse.json({
        error: `Insufficient USDC balance in database. Required: ${totalCost.toFixed(2)}, Available: ${currentBalance.toFixed(2)}. Please deposit USDC first.`
      }, { status: 400 });
    }

    try {
      // Decrypt private key
      const privateKey = walletService.decrypt(user.wallet_private_key);

      // Create wallet instance
      const wallet = await walletService.createWalletFromPrivateKey(privateKey);

      // Initialize contract service
      const jobsFactoryService = createJobsFactoryService(process.env.JOBS_FACTORY_CONTRACT_ADDRESS!);

      // CRITICAL: Verify contract is deployed and accessible
      try {
        console.log(`=== VERIFYING CONTRACT DEPLOYMENT ===`);
        const contractBalance = await jobsFactoryService.getContractBalance();
        console.log(`Contract balance: ${jobsFactoryService.formatUSDC(contractBalance)} USDC`);
        console.log(`Contract is accessible and deployed`);
      } catch (contractError) {
        console.error('Contract verification failed:', contractError);
        return NextResponse.json({
          error: `Contract not accessible: ${contractError instanceof Error ? contractError.message : 'Unknown error'}`
        }, { status: 500 });
      }

      // Connect services with signer
      jobsFactoryService.connectSigner(wallet);
      usdcService.connectSigner(wallet);

      // Check actual USDC balance on-chain
      console.log(`=== STARTING ON-CHAIN BALANCE CHECK ===`);
      console.log(`User wallet address: ${user.wallet_address}`);
      console.log(`USDC contract address: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`);
      console.log(`Factory contract address: ${process.env.JOBS_FACTORY_CONTRACT_ADDRESS}`);

      let actualUSDCBalance;
      let actualUSDCBalanceFormatted;

      try {
        console.log(`Calling usdcService.getBalance...`);
        actualUSDCBalance = await usdcService.getBalance(user.wallet_address);
        console.log(`Raw balance result:`, actualUSDCBalance);
        actualUSDCBalanceFormatted = parseFloat(ethers.formatUnits(actualUSDCBalance, 6));
        console.log(`Formatted balance: ${actualUSDCBalanceFormatted}`);
      } catch (balanceError) {
        console.error('Error checking USDC balance:', balanceError);
        return NextResponse.json({
          error: `Failed to check USDC balance: ${balanceError instanceof Error ? balanceError.message : 'Unknown error'}`
        }, { status: 500 });
      }

      console.log(`=== BALANCE COMPARISON ===`);
      console.log(`Database USDC balance: ${currentBalance}`);
      console.log(`Actual on-chain USDC balance: ${actualUSDCBalanceFormatted}`);
      console.log(`Required total cost: ${totalCost}`);
      console.log(`Balance sufficient: ${actualUSDCBalanceFormatted >= totalCost}`);

      // CRITICAL: Only proceed if user has actual USDC on-chain
      if (actualUSDCBalanceFormatted < totalCost) {
        console.log(`=== INSUFFICIENT BALANCE - STOPPING ===`);
        console.log(`BLOCKING JOB CREATION: User has ${actualUSDCBalanceFormatted} USDC but needs ${totalCost}`);
        return NextResponse.json({
          error: `BLOCKED: Insufficient on-chain USDC balance. Required: ${totalCost.toFixed(2)} USDC, Available: ${actualUSDCBalanceFormatted.toFixed(2)} USDC. You need to deposit actual USDC tokens to your wallet address: ${user.wallet_address}`
        }, { status: 400 });
      }

      // DOUBLE CHECK: Ensure balance is actually greater than 0
      if (actualUSDCBalanceFormatted <= 0) {
        console.log(`=== ZERO BALANCE DETECTED - STOPPING ===`);
        return NextResponse.json({
          error: `BLOCKED: Your wallet has 0 USDC on-chain. You need to deposit actual USDC tokens to your wallet address: ${user.wallet_address}`
        }, { status: 400 });
      }

      console.log(`=== BALANCE CHECK PASSED - PROCEEDING WITH REAL USDC ===`);
      console.log(`User has sufficient USDC: ${actualUSDCBalanceFormatted} >= ${totalCost}`);

      // First, approve USDC spending by the contract
      let approvalTx;
      try {
        // Format totalCost to exactly 6 decimal places for USDC
        const totalCostFormatted = totalCost.toFixed(6);
        console.log(`Approving ${totalCostFormatted} USDC for contract spending...`);
        approvalTx = await usdcService.approve(
          process.env.JOBS_FACTORY_CONTRACT_ADDRESS!,
          totalCostFormatted
        );
        console.log(`Approval transaction hash: ${approvalTx.hash}`);
        await approvalTx.wait();
        console.log(`Approval transaction confirmed`);
      } catch (approvalError) {
        console.error('USDC approval failed:', approvalError);
        return NextResponse.json({
          error: `USDC approval failed: ${approvalError instanceof Error ? approvalError.message : 'Unknown error'}`
        }, { status: 500 });
      }

      // Verify approval was successful
      let allowance;
      let allowanceFormatted;
      try {
        allowance = await usdcService.getAllowance(user.wallet_address, process.env.JOBS_FACTORY_CONTRACT_ADDRESS!);
        allowanceFormatted = parseFloat(ethers.formatUnits(allowance, 6));
        console.log(`USDC allowance granted: ${allowanceFormatted}`);

        if (allowanceFormatted < totalCost) {
          return NextResponse.json({
            error: `Insufficient allowance granted. Required: ${totalCost}, Granted: ${allowanceFormatted}`
          }, { status: 500 });
        }
      } catch (allowanceError) {
        console.error('Error checking allowance:', allowanceError);
        return NextResponse.json({
          error: 'Failed to verify USDC allowance'
        }, { status: 500 });
      }

      // Create job on contract
      console.log(`Creating job with params:`, {
        tweet_url,
        action_type,
        price_per_action,
        max_actions,
        comment_text: comment_text || ""
      });

      let createJobTx;
      let receipt;
      try {
        // Format price_per_action to exactly 6 decimal places for USDC
        const pricePerActionFormatted = pricePerActionNum.toFixed(6);
        console.log(`Calling contract createJob with price: ${pricePerActionFormatted}`);

        // Estimate gas first to avoid transaction failures
        const priceInWei = ethers.parseUnits(pricePerActionFormatted, 6);

        try {
          const gasEstimate = await jobsFactoryService.contract.createJob.estimateGas(
            tweet_url,
            action_type,
            priceInWei,
            max_actions,
            comment_text || ""
          );
          console.log(`Estimated gas: ${gasEstimate.toString()}`);

          // Add 20% buffer to gas estimate
          const gasLimit = gasEstimate * BigInt(120) / BigInt(100);
          console.log(`Gas limit with buffer: ${gasLimit.toString()}`);

          // Call with explicit gas limit
          createJobTx = await jobsFactoryService.contract.createJob(
            tweet_url,
            action_type,
            priceInWei,
            max_actions,
            comment_text || "",
            { gasLimit }
          );
        } catch (gasEstimateError) {
          console.warn('Gas estimation failed, proceeding without explicit limit:', gasEstimateError);

          // Fallback to original method without gas estimation
          createJobTx = await jobsFactoryService.createJob(
            tweet_url,
            action_type,
            pricePerActionFormatted,
            max_actions,
            comment_text || ""
          );
        }

        console.log(`Job creation transaction hash: ${createJobTx.hash}`);
        receipt = await createJobTx.wait();
        console.log(`Job creation transaction confirmed in block: ${receipt.blockNumber}`);

        // Verify transaction was successful
        if (receipt.status !== 1) {
          throw new Error(`Transaction failed with status: ${receipt.status}`);
        }
      } catch (jobCreationError) {
        console.error('Job creation failed:', jobCreationError);
        return NextResponse.json({
          error: `Job creation failed: ${jobCreationError instanceof Error ? jobCreationError.message : 'Unknown error'}`
        }, { status: 500 });
      }

      // Get job ID from event logs
      console.log(`=== PARSING JOB CREATION EVENT ===`);
      console.log(`Receipt logs count: ${receipt.logs.length}`);

      let jobId = null;
      let jobCreatedEvent = null;

      // Try to find and parse the JobCreated event
      for (const log of receipt.logs) {
        try {
          const decoded = jobsFactoryService.contract.interface.parseLog(log);
          console.log(`Decoded event: ${decoded.name}`, decoded.args);

          if (decoded.name === 'JobCreated') {
            jobCreatedEvent = log;
            jobId = Number(decoded.args.jobId);
            console.log(`✅ Found JobCreated event with jobId: ${jobId}`);
            break;
          }
        } catch (error) {
          // This log is not from our contract or not parseable, skip it
          continue;
        }
      }

      // Fallback: try to extract from topics if parsing failed
      if (!jobId && receipt.logs.length > 0) {
        console.log(`⚠️ JobCreated event not found, trying fallback parsing...`);
        for (const log of receipt.logs) {
          if (log.topics && log.topics.length > 1) {
            try {
              // Try to parse the first topic as jobId (this is a guess)
              const potentialJobId = parseInt(log.topics[1], 16);
              if (potentialJobId > 0 && potentialJobId < 1000000) { // Reasonable job ID range
                jobId = potentialJobId;
                console.log(`⚠️ Using fallback jobId: ${jobId}`);
                break;
              }
            } catch (error) {
              continue;
            }
          }
        }
      }

      // Check if we got a job ID
      if (!jobId) {
        console.error(`❌ Failed to extract job ID from transaction receipt`);
        console.log(`Transaction hash: ${createJobTx.hash}`);
        console.log(`Receipt:`, JSON.stringify(receipt, null, 2));

        // Still continue with balance verification, but we'll need to handle the missing jobId
        console.log(`⚠️ Continuing without job ID - job created on-chain but not tracked in backend`);
      }

      // CRITICAL: Verify the USDC was actually transferred by checking balances
      console.log(`=== VERIFYING ON-CHAIN TRANSFER ===`);
      let newOnChainBalance;
      let actualTransferAmount = 0;

      try {
        const updatedBalance = await usdcService.getBalance(user.wallet_address);
        newOnChainBalance = parseFloat(ethers.formatUnits(updatedBalance, 6));
        console.log(`Updated on-chain USDC balance: ${newOnChainBalance}`);

        // Calculate actual transfer amount
        actualTransferAmount = actualUSDCBalanceFormatted - newOnChainBalance;
        console.log(`Actual balance decrease: ${actualTransferAmount}, Expected: ${totalCost}`);

        // CRITICAL: Ensure the balance actually decreased by the expected amount
        if (Math.abs(actualTransferAmount - totalCost) > 0.01) {
          console.error(`TRANSFER VERIFICATION FAILED: Expected ${totalCost}, Actual ${actualTransferAmount}`);
          throw new Error(`USDC transfer verification failed. Expected: ${totalCost}, Actual: ${actualTransferAmount}`);
        }

        console.log(`✅ USDC transfer verified: ${actualTransferAmount} USDC transferred`);
      } catch (balanceCheckError) {
        console.error('CRITICAL: Failed to verify USDC transfer:', balanceCheckError);
        // Don't update database if we can't verify the transfer
        return NextResponse.json({
          error: `Transaction completed but USDC transfer verification failed: ${balanceCheckError instanceof Error ? balanceCheckError.message : 'Unknown error'}`
        }, { status: 500 });
      }

      // CRITICAL: Validate transaction hash format
      if (!createJobTx.hash || !createJobTx.hash.startsWith('0x') || createJobTx.hash.length !== 66) {
        console.error(`Invalid transaction hash: ${createJobTx.hash}`);
        return NextResponse.json({
          error: 'Invalid transaction hash received from blockchain'
        }, { status: 500 });
      }

      console.log(`=== UPDATING DATABASE WITH VERIFIED TRANSACTION ===`);
      console.log(`Transaction Hash: ${createJobTx.hash}`);
      console.log(`Block Number: ${receipt.blockNumber}`);
      console.log(`Gas Used: ${receipt.gasUsed?.toString()}`);

      // Update user's USDC balance in database to match on-chain reality
      const newBalance = newOnChainBalance;
      await supabase
        .from('users')
        .update({
          usdc_balance: newBalance,
          last_balance_update: new Date().toISOString()
        })
        .eq('id', user.id);

      // Record ONLY verified on-chain transaction in database
      const transactionRecord = {
        user_id: user.id,
        transaction_hash: createJobTx.hash,
        transaction_type: 'job_creation',
        token_type: 'USDC',
        amount: actualTransferAmount, // Use actual verified amount
        from_address: user.wallet_address,
        to_address: process.env.JOBS_FACTORY_CONTRACT_ADDRESS!,
        gas_used: receipt.gasUsed ? parseFloat(ethers.formatUnits(receipt.gasUsed, 'wei')) : null,
        block_number: receipt.blockNumber,
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      };

      console.log(`Recording transaction:`, transactionRecord);

      const { error: txError } = await supabase
        .from('wallet_transactions')
        .insert(transactionRecord);

      if (txError) {
        console.error('Failed to record transaction:', txError);
        // Don't fail the request since the on-chain transaction succeeded
        console.warn('Transaction succeeded on-chain but failed to record in database');
      } else {
        console.log(`✅ Transaction recorded in database`);
      }

      // CRITICAL: Save job details to database if we have a jobId
      if (jobId) {
        console.log(`=== SAVING JOB TO DATABASE ===`);
        const jobRecord = {
          // Don't set id - let database generate UUID, store contract jobId separately
          user_id: user.id,
          tweet_url: tweet_url,
          action_type: action_type,
          price_per_action: price_per_action,
          max_actions: max_actions,
          total_budget: totalCost,
          platform_fee: platformFee,
          completed_actions: 0,
          comment_text: comment_text || null,
          status: 'active',
          created_at: new Date().toISOString(),
          transaction_hash: createJobTx.hash,
          contract_job_id: jobId // Store the contract job ID separately
        };

        console.log(`Saving job record:`, jobRecord);

        const { error: jobError } = await supabase
          .from('jobs')
          .insert(jobRecord);

        if (jobError) {
          console.error('Failed to save job to database:', jobError);
          console.warn('Job created on-chain but failed to save to database - this will cause sync issues');

          return NextResponse.json({
            success: true,
            jobId,
            transactionHash: createJobTx.hash,
            message: `Job created on-chain (ID: ${jobId}) but failed to save to database. The job exists on the blockchain but may not appear in the UI.`,
            totalCost: totalCost.toFixed(2),
            newBalance: newBalance.toFixed(2),
            warning: 'Database sync failed'
          });
        } else {
          console.log(`✅ Job saved to database with ID: ${jobId}`);
        }
      } else {
        console.warn('⚠️ Job created on-chain but jobId could not be extracted - job will not appear in UI');
      }

      return NextResponse.json({
        success: true,
        jobId,
        transactionHash: createJobTx.hash,
        message: jobId
          ? `Job created successfully! Job ID: ${jobId}`
          : 'Job created on-chain but ID could not be extracted',
        totalCost: totalCost.toFixed(2),
        newBalance: newBalance.toFixed(2)
      });

    } catch (contractError) {
      console.error('Contract interaction failed:', contractError);
      return NextResponse.json({
        error: `Contract interaction failed: ${contractError instanceof Error ? contractError.message : 'Unknown error'}`
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Create job API error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}