import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
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

    const { transactionHash } = await request.json();

    if (!transactionHash) {
      return NextResponse.json({
        error: 'Transaction hash is required'
      }, { status: 400 });
    }

    // Validate transaction hash format
    if (!transactionHash.startsWith('0x') || transactionHash.length !== 66) {
      return NextResponse.json({
        error: 'Invalid transaction hash format'
      }, { status: 400 });
    }

    try {
      // Create provider to check transaction on-chain
      const provider = new ethers.JsonRpcProvider(
        `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
      );

      // Get transaction details from blockchain
      const tx = await provider.getTransaction(transactionHash);
      const receipt = await provider.getTransactionReceipt(transactionHash);

      if (!tx || !receipt) {
        return NextResponse.json({
          error: 'Transaction not found on blockchain'
        }, { status: 404 });
      }

      // Check if transaction exists in our database
      const { data: dbTransaction, error: dbError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('transaction_hash', transactionHash)
        .single();

      return NextResponse.json({
        transaction_hash: transactionHash,
        blockchain_data: {
          from: tx.from,
          to: tx.to,
          value: ethers.formatEther(tx.value),
          gas_limit: tx.gasLimit?.toString(),
          gas_price: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') : null,
          block_number: receipt.blockNumber,
          gas_used: receipt.gasUsed?.toString(),
          status: receipt.status === 1 ? 'success' : 'failed',
          confirmations: await tx.confirmations()
        },
        database_record: dbTransaction || null,
        database_error: dbError?.message || null,
        verified: !!dbTransaction && receipt.status === 1
      });

    } catch (blockchainError) {
      console.error('Blockchain verification error:', blockchainError);
      return NextResponse.json({
        error: `Failed to verify transaction on blockchain: ${blockchainError instanceof Error ? blockchainError.message : 'Unknown error'}`
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Transaction verification error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}