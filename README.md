# UniBank Smart Contract

A simple educational banking smart contract for learning about deposits, withdrawals, interest rates, role-based access control, and reserve management.

## Key Concepts

### Interest Rate System
- Interest rates are set **per minute** in **basis points** (100 BP = 1%)
- Each deposit captures a **snapshot** of the current interest rate
- Changing the interest rate only affects **NEW** deposits
- Example: 100 BP = 1% per minute

### Reserve Management
- The owner must add reserves to cover interest payments
- Reserves are tracked separately from user deposits
- Withdrawals will fail if reserves are insufficient

### Role-Based Access Control
- **Owner**: Can do everything (set by deployer)
- **Administrator**: Can manage users and change interest rates
- **Authorized User**: Can deposit and withdraw (must be whitelisted)

### Deposit Lock Period
- All deposits have a **2-minute maturity period**
- Users cannot withdraw before maturity

## Testing Guide for Remix VM (Prague)

### Step 1: Deploy the Contract

1. Open [Remix IDE](https://remix.ethereum.org/)
2. Create a new file `UniBank.sol` and paste the contract code
3. Set compiler to **0.8.26**
4. Select environment: **Remix VM (Prague)**
5. Deploy the contract
6. Note the deployed contract address

### Step 2: Initial Setup (As Owner)

The deployer account is automatically the owner.

#### 2.1 Activate the Bank
```solidity
setBankStatus(true)
```

#### 2.2 Set Initial Interest Rate
Set to 100 BP (1% per minute):
```solidity
setInterestRatePerMinuteBP(100)
```

#### 2.3 Add Reserves
Add sufficient ETH to cover interest payments:
```solidity
addReserves() // Send 10 ETH
```
Check reserves:
```solidity
getReserves() // Should return 10000000000000000000 (10 ETH in wei)
```

#### 2.4 Create an Administrator
Switch to a different account in Remix, copy its address, then switch back to owner:
```solidity
addAdmin(0x...) // Paste admin address
```
Verify:
```solidity
admins(0x...) // Should return true
```

#### 2.5 Whitelist Users
Add the owner and admin as authorized users:
```solidity
addAuthorizedUser(0x...) // Owner address
addAuthorizedUser(0x...) // Admin address
addAuthorizedUser(0x...) // Another test user
```

### Step 3: Test Deposits (As Authorized User)

Switch to an authorized user account:

#### 3.1 Make First Deposit
```solidity
deposit() // Send 1 ETH
```
Check event `DepositMade` - note the `depositIndex` (should be 0) and `rateBP` (should be 100)

#### 3.2 View Deposit Details
```solidity
getUserDepositsCount(0x...) // Your address, should return 1
getDeposit(0x..., 0) // Your address and depositIndex 0
```

### Step 4: Test Admin Functions

Switch to the admin account:

#### 4.1 Change Interest Rate
```solidity
setInterestRatePerMinuteBP(200) // Change to 2% per minute
```
Check event `InterestRateChanged` - old rate should be 100, new rate 200

#### 4.2 Whitelist a New User
```solidity
addAuthorizedUser(0x...) // New user address
```

#### 4.3 Remove a User
```solidity
removeAuthorizedUser(0x...) // Some user address
```

### Step 5: Test Multiple Deposits with Different Rates

Switch to an authorized user:

#### 5.1 Make Second Deposit (at new rate)
```solidity
deposit() // Send 1 ETH
```
This deposit should capture the NEW rate (200 BP = 2% per minute)

Verify:
```solidity
getDeposit(0x..., 1) // depositIndex 1, should show interestRateBPAtDeposit = 200
```

### Step 6: Test Interest Calculation Preview

While waiting for maturity, preview the interest:
```solidity
previewInterest(0x..., 0) // Your address, depositIndex 0
previewInterest(0x..., 1) // Your address, depositIndex 1
```

The second deposit should accrue interest at double the rate of the first!

### Step 7: Wait for Maturity

**IMPORTANT**: In Remix VM, you need to wait 2 minutes OR manipulate time.

To test immediately, you can:
1. Wait 2 minutes in real time
2. Use Remix's time manipulation (if available)
3. For educational purposes, temporarily change `DEPOSIT_LOCK_MINUTES` to `0` in the contract

### Step 8: Test Withdrawals

After 2 minutes have passed:

#### 8.1 Withdraw First Deposit (at old rate)
```solidity
withdrawDeposit(0) // depositIndex 0
```
Check event `WithdrawalMade`:
- `principal` should be your deposit amount
- `interest` should be calculated at 1% per minute
- You receive `principal + interest`

Verify reserves decreased:
```solidity
getReserves() // Should be less than before
```

#### 8.2 Withdraw Second Deposit (at new rate)
```solidity
withdrawDeposit(1) // depositIndex 1
```
The interest should be approximately **double** the first deposit (2% vs 1% per minute)

### Step 9: Test Insufficient Reserves Scenario

To test the reserve protection:

1. Make a large deposit (e.g., 50 ETH)
2. Wait for some time to accrue significant interest
3. Try to withdraw when reserves are insufficient

Expected: Transaction should revert with "Insufficient reserves to cover interest."

### Step 10: Test Admin Rights Revocation

Switch to owner account:

#### 10.1 Revoke Admin Rights
```solidity
revokeAdmin(0x...) // Admin address
```

#### 10.2 Verify Admin Can No Longer Perform Actions

Switch to the former admin account and try:
```solidity
setInterestRatePerMinuteBP(300) // Should fail
addAuthorizedUser(0x...) // Should fail
```

Both should revert with "Only owner or admin can execute this."

### Step 11: Test Access Control

#### 11.1 Test Unauthorized User Deposit
Switch to an account that was NOT whitelisted:
```solidity
deposit() // Should fail with "User is not authorized."
```

#### 11.2 Test Bank Deactivation
Switch to owner:
```solidity
setBankStatus(false)
```

Now try to deposit as an authorized user:
```solidity
deposit() // Should fail with "Bank is not active."
```

## Interest Calculation Example

### Example 1: 1 ETH at 1% per minute for 5 minutes

- Principal: 1 ETH = 1,000,000,000,000,000,000 wei
- Rate: 100 BP = 1%
- Time: 5 minutes
- Interest per minute: 1 ETH × 100 / 10,000 = 0.01 ETH
- Total interest: 0.01 ETH × 5 = 0.05 ETH
- **Total payout: 1.05 ETH**

### Example 2: 1 ETH at 2% per minute for 5 minutes

- Principal: 1 ETH
- Rate: 200 BP = 2%
- Time: 5 minutes
- Interest per minute: 1 ETH × 200 / 10,000 = 0.02 ETH
- Total interest: 0.02 ETH × 5 = 0.1 ETH
- **Total payout: 1.1 ETH**

## Function Reference

### Owner Functions
- `setBankStatus(bool)` - Activate or deactivate the bank
- `addReserves()` - Add ETH reserves to cover interest (payable)
- `addAdmin(address)` - Grant admin rights
- `revokeAdmin(address)` - Revoke admin rights

### Owner or Admin Functions
- `setInterestRatePerMinuteBP(uint256)` - Set interest rate for NEW deposits
- `addAuthorizedUser(address)` - Whitelist a user
- `removeAuthorizedUser(address)` - Remove a user from whitelist

### User Functions
- `deposit()` - Deposit ETH (payable, must be authorized)
- `withdrawDeposit(uint256)` - Withdraw specific deposit with interest

### View Functions
- `getEthBalance()` - Get contract's total ETH balance
- `getReserves()` - Get total reserves for interest
- `getUserDepositsCount(address)` - Get number of deposits for a user
- `getDeposit(address, uint256)` - Get deposit details
- `previewInterest(address, uint256)` - Preview current interest for a deposit

## Security Features

1. **Checks-Effects-Interactions Pattern**: Prevents reentrancy attacks
2. **Separate Reserve Accounting**: Reserves tracked separately from deposits
3. **Role-Based Access Control**: Three-tier permission system
4. **Deposit Maturity Lock**: Prevents premature withdrawals
5. **Interest Rate Snapshot**: Each deposit locks in its rate
6. **Overflow Protection**: Solidity 0.8+ built-in checks
7. **No Direct Transfers**: `receive()` and `fallback()` reject accidental ETH

## Common Issues

### "User is not authorized"
- The user must be whitelisted using `addAuthorizedUser()`

### "Bank is not active"
- Owner must call `setBankStatus(true)`

### "Your deposit has not reached maturity"
- Wait at least 2 minutes after depositing

### "Insufficient reserves to cover interest"
- Owner needs to add more reserves using `addReserves()`

### "Deposit does not exist"
- Check the deposit index using `getUserDepositsCount()`

## Notes for Students

- Interest is calculated using **integer math**, which rounds down
- Time is measured in **whole minutes** (partial minutes don't count)
- The interest rate is in **basis points**: 100 BP = 1%, 10 BP = 0.1%
- Each user can have **multiple active deposits**
- Each deposit remembers its own interest rate
- The contract uses **wei** (1 ETH = 10^18 wei)

## License

MIT License - Educational purposes
