#!/bin/bash

# Social Impact Platform - GitHub Preparation Script
echo "🚀 Preparing Social Impact Platform for GitHub upload..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📁 Initializing Git repository..."
    git init
fi

# Add remote origin
echo "🔗 Setting up GitHub remote..."
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/Soolking-cyber/social-vibe.git

# Create .gitignore if it doesn't exist
if [ ! -f ".gitignore" ]; then
    echo "📝 Creating .gitignore..."
    cat > .gitignore << 'EOF'
# Dependencies
/node_modules
/.pnp
.pnp.js

# Testing
/coverage

# Next.js
/.next/
/out/

# Production
/build

# Environment variables
.env*.local
.env
.env.development
.env.production

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log

# Database
*.db
*.sqlite

# Cache
.cache/

# Temporary
tmp/
temp/
EOF
fi

# Check for sensitive files
echo "🔍 Checking for sensitive files..."
if [ -f ".env.local" ]; then
    echo "⚠️  WARNING: .env.local found - make sure it's in .gitignore"
fi

if [ -f ".env" ]; then
    echo "⚠️  WARNING: .env found - make sure it's in .gitignore"
fi

# Stage all files
echo "📦 Staging files for commit..."
git add .

# Check git status
echo "📊 Git status:"
git status

# Create initial commit
echo "💾 Creating initial commit..."
git commit -m "feat: initial commit - Social Impact Platform

- Complete Next.js application with Web3 integration
- Smart contract integration for job management
- Twitter API integration for task verification
- Supabase database with comprehensive schema
- User dashboard with wallet management
- Job marketplace with real-time updates
- USDC reward system with withdrawal functionality
- Production-ready deployment configuration"

# Push to GitHub
echo "🚀 Pushing to GitHub..."
echo "Run the following commands to push to GitHub:"
echo ""
echo "git branch -M main"
echo "git push -u origin main"
echo ""
echo "Or if you want to push now:"
read -p "Push to GitHub now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git branch -M main
    git push -u origin main
    echo "✅ Successfully pushed to GitHub!"
else
    echo "📝 Manual push required. Run:"
    echo "git branch -M main"
    echo "git push -u origin main"
fi

echo ""
echo "🎉 GitHub preparation complete!"
echo ""
echo "Next steps:"
echo "1. Go to https://github.com/Soolking-cyber/social-vibe"
echo "2. Set up environment variables for deployment"
echo "3. Deploy to Vercel or your preferred platform"
echo "4. Configure your smart contract and APIs"
echo ""
echo "📚 Check README.md for detailed setup instructions"