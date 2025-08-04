# Social Impact Platform

A decentralized social media engagement platform built on Ethereum that allows users to earn USDC by completing social media tasks.

## 🚀 Features

- **Web3 Integration**: Built on Ethereum Sepolia testnet with smart contracts
- **Social Media Tasks**: Complete Twitter engagement tasks (likes, retweets, comments)
- **USDC Rewards**: Earn real USDC for completing tasks
- **Wallet Management**: Automatic wallet creation and management
- **Job Creation**: Create engagement jobs for your content
- **Real-time Verification**: Twitter API integration for task verification
- **Withdrawal System**: Withdraw earnings directly to your wallet

## 🛠 Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Authentication**: NextAuth.js with Twitter OAuth
- **Database**: Supabase (PostgreSQL)
- **Blockchain**: Ethereum, ethers.js v6
- **Smart Contracts**: Solidity (Jobs Factory Contract)
- **APIs**: Twitter API v2, Ethereum RPC

## 📋 Prerequisites

- Node.js 18+ and npm
- Twitter Developer Account (for API keys)
- Supabase Account
- Infura Account (for Ethereum RPC)
- MetaMask or compatible wallet

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Soolking-cyber/social-vibe.git
   cd social-vibe
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

4. **Configure environment variables in `.env.local`:**
   ```env
   # NextAuth
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-secret-key

   # Twitter OAuth
   TWITTER_CLIENT_ID=your-twitter-client-id
   TWITTER_CLIENT_SECRET=your-twitter-client-secret

   # Twitter API
   TWITTER_BEARER_TOKEN=your-twitter-bearer-token

   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

   # Ethereum
   INFURA_PROJECT_ID=your-infura-project-id
   JOBS_FACTORY_CONTRACT_ADDRESS=your-contract-address

   # Wallet Encryption
   WALLET_ENCRYPTION_KEY=your-32-char-encryption-key
   ```

5. **Set up the database**
   ```bash
   # Run the production schema in your Supabase SQL editor
   cat production-schema.sql
   ```

6. **Run the development server**
   ```bash
   npm run dev
   ```

## 🏗 Database Setup

The project uses Supabase with a comprehensive schema. Run the `production-schema.sql` file in your Supabase SQL editor to set up all required tables and indexes.

### Key Tables:
- `users` - User profiles with wallet integration
- `jobs` - Social media engagement jobs
- `job_completions` - Tracks completed tasks and earnings
- `wallet_transactions` - On-chain transaction history

## 📱 Smart Contract

The platform uses a Jobs Factory smart contract deployed on Ethereum Sepolia testnet. The contract handles:
- Job creation with USDC deposits
- Task completion verification
- Earnings distribution
- Withdrawal functionality

## 🔐 Security Features

- **Encrypted Wallet Storage**: Private keys encrypted in database
- **Twitter Verification**: Multi-method Twitter API verification
- **Gas Fee Management**: Automatic ETH balance checking
- **Withdrawal Limits**: Minimum 10 USDC withdrawal threshold
- **Transaction Verification**: On-chain transaction validation

## 🎯 Usage

### For Task Completers:
1. Sign in with Twitter
2. Browse available jobs in the marketplace
3. Complete social media tasks (like, retweet, comment)
4. Earn USDC rewards automatically
5. Withdraw earnings when you reach 10 USDC

### For Job Creators:
1. Create engagement jobs for your content
2. Set reward amounts and maximum actions
3. Deposit USDC to fund the job
4. Track completion progress
5. Jobs automatically distribute rewards

## 🚀 Deployment

### Vercel Deployment:
1. Connect your GitHub repository to Vercel
2. Add all environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Environment Setup:
- Set up Twitter Developer App with OAuth 2.0
- Configure Supabase project with RLS policies
- Deploy smart contract to Sepolia testnet
- Fund contract with USDC for job rewards

## 🧪 Testing

The platform includes comprehensive testing tools:
- Contract interaction testing
- Twitter API verification testing
- Job completion flow testing
- Wallet balance verification

## 📊 Features Overview

### Dashboard:
- Real-time wallet balance display
- Earned balance tracking
- Job creation and completion stats
- One-click data refresh

### Marketplace:
- Browse available jobs
- Filter by job type and status
- Two-step completion process
- Real-time job updates

### Wallet Integration:
- Automatic wallet generation
- Secure key management
- Multi-token support (ETH, USDC)
- Transaction history

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the debug tools in the application

## 🔗 Links

- [Live Demo](https://social-vibe.vercel.app)
- [Smart Contract](https://sepolia.etherscan.io/address/your-contract-address)
- [Documentation](https://github.com/Soolking-cyber/social-vibe/wiki)

---

Built with ❤️ for the decentralized social media future