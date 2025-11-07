// SPDX-License-Identifier: MIT
// Further information: https://eips.ethereum.org/EIPS/eip-2770
pragma solidity ^0.8.26;

/**
 * @title UniBank
 * @notice A simple bank contract for students to learn about deposits, withdrawals, 
 * interest rates, role-based access control, and reserve management.
 */
contract UniBank {
    
    // ============================================
    // STATE VARIABLES
    // ============================================
    
    // Owner of the contract (set to deployer in constructor)
    address public owner;
    
    // Flag indicating whether the bank is active or not
    bool public active;
    
    // Deposit lock period in minutes (constant: 2 minutes)
    uint256 public constant DEPOSIT_LOCK_MINUTES = 2;
    
    // Current interest rate per minute in basis points (100 BP = 1%)
    // This applies only to NEW deposits
    uint256 public interestRatePerMinuteBP;
    
    // Total reserves available to pay interest
    // This is separate accounting from user deposits
    uint256 public totalReserves;
    
    // Mapping of administrator addresses
    mapping(address => bool) public admins;
    
    // Mapping of authorized users who can deposit and withdraw
    mapping(address => bool) public authorizedUsers;
    
    // Deposit history for each user (each user can have multiple deposits)
    mapping(address => DepositHistory[]) private deposits;
    
    /**
     * @notice Structure to hold information about each deposit
     */
    struct DepositHistory {
        uint256 amount;                    // Principal amount deposited
        uint256 depositTimestamp;          // When the deposit was made
        uint256 interestRateBPAtDeposit;   // Interest rate snapshot at deposit time
        uint256 maturityPeriodMinutes;     // Lock period in minutes before withdrawal allowed
        bool withdrawn;                    // Flag to prevent double withdrawals
    }
    
    // ============================================
    // EVENTS
    // ============================================
    
    event BankActivated();
    event BankDeactivated();
    event ReserveAdded(address indexed from, uint256 amount, uint256 newTotalReserves);
    event InterestRateChanged(address indexed by, uint256 oldRateBP, uint256 newRateBP);
    event AdminAdded(address indexed account);
    event AdminRevoked(address indexed account);
    event UserWhitelisted(address indexed account);
    event UserRemoved(address indexed account);
    event DepositMade(address indexed account, uint256 indexed depositIndex, uint256 amount, uint256 rateBP, uint256 timestamp);
    event WithdrawalMade(address indexed account, uint256 indexed depositIndex, uint256 principal, uint256 interest, uint256 timestamp);
    
    // ============================================
    // MODIFIERS
    // ============================================
    
    /**
     * @notice Restricts function access to the contract owner only
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can execute this.");
        _;
    }
    
    /**
     * @notice Restricts function access to administrators only
     */
    modifier onlyAdmin() {
        require(admins[msg.sender], "Only admin can execute this.");
        _;
    }
    
    /**
     * @notice Restricts function access to owner or administrators
     */
    modifier onlyOwnerOrAdmin() {
        require(msg.sender == owner || admins[msg.sender], "Only owner or admin can execute this.");
        _;
    }
    
    /**
     * @notice Restricts function access to authorized users only
     */
    modifier onlyAuthorizedUser() {
        require(authorizedUsers[msg.sender], "User is not authorized.");
        _;
    }
    
    /**
     * @notice Ensures the bank is active
     */
    modifier onlyIfBankActive() {
        require(active, "Bank is not active.");
        _;
    }
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    /**
     * @notice Constructor sets the deployer as owner and bank to inactive
     */
    constructor() {
        owner = msg.sender;
        active = false;
        interestRatePerMinuteBP = 0; // Initially 0%, owner must set it
    }
    
    // ============================================
    // OWNER FUNCTIONS
    // ============================================
    
    /**
     * @notice Activate or deactivate the bank
     * @param _bankStatus True to activate, false to deactivate
     */
    function setBankStatus(bool _bankStatus) external onlyOwner {
        active = _bankStatus;
        if (_bankStatus) {
            emit BankActivated();
        } else {
            emit BankDeactivated();
        }
    }
    
    /**
     * @notice Add reserves to cover interest expenses
     * @dev Owner sends ETH which is tracked separately from deposits
     */
    function addReserves() external payable onlyOwner {
        require(msg.value > 0, "Reserve amount must be greater than zero.");
        totalReserves += msg.value;
        emit ReserveAdded(msg.sender, msg.value, totalReserves);
    }
    
    /**
     * @notice Add an administrator who can manage users and interest rates
     * @param account Address to grant admin rights
     */
    function addAdmin(address account) external onlyOwner {
        require(account != address(0), "Invalid address.");
        require(!admins[account], "Already an admin.");
        admins[account] = true;
        emit AdminAdded(account);
    }
    
    /**
     * @notice Revoke administrator rights from an account
     * @param account Address to revoke admin rights from
     */
    function revokeAdmin(address account) external onlyOwner {
        require(admins[account], "Not an admin.");
        admins[account] = false;
        emit AdminRevoked(account);
    }
    
    // ============================================
    // OWNER OR ADMIN FUNCTIONS
    // ============================================
    
    /**
     * @notice Set the interest rate per minute for NEW deposits
     * @param newRateBP New interest rate in basis points (100 BP = 1%)
     * @dev Only affects new deposits; existing deposits keep their original rate
     */
    function setInterestRatePerMinuteBP(uint256 newRateBP) external onlyOwnerOrAdmin {
        uint256 oldRate = interestRatePerMinuteBP;
        interestRatePerMinuteBP = newRateBP;
        emit InterestRateChanged(msg.sender, oldRate, newRateBP);
    }
    
    /**
     * @notice Add a user to the authorized users list
     * @param account Address to authorize
     */
    function addAuthorizedUser(address account) external onlyOwnerOrAdmin {
        require(account != address(0), "Invalid address.");
        require(!authorizedUsers[account], "User already authorized.");
        authorizedUsers[account] = true;
        emit UserWhitelisted(account);
    }
    
    /**
     * @notice Remove a user from the authorized users list
     * @param account Address to remove
     */
    function removeAuthorizedUser(address account) external onlyOwnerOrAdmin {
        require(authorizedUsers[account], "User not authorized.");
        authorizedUsers[account] = false;
        emit UserRemoved(account);
    }
    
    // ============================================
    // USER FUNCTIONS
    // ============================================
    
    /**
     * @notice Deposit ETH into the bank
     * @dev User must be authorized and bank must be active
     * Interest rate is captured at the time of deposit
     */
    function deposit() external payable onlyIfBankActive onlyAuthorizedUser {
        require(msg.value > 0, "Deposit amount must be greater than zero.");
        
        // Create new deposit record with current interest rate snapshot
        DepositHistory memory newDeposit = DepositHistory({
            amount: msg.value,
            depositTimestamp: block.timestamp,
            interestRateBPAtDeposit: interestRatePerMinuteBP,
            maturityPeriodMinutes: DEPOSIT_LOCK_MINUTES,
            withdrawn: false
        });
        
        deposits[msg.sender].push(newDeposit);
        uint256 depositIndex = deposits[msg.sender].length - 1;
        
        emit DepositMade(msg.sender, depositIndex, msg.value, interestRatePerMinuteBP, block.timestamp);
    }
    
    /**
     * @notice Withdraw a specific deposit with interest
     * @param depositIndex Index of the deposit to withdraw
     * @dev Calculates interest based on elapsed time and rate at deposit time
     */
    function withdrawDeposit(uint256 depositIndex) external onlyIfBankActive onlyAuthorizedUser {
        require(depositIndex < deposits[msg.sender].length, "Deposit does not exist.");
        
        DepositHistory storage userDeposit = deposits[msg.sender][depositIndex];
        require(!userDeposit.withdrawn, "Deposit already withdrawn.");
        
        // Check if deposit has matured using the stored maturity period
        uint256 maturityTime = userDeposit.depositTimestamp + (userDeposit.maturityPeriodMinutes * 60);
        require(block.timestamp >= maturityTime, "Your deposit has not reached maturity.");
        
        // Calculate elapsed time in whole minutes
        uint256 elapsedMinutes = (block.timestamp - userDeposit.depositTimestamp) / 60;
        
        // Calculate interest using the rate stored at deposit time
        uint256 interest = calculateInterest(
            userDeposit.amount, 
            userDeposit.interestRateBPAtDeposit, 
            elapsedMinutes
        );
        
        // Check reserves are sufficient to cover interest
        require(totalReserves >= interest, "Insufficient reserves to cover interest.");
        
        uint256 principal = userDeposit.amount;
        uint256 totalPayout = principal + interest;
        
        // Check contract has sufficient balance
        require(address(this).balance >= totalPayout, "Insufficient contract balance.");
        
        // Effects: Mark as withdrawn and update reserves BEFORE transfer
        userDeposit.withdrawn = true;
        totalReserves -= interest;
        
        // Interaction: Transfer funds
        (bool success, ) = payable(msg.sender).call{value: totalPayout}("");
        require(success, "Transfer failed.");
        
        emit WithdrawalMade(msg.sender, depositIndex, principal, interest, block.timestamp);
    }
    
    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /**
     * @notice Get the total ETH balance held by the contract
     * @return Contract's ETH balance in wei
     */
    function getEthBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @notice Get the total reserves available for interest payments
     * @return Total reserves in wei
     */
    function getReserves() external view returns (uint256) {
        return totalReserves;
    }
    
    /**
     * @notice Get the number of deposits for a user
     * @param user Address of the user
     * @return Number of deposits
     */
    function getUserDepositsCount(address user) external view returns (uint256) {
        return deposits[user].length;
    }
    
    /**
     * @notice Get details of a specific deposit
     * @param user Address of the user
     * @param depositIndex Index of the deposit
     * @return amount Principal amount
     * @return depositTimestamp When deposit was made
     * @return interestRateBPAtDeposit Interest rate captured at deposit
     * @return maturityPeriodMinutes Lock period in minutes
     * @return withdrawn Whether deposit has been withdrawn
     */
    function getDeposit(address user, uint256 depositIndex) 
        external 
        view 
        returns (
            uint256 amount,
            uint256 depositTimestamp,
            uint256 interestRateBPAtDeposit,
            uint256 maturityPeriodMinutes,
            bool withdrawn
        ) 
    {
        require(depositIndex < deposits[user].length, "Deposit does not exist.");
        DepositHistory memory userDeposit = deposits[user][depositIndex];
        return (
            userDeposit.amount,
            userDeposit.depositTimestamp,
            userDeposit.interestRateBPAtDeposit,
            userDeposit.maturityPeriodMinutes,
            userDeposit.withdrawn
        );
    }
    
    /**
     * @notice Preview the interest that would be earned if withdrawn now
     * @param user Address of the user
     * @param depositIndex Index of the deposit
     * @return Estimated interest in wei
     */
    function previewInterest(address user, uint256 depositIndex) external view returns (uint256) {
        require(depositIndex < deposits[user].length, "Deposit does not exist.");
        
        DepositHistory memory userDeposit = deposits[user][depositIndex];
        require(!userDeposit.withdrawn, "Deposit already withdrawn.");
        
        uint256 elapsedMinutes = (block.timestamp - userDeposit.depositTimestamp) / 60;
        return calculateInterest(
            userDeposit.amount,
            userDeposit.interestRateBPAtDeposit,
            elapsedMinutes
        );
    }
    
    // ============================================
    // INTERNAL HELPER FUNCTIONS
    // ============================================
    
    /**
     * @notice Calculate interest for a deposit
     * @param principal The principal amount
     * @param rateBP Interest rate in basis points (100 BP = 1%)
     * @param minutesElapsed Number of minutes since deposit
     * @return interest The calculated interest amount
     * @dev Interest = (principal * rateBP / 10000) * minutesElapsed
     * Uses integer math, rounds down. Order optimized to reduce overflow risk.
     */
    function calculateInterest(
        uint256 principal,
        uint256 rateBP,
        uint256 minutesElapsed
    ) internal pure returns (uint256) {
        // Calculate interest per minute: principal * rateBP / 10000
        // Then multiply by elapsed minutes
        // Order reduces overflow risk and is simple for students to understand
        uint256 interestPerMinute = (principal * rateBP) / 10000;
        uint256 interest = interestPerMinute * minutesElapsed;
        return interest;
    }
    
    // ============================================
    // PREVENT ACCIDENTAL ETH TRANSFERS
    // ============================================
    
    /**
     * @notice Reject direct ETH transfers
     * @dev Users must use deposit() or owner must use addReserves()
     */
    receive() external payable {
        revert("Please use deposit() or addReserves() functions.");
    }
    
    /**
     * @notice Reject calls to non-existent functions
     */
    fallback() external payable {
        revert("Function does not exist. Please use deposit() or addReserves().");
    }
}
