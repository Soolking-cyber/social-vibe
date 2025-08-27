# Codebase Cleanup - Pre-Cleanup Documentation

This document serves as a reference for the state of the codebase before cleanup operations begin.

## Backup Information
- **Backup Branch**: `backup-before-cleanup`
- **Backup Date**: 2025-08-26
- **Main Branch Commit**: 749832d (Add codebase cleanup spec files)

## Current File Structure

### Documentation Files (to be removed)
- API_OPTIMIZATION_GUIDE.md
- CONTRIBUTING.md
- DEPLOYMENT.md
- GITHUB_UPLOAD_CHECKLIST.md
- README-twitter-widget-verification.md
- TWITTERAPI_IO_SETUP.md
- VERCEL_DEPLOYMENT.md
- WEBHOOK_IMPLEMENTATION.md
- WIDGET-VERIFICATION-IMPLEMENTATION.md

### API Routes Structure

#### Authentication
- app/api/auth-check/route.ts
- app/api/auth/test/route.ts

#### Contract Interactions (to be removed)
- app/api/contract/complete-job/route.ts
- app/api/contract/create-job/route.ts
- app/api/contract/withdraw-earnings/route.ts

#### Job Management
- app/api/jobs/[id]/completion-status/route.ts
- app/api/jobs/[id]/route.ts
- app/api/jobs/complete/route.ts
- app/api/jobs/create/route.ts
- app/api/jobs/route.ts

#### User Management
- app/api/user/deposit/route.ts (to be removed)
- app/api/user/stats/route.ts
- app/api/user/twitter-handle/route.ts
- app/api/user/update-twitter-handle/route.ts (to be removed)

#### Verification
- app/api/verify-action/route.ts (to be removed)
- app/api/verify-twitter-action/route.ts

#### Wallet Operations
- app/api/wallet/info/route.ts (to be removed)
- app/api/wallet/private-key/route.ts (to be removed)
- app/api/wallet/refresh/route.ts
- app/api/wallet/transactions/route.ts (to be removed)
- app/api/wallet/usdc-balance/route.ts (to be removed)
- app/api/wallet/value/route.ts
- app/api/wallet/verify-transaction/route.ts (to be removed)
- app/api/wallet/withdraw/route.ts

#### Webhooks and Proxies (to be removed)
- app/api/twitter-webhook/route.ts
- app/api/twitterapi-io-proxy/route.ts
- app/api/webhook-setup/route.ts

### UI Components

#### Pages
- app/create-job/page.tsx
- app/layout.tsx
- app/login/page.tsx
- app/marketplace/page.tsx
- app/not-found.tsx
- app/page.tsx

#### Components (to be removed)
- components/ErrorBoundary.tsx
- components/SimpleErrorBoundary.tsx
- components/SimpleTwitterVerification.tsx
- components/TweetVerificationExample.tsx
- components/TwitterActionVerifier.tsx
- components/TwitterHandleManager.tsx
- components/UserDashboard.tsx
- components/VerificationStatus.tsx
- components/WidgetVerificationStatus.tsx

#### Components (to keep)
- components/AuthWrapper.tsx
- components/Navigation.tsx
- components/TwitterJobCard.tsx
- components/WalletCard.tsx
- components/providers.tsx
- components/ui/* (all UI primitives)

### Library Files

#### To Keep
- lib/contract.ts
- lib/tweet-verification.ts
- lib/utils.ts
- lib/wallet.ts

#### To Remove
- lib/job-validation.ts
- lib/price.ts
- lib/twitterapi-io-verification.ts
- lib/verification-cache.ts
- lib/webhook-verification.ts

### Other Files

#### Configuration Files
- auth.ts
- components.json
- middleware.ts
- package.json / package-lock.json
- postcss.config.js
- tailwind.config.js
- tsconfig.json

#### To Remove
- .stylelintrc.json
- vercel.json
- contracts/deploy.md
- create-verification-sessions-table.sql
- examples/simple-verification.js
- production-schema.sql
- public/install-verification.html
- public/twitter-verification.js

## Current Package.json Dependencies

Key dependencies that may be affected:
- Next.js framework
- NextAuth.js for authentication
- Tailwind CSS for styling
- TypeScript
- Various wallet and blockchain libraries
- Twitter API libraries

## Essential Functionality to Preserve

1. **User Authentication**: Twitter OAuth login/logout
2. **Job Management**: Browse, create, and complete social media tasks
3. **Wallet Operations**: Check balance, withdraw earnings
4. **Twitter Verification**: Verify completion of Twitter actions
5. **Core UI**: Navigation, job cards, wallet display

## Pre-Cleanup Functionality Verification

### Build Status: ✅ PASSED
- `npm install` completed successfully
- `npm run build` completed successfully with no errors
- All pages and API routes compiled correctly
- TypeScript compilation passed

### Development Server: ✅ PASSED  
- Development server starts without errors
- Middleware compiles successfully
- Authentication routes compile successfully

### Current State Summary
The application is in a working state with:
- 32 static/dynamic routes successfully built
- All API endpoints functional
- No TypeScript compilation errors
- No missing dependencies

## Notes

This cleanup aims to reduce complexity while maintaining all essential user-facing functionality. The backup branch ensures we can restore any accidentally removed functionality if needed.

**Pre-cleanup verification completed successfully on 2025-08-26**