import { ethers } from 'ethers';
import crypto from 'crypto';

// Sepolia testnet configuration with multiple RPC providers
export const SEPOLIA_CONFIG = {
  chainId: 11155111,
  name: 'Sepolia',
  rpcUrls: [
    `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
    'https://sepolia.drpc.org',
    'https://rpc.sepolia.org',
    'https://ethereum-sepolia.blockpi.network/v1/rpc/public',
    'https://sepolia.gateway.tenderly.co',
    'https://gateway.tenderly.co/public/sepolia'
  ].filter(url => !url.includes('undefined')), // Remove URLs with undefined env vars
  blockExplorer: 'https://sepolia.etherscan.io',
  // USDC contract address on Sepolia testnet
  usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Confirmed USDC contract on Sepolia
};

// ERC20 ABI for USDC balance checking
export const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

// Encryption key for storing private keys
const ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY || 'default-32-char-key-change-this!';

export class WalletService {
  private providers: ethers.JsonRpcProvider[];
  private currentProviderIndex: number = 0;

  constructor() {
    // Initialize multiple providers for fallback
    this.providers = SEPOLIA_CONFIG.rpcUrls.map(url => {
      try {
        return new ethers.JsonRpcProvider(url);
      } catch (error) {
        console.error(`Failed to initialize provider ${url}:`, error);
        return null;
      }
    }).filter(Boolean) as ethers.JsonRpcProvider[];

    if (this.providers.length === 0) {
      throw new Error('No RPC providers could be initialized');
    }

    console.log(`Initialized ${this.providers.length} RPC providers for Sepolia`);
  }

  // Get current provider with automatic failover
  private async getWorkingProvider(): Promise<ethers.JsonRpcProvider> {
    for (let i = 0; i < this.providers.length; i++) {
      const providerIndex = (this.currentProviderIndex + i) % this.providers.length;
      const provider = this.providers[providerIndex];

      try {
        // Test the provider with a simple call
        await provider.getBlockNumber();
        this.currentProviderIndex = providerIndex;
        return provider;
      } catch (error) {
        console.error(`Provider ${providerIndex} failed:`, error);
        continue;
      }
    }

    throw new Error('All RPC providers are currently unavailable');
  }

  // Retry logic for RPC calls
  private async withRetry<T>(operation: (provider: ethers.JsonRpcProvider) => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const provider = await this.getWorkingProvider();
        return await operation(provider);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Attempt ${attempt + 1} failed:`, lastError.message);

        // If it's a rate limit error, try next provider immediately
        if (lastError.message.includes('Too Many Requests') || lastError.message.includes('429')) {
          this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
          continue;
        }

        // For other errors, wait before retrying
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  // Generate a new wallet
  generateWallet(): {
    address: string;
    privateKey: string;
    mnemonic: string;
  } {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase || '',
    };
  }

  // Encrypt sensitive data
  encrypt(text: string): string {
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipheriv(algorithm, key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  // Decrypt sensitive data
  decrypt(encryptedText: string): string {
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);

      const parts = encryptedText.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  // Get ETH balance with retry logic
  async getEthBalance(address: string): Promise<string> {
    try {
      return await this.withRetry(async (provider) => {
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
      });
    } catch (error) {
      console.error('Error fetching ETH balance after retries:', error);
      return '0.0';
    }
  }

  // Get USDC balance with retry logic
  async getUsdcBalance(address: string): Promise<string> {
    try {
      console.log('Fetching USDC balance for address:', address);
      console.log('Using USDC contract:', SEPOLIA_CONFIG.usdcAddress);

      return await this.withRetry(async (provider) => {
        const usdcContract = new ethers.Contract(
          SEPOLIA_CONFIG.usdcAddress,
          ERC20_ABI,
          provider
        );

        const balance = await usdcContract.balanceOf(address);
        const decimals = await usdcContract.decimals();

        console.log('USDC balance raw:', balance.toString());
        console.log('USDC decimals:', decimals);

        const formattedBalance = ethers.formatUnits(balance, decimals);
        console.log('USDC balance formatted:', formattedBalance);

        return formattedBalance;
      });
    } catch (error) {
      console.error('Error fetching USDC balance after retries:', error);
      return '0.0';
    }
  }

  // Get both balances
  async getBalances(address: string): Promise<{
    eth: string;
    usdc: string;
  }> {
    const [eth, usdc] = await Promise.all([
      this.getEthBalance(address),
      this.getUsdcBalance(address),
    ]);

    return { eth, usdc };
  }

  // Create wallet from private key with current working provider
  async createWalletFromPrivateKey(privateKey: string): Promise<ethers.Wallet> {
    const provider = await this.getWorkingProvider();
    return new ethers.Wallet(privateKey, provider);
  }

  // Send ETH
  async sendEth(
    privateKey: string,
    toAddress: string,
    amount: string
  ): Promise<string> {
    try {
      const wallet = await this.createWalletFromPrivateKey(privateKey);
      const tx = await wallet.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(amount),
      });

      return tx.hash;
    } catch (error) {
      console.error('Error sending ETH:', error);
      throw error;
    }
  }

  // Send USDC
  async sendUsdc(
    privateKey: string,
    toAddress: string,
    amount: string
  ): Promise<string> {
    try {
      const wallet = await this.createWalletFromPrivateKey(privateKey);
      const usdcContract = new ethers.Contract(
        SEPOLIA_CONFIG.usdcAddress,
        ERC20_ABI,
        wallet
      );

      const decimals = await usdcContract.decimals();
      const tx = await usdcContract.transfer(
        toAddress,
        ethers.parseUnits(amount, decimals)
      );

      return tx.hash;
    } catch (error) {
      console.error('Error sending USDC:', error);
      throw error;
    }
  }
}

export const walletService = new WalletService();