# Design Document

## Overview

This design outlines the systematic cleanup of the social impact platform codebase to maintain only essential functionality while preserving the core user experience. The cleanup will focus on removing redundant files, consolidating similar functionality, and streamlining the project structure for better maintainability.

## Architecture

### Current State Analysis
The current codebase contains:
- 50+ API endpoints across multiple domains
- Extensive documentation files for various deployment scenarios
- Multiple verification systems and webhook implementations
- Complex wallet management with multiple token support
- Comprehensive UI components and utilities

### Target State
The cleaned codebase will maintain:
- Core authentication flow (Twitter OAuth)
- Essential job management (create, browse, complete)
- Basic wallet operations (balance, withdraw)
- Minimal UI components for core functionality
- Single verification method for Twitter actions

## Components and Interfaces

### Essential API Endpoints
**Authentication:**
- `/api/auth/[...nextauth]` - NextAuth.js authentication
- `/api/auth-check` - Session validation

**Job Management:**
- `/api/jobs` - List available jobs
- `/api/jobs/create` - Create new jobs
- `/api/jobs/[id]` - Get specific job details
- `/api/jobs/complete` - Mark job as completed

**User Management:**
- `/api/user/stats` - User statistics and profile
- `/api/user/twitter-handle` - Twitter handle management

**Wallet Operations:**
- `/api/wallet/value` - Get wallet balance
- `/api/wallet/withdraw` - Withdraw earnings
- `/api/wallet/refresh` - Refresh balance from blockchain

**Verification:**
- `/api/verify-twitter-action` - Verify Twitter engagement

### Essential UI Components
**Core Pages:**
- `app/page.tsx` - Dashboard/home page
- `app/login/page.tsx` - Authentication page
- `app/marketplace/page.tsx` - Job browsing
- `app/create-job/page.tsx` - Job creation

**Essential Components:**
- `components/AuthWrapper.tsx` - Authentication wrapper
- `components/Navigation.tsx` - Site navigation
- `components/WalletCard.tsx` - Wallet display
- `components/TwitterJobCard.tsx` - Job display
- `components/ui/*` - Basic UI primitives

### Essential Libraries and Utilities
- `lib/wallet.ts` - Wallet operations
- `lib/contract.ts` - Smart contract interactions
- `lib/tweet-verification.ts` - Twitter verification logic
- `lib/utils.ts` - Common utilities

## Data Models

### Simplified Database Schema
The cleanup will maintain these core tables:
- `users` - User profiles and wallet addresses
- `jobs` - Social media engagement jobs
- `job_completions` - Completed tasks and earnings
- `wallet_transactions` - Transaction history

### Removed Complexity
- Multiple verification session tables
- Complex webhook tracking
- Detailed analytics tables
- Redundant user preference tables

## Error Handling

### Simplified Error Management
- Remove complex error boundary components
- Maintain basic try-catch blocks in API routes
- Keep essential validation for user inputs
- Remove verbose logging and debugging tools

### Essential Error Handling
- Authentication failures
- Wallet operation errors
- Job completion validation errors
- Network connectivity issues

## Testing Strategy

### Cleanup Validation
1. **Functionality Testing**: Verify core user flows still work
   - User login/logout
   - Job browsing and completion
   - Wallet balance checking
   - Earnings withdrawal

2. **Build Testing**: Ensure application builds successfully
   - No missing dependencies
   - No broken imports
   - Clean TypeScript compilation

3. **Deployment Testing**: Verify deployment compatibility
   - Vercel deployment works
   - Environment variables are correct
   - Database connections function

### Files to Remove

#### Documentation Files
- `API_OPTIMIZATION_GUIDE.md`
- `CONTRIBUTING.md`
- `DEPLOYMENT.md`
- `GITHUB_UPLOAD_CHECKLIST.md`
- `README-twitter-widget-verification.md`
- `TWITTERAPI_IO_SETUP.md`
- `VERCEL_DEPLOYMENT.md`
- `WEBHOOK_IMPLEMENTATION.md`
- `WIDGET-VERIFICATION-IMPLEMENTATION.md`

#### API Endpoints
- `/api/contract/*` - Direct contract interaction endpoints
- `/api/twitter-webhook` - Webhook handling
- `/api/twitterapi-io-proxy` - External API proxy
- `/api/verify-action` - Generic verification
- `/api/webhook-setup` - Webhook configuration
- `/api/user/deposit` - Direct deposit functionality
- `/api/user/update-twitter-handle` - Handle updates
- `/api/wallet/get-test-usdc` - Test token functionality
- `/api/wallet/info` - Detailed wallet info
- `/api/wallet/private-key` - Private key access
- `/api/wallet/transactions` - Transaction history
- `/api/wallet/usdc-balance` - Specific USDC balance
- `/api/wallet/verify-transaction` - Transaction verification

#### Components
- `components/ErrorBoundary.tsx` - Complex error handling
- `components/SimpleErrorBoundary.tsx` - Redundant error handling
- `components/SimpleTwitterVerification.tsx` - Redundant verification
- `components/TweetVerificationExample.tsx` - Example component
- `components/TwitterActionVerifier.tsx` - Complex verifier
- `components/TwitterHandleManager.tsx` - Handle management
- `components/UserDashboard.tsx` - Redundant dashboard
- `components/VerificationStatus.tsx` - Status display
- `components/WidgetVerificationStatus.tsx` - Widget status

#### Libraries
- `lib/job-validation.ts` - Complex validation
- `lib/price.ts` - Price calculations
- `lib/twitterapi-io-verification.ts` - External API verification
- `lib/verification-cache.ts` - Caching system
- `lib/webhook-verification.ts` - Webhook verification

#### Other Files
- `contracts/` - Smart contract source files
- `examples/` - Example implementations
- `scripts/` - Build and deployment scripts
- `public/install-verification.html` - Verification widget
- `public/twitter-verification.js` - Verification script
- `create-verification-sessions-table.sql` - Database migration

#### Configuration Files
- `.stylelintrc.json` - Style linting
- `vercel.json` - Vercel-specific config
- `tsconfig.tsbuildinfo` - TypeScript build cache

### Dependencies to Remove
From package.json:
- `playwright` - Testing framework
- `@wagmi/core` - Web3 library (if not used)
- `viem` - Ethereum library (if ethers.js is sufficient)
- `twitter-api-v2` - If using simpler verification method

### Consolidation Strategy

#### Merge Similar Components
- Combine wallet-related components into single WalletCard
- Merge verification components into single TwitterVerification
- Consolidate error handling into basic try-catch blocks

#### Simplify API Structure
- Reduce job-related endpoints to essential CRUD operations
- Combine user-related endpoints where possible
- Remove redundant wallet endpoints

#### Streamline Configuration
- Keep only essential environment variables
- Remove complex middleware configurations
- Simplify NextAuth configuration