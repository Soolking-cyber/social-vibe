# Vercel Deployment Guide

## Environment Variables for Vercel

When deploying to Vercel, you need to set these environment variables in your Vercel dashboard:

### Required TwitterAPI.io Variables
```
TWITTERAPI_IO_USER_ID=344176544479072260
TWITTERAPI_IO_API_KEY=e8191bd0956349cc9bd70c8c065e0183
```

### Other Required Variables (copy from your .env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://mioqdrprlxsweupgrbbz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pb3FkcnBybHhzd2V1cGdyYmJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4OTAwNzMsImV4cCI6MjA2OTQ2NjA3M30.PWYfL1fZldl_IXUM-o4hT_IUt1VdOvINSxRh9b0xdJA
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pb3FkcnBybHhzd2V1cGdyYmJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzg5MDA3MywiZXhwIjoyMDY5NDY2MDczfQ.BPEkaCP0x-SnA1CkzXMb7DWo0jLsTLVWWRj1glmq7-g
SUPABASE_JWT_SECRET=24ne7AXxVZngYh0nNIAtAWCSeoa8LUnGA5tTpLbn6S94/XtwKvQzQ3VC3eNj0rQrRcPVtQpMFxPXI26k57Iihg==
TWITTER_CLIENT_ID=RVVvVDhQLWlxYUl5VUJtZUZFRFA6MTpjaQ
TWITTER_CLIENT_SECRET=H03zVY_iLiI7ecHP9Mgb76DPbisCpnzxyoq3XV7JMyaKjM5r5o
NEXTAUTH_URL=https://socialimpact.fun
NEXTAUTH_SECRET=4WYMen8gjiw8Qk9EMkwGfCb6lNdY1yX7wqp8LA2yMXg=
WALLET_ENCRYPTION_KEY=PUd3/aH1PqBreZgz8EUJO5hWyf6TK2KmiDAOvW5BwOzMBNbdWBi0DA
INFURA_PROJECT_ID=e5662daa17bb41e9a2f48d29f35d1348
JOBS_FACTORY_CONTRACT_ADDRESS=0x6F68A89d37D3467c36c76748305bfEDf6105F621
```

## How to Set Environment Variables in Vercel

### Method 1: Vercel Dashboard
1. Go to your project in Vercel dashboard
2. Click on "Settings" tab
3. Click on "Environment Variables" in the sidebar
4. Add each variable:
   - **Name**: `TWITTERAPI_IO_USER_ID`
   - **Value**: `344176544479072260`
   - **Environment**: Select "Production", "Preview", and "Development"
   - Click "Save"
5. Repeat for `TWITTERAPI_IO_API_KEY` and all other variables

### Method 2: Vercel CLI
```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login to Vercel
vercel login

# Set environment variables
vercel env add TWITTERAPI_IO_USER_ID
# Enter: 344176544479072260
# Select: Production, Preview, Development

vercel env add TWITTERAPI_IO_API_KEY
# Enter: e8191bd0956349cc9bd70c8c065e0183
# Select: Production, Preview, Development

# Continue for all other variables...
```

### Method 3: Import from .env.local
```bash
# You can also pull your current environment
vercel env pull .env.vercel

# Then push to Vercel (after editing)
vercel env push .env.vercel
```

## Deployment Steps

1. **Set Environment Variables** (as described above)

2. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

3. **Verify Deployment**:
   - Check that the app loads at your Vercel URL
   - Test the TwitterAPI.io health check: `https://your-app.vercel.app/api/twitterapi-io-proxy`
   - Should return:
     ```json
     {
       "status": "healthy",
       "service": "twitterapi-io-proxy",
       "configured": true,
       "userId": "344176544479072260",
       "hasApiKey": true
     }
     ```

4. **Test Twitter Verification**:
   - Try the verification flow on your deployed app
   - Check Vercel function logs for any errors

## Troubleshooting

### Environment Variables Not Working
- Make sure variables are set for the correct environment (Production/Preview/Development)
- Redeploy after adding environment variables
- Check Vercel function logs for "not configured" errors

### TwitterAPI.io API Errors
- Verify the API key is correct: `e8191bd0956349cc9bd70c8c065e0183`
- Check rate limits in TwitterAPI.io dashboard
- Monitor Vercel function logs for API response errors

### Build Errors
- Ensure all dependencies are in package.json
- Check that TypeScript compilation passes locally first
- Review Vercel build logs for specific errors

## Post-Deployment Checklist

✅ Environment variables set in Vercel  
✅ App deploys successfully  
✅ TwitterAPI.io health check passes  
✅ Twitter login works  
✅ Verification flow completes  
✅ Database connections work  
✅ Smart contract interactions work  

Your app should now be fully functional on Vercel with TwitterAPI.io verification!