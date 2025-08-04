import { ethers } from 'ethers';

// JobsFactory Contract ABI (will be generated after compilation)
export const JOBS_FACTORY_ABI = [
    // Constructor
    "constructor(address _usdcAddress)",

    // View Functions
    "function usdc() view returns (address)",
    "function VAULT_ADDRESS() view returns (address)",
    "function PLATFORM_FEE_PERCENT() view returns (uint256)",
    "function MIN_WITHDRAWAL_AMOUNT() view returns (uint256)",
    "function nextJobId() view returns (uint256)",
    "function getJob(uint256 _jobId) view returns (tuple(uint256 id, address creator, string tweetUrl, string actionType, uint256 pricePerAction, uint256 maxActions, uint256 completedActions, uint256 totalBudget, string commentText, bool isActive, uint256 createdAt))",
    "function getUserEarnings(address _user) view returns (tuple(uint256 totalEarned, uint256 availableForWithdrawal, uint256 totalWithdrawn))",
    "function getUserCreatedJobs(address _user) view returns (uint256[])",
    "function getUserCompletedJobs(address _user) view returns (uint256[])",
    "function hasUserCompletedJob(uint256 _jobId, address _user) view returns (bool)",
    "function getActiveJobs() view returns (uint256[])",
    "function getContractBalance() view returns (uint256)",

    // State Changing Functions
    "function createJob(string _tweetUrl, string _actionType, uint256 _pricePerAction, uint256 _maxActions, string _commentText)",
    "function completeJob(uint256 _jobId)",
    "function withdrawEarnings()",

    // Admin Functions
    "function pause()",
    "function unpause()",
    "function emergencyWithdraw()",

    // Events
    "event JobCreated(uint256 indexed jobId, address indexed creator, string tweetUrl, string actionType, uint256 pricePerAction, uint256 maxActions, uint256 totalBudget)",
    "event JobCompleted(uint256 indexed jobId, address indexed user, uint256 reward)",
    "event EarningsWithdrawn(address indexed user, uint256 amount)",
    "event PlatformFeeCollected(uint256 indexed jobId, uint256 feeAmount)"
];

// Contract addresses (update after deployment)
export const CONTRACT_ADDRESSES = {
    JOBS_FACTORY: '0x6F68A89d37D3467c36c76748305bfEDf6105F621', // Deployed and verified contract
    USDC_SEPOLIA: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    VAULT_ADDRESS: '0xAaA13165376D97Ec84654037f3F588847A0930d1'
};

// Contract interaction service
export class JobsFactoryService {
    public contract: any;
    private provider: ethers.JsonRpcProvider;
    private contractAddress: string;

    constructor(contractAddress: string, providerUrl: string) {
        this.contractAddress = contractAddress;
        this.provider = new ethers.JsonRpcProvider(providerUrl);
        this.contract = new ethers.Contract(contractAddress, JOBS_FACTORY_ABI, this.provider);
    }

    // Connect with signer for transactions
    connectSigner(signer: ethers.Signer) {
        this.contract = new ethers.Contract(this.contractAddress, JOBS_FACTORY_ABI, signer);
    }

    // View functions
    async getJob(jobId: number) {
        return await this.contract.getJob(jobId);
    }

    async getUserEarnings(userAddress: string) {
        return await this.contract.getUserEarnings(userAddress);
    }

    async getActiveJobs() {
        return await this.contract.getActiveJobs();
    }

    async hasUserCompletedJob(jobId: number, userAddress: string) {
        return await this.contract.hasUserCompletedJob(jobId, userAddress);
    }

    async getContractBalance() {
        return await this.contract.getContractBalance();
    }

    // Transaction functions
    async createJob(
        tweetUrl: string,
        actionType: string,
        pricePerAction: string, // in USDC (will be converted to wei)
        maxActions: number,
        commentText: string = ""
    ) {
        // Ensure pricePerAction has no more than 6 decimal places for USDC
        const cleanPrice = parseFloat(pricePerAction).toFixed(6);
        console.log(`Contract createJob: Converting ${pricePerAction} to ${cleanPrice}`);
        const priceInWei = ethers.parseUnits(cleanPrice, 6); // USDC has 6 decimals
        return await this.contract.createJob(
            tweetUrl,
            actionType,
            priceInWei,
            maxActions,
            commentText
        );
    }

    async completeJob(jobId: number) {
        return await this.contract.completeJob(jobId);
    }

    async withdrawEarnings() {
        return await this.contract.withdrawEarnings();
    }

    // Helper functions
    formatUSDC(amount: bigint): string {
        return ethers.formatUnits(amount, 6);
    }

    parseUSDC(amount: string): bigint {
        return ethers.parseUnits(amount, 6);
    }

    // Event listeners
    onJobCreated(callback: (jobId: number, creator: string, details: any) => void) {
        this.contract.on('JobCreated', (jobId: any, creator: string, tweetUrl: string, actionType: string, pricePerAction: any, maxActions: any, totalBudget: any) => {
            callback(Number(jobId), creator, {
                tweetUrl,
                actionType,
                pricePerAction: pricePerAction.toString(),
                maxActions: Number(maxActions),
                totalBudget: totalBudget.toString()
            });
        });
    }

    onJobCompleted(callback: (jobId: number, user: string, reward: bigint) => void) {
        this.contract.on('JobCompleted', (jobId: any, user: string, reward: any) => {
            callback(Number(jobId), user, reward);
        });
    }

    onEarningsWithdrawn(callback: (user: string, amount: bigint) => void) {
        this.contract.on('EarningsWithdrawn', (user: string, amount: any) => {
            callback(user, amount);
        });
    }
}

// USDC Contract ABI (minimal for approvals)
export const USDC_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)"
];

// USDC interaction service
export class USDCService {
    private contract: any;
    private provider: ethers.JsonRpcProvider;

    constructor(providerUrl: string) {
        this.provider = new ethers.JsonRpcProvider(providerUrl);
        this.contract = new ethers.Contract(
            CONTRACT_ADDRESSES.USDC_SEPOLIA,
            USDC_ABI,
            this.provider
        );
    }

    connectSigner(signer: ethers.Signer) {
        this.contract = new ethers.Contract(
            CONTRACT_ADDRESSES.USDC_SEPOLIA,
            USDC_ABI,
            signer
        );
    }

    async approve(spenderAddress: string, amount: string) {
        // Ensure amount has no more than 6 decimal places for USDC
        const cleanAmount = parseFloat(amount).toFixed(6);
        console.log(`USDC approve: Converting ${amount} to ${cleanAmount}`);
        const amountInWei = ethers.parseUnits(cleanAmount, 6);
        return await this.contract.approve(spenderAddress, amountInWei);
    }

    async getAllowance(ownerAddress: string, spenderAddress: string) {
        return await this.contract.allowance(ownerAddress, spenderAddress);
    }

    async getBalance(userAddress: string) {
        return await this.contract.balanceOf(userAddress);
    }
}

// Initialize services only if contract address is available
export const createJobsFactoryService = (contractAddress: string) => {
    return new JobsFactoryService(
        contractAddress,
        `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
    );
};

export const usdcService = new USDCService(
    `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
);

// Export a default instance (will need contract address to be set)
export let jobsFactoryService: JobsFactoryService | null = null;

// Function to initialize the service with contract address
export const initializeJobsFactoryService = (contractAddress: string) => {
    jobsFactoryService = createJobsFactoryService(contractAddress);
    return jobsFactoryService;
};