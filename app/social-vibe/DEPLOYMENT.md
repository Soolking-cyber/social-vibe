# Deployment Guide

This guide will help you deploy the Social Impact Platform to production.

## 🚀 Quick Deploy to Vercel

1. **Fork/Clone the repository**
   ```bash
   git clone https://github.com/Soolking-cyber/social-vibe.git
   cd social-vibe
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will auto-detect Next.js configuration

3. **Set Environment Variables**
   Add all variables from `.env.example` in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add each variable with production values

## 🔧 Environment Setup

### 1. Twitter Developer Setup
1. Create a Twitter Developer account
2. Create a new app with OAuth 2.0
3. Get Client ID, Client Secret, and Bearer Token
4. Set callback URL: `https://your-domain.com/api/auth/callback/twitter`

### 2. Supabase Setup
1. Create a new Supabase project
2. Run `production-schema.sql` in SQL Editor
3. Get URL and keys from Settings → API
4. Configure RLS policies if needed

### 3. Ethereum Setup
1. Get Infura project ID from [infura.io](https://infura.io)
2. Deploy smart contract to Sepolia testnet
3. Fund contract with USDC for job rewards
4. Note contract address

### 4. Security Setup
1. Generate a 32-character encryption key for wallets
2. Use a strong NextAuth secret
3. Enable HTTPS in production

## 📊 Database Migration

If you have an existing database, run the migration:

```sql
-- Remove earned_balance field (now calculated dynamically)
\i remove-earned-balance-migration.sql
```

## 🔍 Production Checklist

### Before Deployment:
- [ ] All environment variables configured
- [ ] Database schema deployed
- [ ] Smart contract deployed and funded
- [ ] Twitter app configured with correct callback URLs
- [ ] SSL certificate configured

### After Deployment:
- [ ] Test user registration flow
- [ ] Test job creation and completion
- [ ] Test withdrawal functionality
- [ ] Verify Twitter authentication
- [ ] Check wallet generation
- [ ] Test on-chain transactions

## 🛠 Troubleshooting

### Common Issues:

1. **Twitter Auth Fails**
   - Check callback URL matches exactly
   - Verify Client ID/Secret are correct
   - Ensure app has read permissions

2. **Database Connection Issues**
   - Verify Supabase URL and keys
   - Check RLS policies
   - Ensure schema is deployed

3. **Wallet Issues**
   - Verify encryption key is 32 characters
   - Check Infura project ID
   - Ensure contract address is correct

4. **Transaction Failures**
   - Verify contract has USDC balance
   - Check gas fees and ETH balance
   - Confirm contract is on Sepolia testnet

## 📈 Monitoring

### Key Metrics to Monitor:
- User registration rate
- Job completion rate
- Withdrawal success rate
- API response times
- Error rates

### Recommended Tools:
- Vercel Analytics (built-in)
- Supabase Dashboard
- Etherscan for contract monitoring
- Twitter API usage dashboard

## 🔄 Updates and Maintenance

### Regular Tasks:
- Monitor USDC contract balance
- Check API rate limits
- Update dependencies
- Review error logs
- Backup database

### Scaling Considerations:
- Database connection pooling
- API rate limit management
- CDN for static assets
- Caching strategies

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section
2. Review Vercel deployment logs
3. Check Supabase logs
4. Create an issue on GitHub

## 🔐 Security Best Practices

1. **Never commit secrets** to version control
2. **Use environment variables** for all sensitive data
3. **Enable HTTPS** in production
4. **Regularly rotate** API keys and secrets
5. **Monitor** for suspicious activity
6. **Keep dependencies** updated

---

Happy deploying! 🚀