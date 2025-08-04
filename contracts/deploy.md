# JobsFactory Contract Deployment Guide

## Prerequisites
1. Open [Remix IDE](https://remix.ethereum.org/)
2. Have MetaMask connected to Sepolia testnet
3. Have Sepolia ETH for gas fees
4. Know the USDC contract address on Sepolia

## Deployment Steps

### 1. Setup in Remix
1. Create a new file called `JobsFactory.sol`
2. Copy the contract code from `contracts/JobsFactory.sol`
3. Install OpenZeppelin contracts:
   - Go to File Explorer → contracts
   - Create folder: `@openzeppelin/contracts`
   - Or use Remix's built-in OpenZeppelin plugin

### 2. Contract Configuration
- **USDC Contract Address (Sepolia)**: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- **Vault Address**: `0xAaA13165376D97Ec84654037f3F588847A0930d1`
- **Platform Fee**: 10%
- **Minimum Withdrawal**: 10 USDC

### 3. Compilation
1. Go to Solidity Compiler tab
2. Select compiler version: `0.8.19` or higher
3. Click "Compile JobsFactory.sol"
4. Ensure no compilation errors

### 4. Deployment
1. Go to Deploy & Run Transactions tab
2. Select Environment: "Injected Provider - MetaMask"
3. Select Account: Your MetaMask account
4. Select Contract: "JobsFactory"
5. Constructor Parameters:
   - `_usdcAddress`: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
6. Click "Deploy"
7. Confirm transaction in MetaMask

### 5. Verification
After deployment, test these functions:
- `usdc()` - Should return USDC contract address
- `VAULT_ADDRESS()` - Should return vault address
- `MIN_WITHDRAWAL_AMOUNT()` - Should return 10000000 (10 USDC with 6 decimals)
- `nextJobId()` - Should return 1

## Contract Functions

### For Job Creators
- `createJob()` - Create new engagement job
- `getUserCreatedJobs()` - Get jobs created by user

### For Job Workers
- `completeJob()` - Complete a job and earn rewards
- `withdrawEarnings()` - Withdraw earned USDC (min 10 USDC)
- `getUserEarnings()` - Check earnings status
- `getUserCompletedJobs()` - Get completed jobs

### For Marketplace
- `getActiveJobs()` - Get all active jobs
- `getJob()` - Get specific job details
- `hasUserCompletedJob()` - Check if user completed job

### Admin Functions
- `pause()` / `unpause()` - Emergency controls
- `emergencyWithdraw()` - Emergency fund recovery

## Integration Notes

After deployment, update your backend with:
1. Contract address
2. Contract ABI
3. Update API endpoints to interact with contract
4. Modify job creation/completion flow

## Security Features
- ReentrancyGuard: Prevents reentrancy attacks
- Pausable: Emergency pause functionality
- Ownable: Admin controls
- Input validation: Prevents invalid operations
- Minimum withdrawal: Reduces gas costs for small amounts