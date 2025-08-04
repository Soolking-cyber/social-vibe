# Contributing to Social Impact Platform

Thank you for your interest in contributing to the Social Impact Platform! This document provides guidelines and information for contributors.

## 🤝 How to Contribute

### Reporting Issues
- Use GitHub Issues to report bugs or request features
- Provide detailed information about the issue
- Include steps to reproduce for bugs
- Check existing issues before creating new ones

### Pull Requests
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 🏗 Development Setup

1. **Clone your fork**
   ```bash
   git clone https://github.com/your-username/social-vibe.git
   cd social-vibe
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env.local
   # Fill in your development environment variables
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

## 📝 Code Style

### TypeScript
- Use TypeScript for all new code
- Define proper interfaces and types
- Avoid `any` type when possible

### React Components
- Use functional components with hooks
- Follow the existing component structure
- Use proper prop types

### Naming Conventions
- Use camelCase for variables and functions
- Use PascalCase for components and types
- Use kebab-case for file names

### Code Formatting
- Use Prettier for code formatting
- Follow ESLint rules
- Add comments for complex logic

## 🧪 Testing

### Running Tests
```bash
npm run test
```

### Writing Tests
- Add tests for new features
- Test both success and error cases
- Use descriptive test names

### Manual Testing
- Test the complete user flow
- Verify on different browsers
- Check mobile responsiveness

## 🗂 Project Structure

```
social-vibe/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── marketplace/       # Marketplace page
│   └── create-job/        # Job creation page
├── components/            # React components
├── lib/                   # Utility libraries
│   ├── contract.ts        # Smart contract integration
│   ├── wallet.ts          # Wallet management
│   └── twitter-api.ts     # Twitter API integration
├── types/                 # TypeScript type definitions
└── public/               # Static assets
```

## 🎯 Areas for Contribution

### High Priority
- Bug fixes and security improvements
- Performance optimizations
- Mobile responsiveness improvements
- Accessibility enhancements

### Medium Priority
- New social media platform integrations
- Advanced job filtering and search
- Analytics and reporting features
- UI/UX improvements

### Low Priority
- Additional blockchain networks
- Advanced wallet features
- Gamification elements
- Social features

## 🔧 API Guidelines

### REST API Design
- Use proper HTTP methods (GET, POST, PUT, DELETE)
- Return appropriate status codes
- Include error messages in responses
- Follow consistent response formats

### Error Handling
- Provide meaningful error messages
- Log errors for debugging
- Handle edge cases gracefully
- Return appropriate HTTP status codes

## 🔐 Security Guidelines

### Smart Contract Integration
- Validate all inputs
- Handle transaction failures gracefully
- Check gas limits and fees
- Verify contract interactions

### API Security
- Validate and sanitize inputs
- Use proper authentication
- Implement rate limiting
- Protect sensitive data

### Database Security
- Use parameterized queries
- Implement proper access controls
- Encrypt sensitive data
- Regular security audits

## 📋 Pull Request Checklist

Before submitting a PR, ensure:
- [ ] Code follows project style guidelines
- [ ] Tests pass locally
- [ ] New features have tests
- [ ] Documentation is updated
- [ ] No console.log statements in production code
- [ ] Environment variables are documented
- [ ] Breaking changes are documented

## 🐛 Bug Report Template

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g. iOS]
- Browser: [e.g. chrome, safari]
- Version: [e.g. 22]
```

## 💡 Feature Request Template

```markdown
**Is your feature request related to a problem?**
A clear description of what the problem is.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Other solutions you've considered.

**Additional context**
Any other context or screenshots.
```

## 🏷 Commit Message Guidelines

Use conventional commits:
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `style:` formatting changes
- `refactor:` code refactoring
- `test:` adding tests
- `chore:` maintenance tasks

Example: `feat: add job completion verification`

## 📞 Getting Help

- Join our Discord community
- Check existing GitHub issues
- Read the documentation
- Ask questions in discussions

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to the Social Impact Platform! 🚀