// Price service to fetch cryptocurrency prices
export class PriceService {
  private static instance: PriceService;
  private ethPrice: number = 0;
  private lastUpdate: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  // Fetch ETH price from CoinGecko API
  async getEthPrice(): Promise<number> {
    const now = Date.now();
    
    // Return cached price if still valid
    if (this.ethPrice > 0 && (now - this.lastUpdate) < this.CACHE_DURATION) {
      return this.ethPrice;
    }

    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.ethPrice = data.ethereum?.usd || 0;
      this.lastUpdate = now;

      console.log('ETH price updated:', this.ethPrice);
      return this.ethPrice;
    } catch (error) {
      console.error('Error fetching ETH price:', error);
      // Return cached price or fallback
      return this.ethPrice || 2000; // Fallback price
    }
  }

  // Calculate total wallet value in USD
  async calculateWalletValue(ethBalance: string, usdcBalance: string): Promise<{
    ethValueUsd: number;
    usdcValueUsd: number;
    totalValueUsd: number;
  }> {
    const ethPrice = await this.getEthPrice();
    const ethAmount = parseFloat(ethBalance) || 0;
    const usdcAmount = parseFloat(usdcBalance) || 0;

    const ethValueUsd = ethAmount * ethPrice;
    const usdcValueUsd = usdcAmount; // USDC is 1:1 with USD

    return {
      ethValueUsd,
      usdcValueUsd,
      totalValueUsd: ethValueUsd + usdcValueUsd,
    };
  }

  // Format USD value for display
  formatUsd(value: number): string {
    if (value < 0.01) {
      return '$0.00';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}

export const priceService = PriceService.getInstance();