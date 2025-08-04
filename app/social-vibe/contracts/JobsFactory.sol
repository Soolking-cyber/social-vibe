// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title JobsFactory
 * @dev Smart contract for managing Twitter engagement jobs with USDC payments
 */
contract JobsFactory is ReentrancyGuard, Ownable, Pausable {
    IERC20 public immutable usdc;
    address public constant VAULT_ADDRESS = 0xAaA13165376D97Ec84654037f3F588847A0930d1;
    
    uint256 public constant PLATFORM_FEE_PERCENT = 10; // 10%
    uint256 public constant MIN_WITHDRAWAL_AMOUNT = 10 * 10**6; // 10 USDC (6 decimals)
    
    struct Job {
        uint256 id;
        address creator;
        string tweetUrl;
        string actionType; // "like", "repost", "comment"
        uint256 pricePerAction; // in USDC (6 decimals)
        uint256 maxActions;
        uint256 completedActions;
        uint256 totalBudget; // in USDC (6 decimals)
        string commentText;
        bool isActive;
        uint256 createdAt;
    }
    
    struct UserEarnings {
        uint256 totalEarned;
        uint256 availableForWithdrawal;
        uint256 totalWithdrawn;
    }
    
    // State variables
    uint256 public nextJobId = 1;
    mapping(uint256 => Job) public jobs;
    mapping(address => UserEarnings) public userEarnings;
    mapping(uint256 => mapping(address => bool)) public jobCompletions; // jobId => user => completed
    mapping(address => uint256[]) public userCreatedJobs;
    mapping(address => uint256[]) public userCompletedJobs;
    
    // Events
    event JobCreated(
        uint256 indexed jobId,
        address indexed creator,
        string tweetUrl,
        string actionType,
        uint256 pricePerAction,
        uint256 maxActions,
        uint256 totalBudget
    );
    
    event JobCompleted(
        uint256 indexed jobId,
        address indexed user,
        uint256 reward
    );
    
    event EarningsWithdrawn(
        address indexed user,
        uint256 amount
    );
    
    event PlatformFeeCollected(
        uint256 indexed jobId,
        uint256 feeAmount
    );
    
    constructor(address _usdcAddress) {
        usdc = IERC20(_usdcAddress);
    }
    
    /**
     * @dev Create a new engagement job
     * @param _tweetUrl URL of the tweet to engage with
     * @param _actionType Type of action (like, repost, comment)
     * @param _pricePerAction Price per action in USDC (6 decimals)
     * @param _maxActions Maximum number of actions
     * @param _commentText Comment text (if action type is comment)
     */
    function createJob(
        string memory _tweetUrl,
        string memory _actionType,
        uint256 _pricePerAction,
        uint256 _maxActions,
        string memory _commentText
    ) external nonReentrant whenNotPaused {
        require(_pricePerAction > 0, "Price per action must be greater than 0");
        require(_maxActions > 0, "Max actions must be greater than 0");
        require(bytes(_tweetUrl).length > 0, "Tweet URL cannot be empty");
        require(bytes(_actionType).length > 0, "Action type cannot be empty");
        
        uint256 totalBudget = _pricePerAction * _maxActions;
        uint256 platformFee = (totalBudget * PLATFORM_FEE_PERCENT) / 100;
        uint256 totalCost = totalBudget + platformFee;
        
        // Transfer USDC from user to contract
        require(
            usdc.transferFrom(msg.sender, address(this), totalCost),
            "USDC transfer failed"
        );
        
        // Transfer platform fee to vault
        require(
            usdc.transfer(VAULT_ADDRESS, platformFee),
            "Platform fee transfer failed"
        );
        
        // Create job
        jobs[nextJobId] = Job({
            id: nextJobId,
            creator: msg.sender,
            tweetUrl: _tweetUrl,
            actionType: _actionType,
            pricePerAction: _pricePerAction,
            maxActions: _maxActions,
            completedActions: 0,
            totalBudget: totalBudget,
            commentText: _commentText,
            isActive: true,
            createdAt: block.timestamp
        });
        
        userCreatedJobs[msg.sender].push(nextJobId);
        
        emit JobCreated(
            nextJobId,
            msg.sender,
            _tweetUrl,
            _actionType,
            _pricePerAction,
            _maxActions,
            totalBudget
        );
        
        emit PlatformFeeCollected(nextJobId, platformFee);
        
        nextJobId++;
    }
    
    /**
     * @dev Complete a job action and earn rewards
     * @param _jobId ID of the job to complete
     */
    function completeJob(uint256 _jobId) external nonReentrant whenNotPaused {
        Job storage job = jobs[_jobId];
        
        require(job.id != 0, "Job does not exist");
        require(job.isActive, "Job is not active");
        require(job.creator != msg.sender, "Cannot complete own job");
        require(!jobCompletions[_jobId][msg.sender], "Job already completed by user");
        require(job.completedActions < job.maxActions, "Job is fully completed");
        
        // Mark job as completed by user
        jobCompletions[_jobId][msg.sender] = true;
        job.completedActions++;
        
        // Add to user's completed jobs
        userCompletedJobs[msg.sender].push(_jobId);
        
        // Update user earnings
        userEarnings[msg.sender].totalEarned += job.pricePerAction;
        userEarnings[msg.sender].availableForWithdrawal += job.pricePerAction;
        
        // Deactivate job if fully completed
        if (job.completedActions >= job.maxActions) {
            job.isActive = false;
        }
        
        emit JobCompleted(_jobId, msg.sender, job.pricePerAction);
    }
    
    /**
     * @dev Withdraw earned USDC (minimum 10 USDC)
     */
    function withdrawEarnings() external nonReentrant whenNotPaused {
        UserEarnings storage earnings = userEarnings[msg.sender];
        
        require(
            earnings.availableForWithdrawal >= MIN_WITHDRAWAL_AMOUNT,
            "Minimum withdrawal amount is 10 USDC"
        );
        
        uint256 withdrawAmount = earnings.availableForWithdrawal;
        earnings.availableForWithdrawal = 0;
        earnings.totalWithdrawn += withdrawAmount;
        
        // Transfer USDC to user
        require(
            usdc.transfer(msg.sender, withdrawAmount),
            "USDC transfer failed"
        );
        
        emit EarningsWithdrawn(msg.sender, withdrawAmount);
    }
    
    /**
     * @dev Get job details
     */
    function getJob(uint256 _jobId) external view returns (Job memory) {
        return jobs[_jobId];
    }
    
    /**
     * @dev Get user earnings details
     */
    function getUserEarnings(address _user) external view returns (UserEarnings memory) {
        return userEarnings[_user];
    }
    
    /**
     * @dev Get jobs created by user
     */
    function getUserCreatedJobs(address _user) external view returns (uint256[] memory) {
        return userCreatedJobs[_user];
    }
    
    /**
     * @dev Get jobs completed by user
     */
    function getUserCompletedJobs(address _user) external view returns (uint256[] memory) {
        return userCompletedJobs[_user];
    }
    
    /**
     * @dev Check if user has completed a specific job
     */
    function hasUserCompletedJob(uint256 _jobId, address _user) external view returns (bool) {
        return jobCompletions[_jobId][_user];
    }
    
    /**
     * @dev Get active jobs (for marketplace display)
     */
    function getActiveJobs() external view returns (uint256[] memory) {
        uint256[] memory activeJobIds = new uint256[](nextJobId - 1);
        uint256 activeCount = 0;
        
        for (uint256 i = 1; i < nextJobId; i++) {
            if (jobs[i].isActive && jobs[i].completedActions < jobs[i].maxActions) {
                activeJobIds[activeCount] = i;
                activeCount++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            result[i] = activeJobIds[i];
        }
        
        return result;
    }
    
    /**
     * @dev Emergency pause function (only owner)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause function (only owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Emergency withdrawal function (only owner)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = usdc.balanceOf(address(this));
        require(usdc.transfer(owner(), balance), "Emergency withdrawal failed");
    }
    
    /**
     * @dev Get contract USDC balance
     */
    function getContractBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}