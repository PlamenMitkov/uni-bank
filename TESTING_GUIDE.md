# UniBank Testing Guide

This guide explains how to run the comprehensive automated test suite for the UniBank smart contract.

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

## Setup

The testing environment is already configured! All dependencies have been installed.

## Project Structure

```
uni-bank/
├── contracts/
│   └── UniBank.sol          # The smart contract
├── test/
│   └── UniBank.test.js      # Comprehensive test suite
├── hardhat.config.js        # Hardhat configuration
├── package.json             # NPM configuration
└── README.md                # General documentation
```

## Running Tests

### Run All Tests

```bash
npm test
```

This will run all 40+ test cases covering every requirement.

### Run Tests with Verbose Output

```bash
npm run test:verbose
```

### Compile Contract Only

```bash
npm run compile
```

### Clean Build Artifacts

```bash
npm run clean
```

## Test Coverage

The test suite includes **9 major test categories** covering all requirements:

### 1. 🏗️ Requirement 10: Deployment (4 tests)
- ✅ Deploy successfully with correct owner
- ✅ Start with bank inactive
- ✅ Initial interest rate at 0
- ✅ Deposit lock period of 2 minutes

### 2. 💰 Requirement 12: Reserve Management (4 tests)
- ✅ Owner can add reserves
- ✅ Non-owner cannot add reserves
- ✅ Reject zero reserve amount
- ✅ Track reserves separately from deposits

### 3. 📊 Requirement 13: Interest Rate Management (3 tests)
- ✅ Owner can set interest rate
- ✅ Non-owner/non-admin cannot set rate
- ✅ Multiple rate changes work correctly

### 4. 👥 Requirements 16-18: Admin and User Management (8 tests)
- ✅ Owner can add administrator
- ✅ Non-owner cannot add admin
- ✅ Owner can revoke admin rights
- ✅ Admin can set interest rate
- ✅ Owner can whitelist users
- ✅ Admin can whitelist users
- ✅ Owner/admin can remove users
- ✅ Revoked admin cannot perform admin actions

### 5. 💵 Requirements 11 & 14: Deposits with Interest Rate Snapshot (6 tests)
- ✅ Authorized user can deposit
- ✅ Capture interest rate snapshot at deposit time
- ✅ Multiple deposits with different rates
- ✅ Unauthorized user cannot deposit
- ✅ Cannot deposit when bank inactive
- ✅ Reject zero deposit amount

### 6. 💸 Requirement 15: Withdrawals with Interest Calculation (7 tests)
- ✅ Calculate and pay interest correctly
- ✅ Emit WithdrawalMade event with correct values
- ✅ Use rate from deposit time, not current rate
- ✅ Cannot withdraw before maturity
- ✅ Reserves decrease by interest amount
- ✅ Block withdrawal if reserves insufficient
- ✅ Prevent double withdrawal

### 7. 🔍 View Functions (4 tests)
- ✅ Return correct contract balance
- ✅ Return correct reserves
- ✅ Return correct deposit count
- ✅ Preview interest correctly

### 8. 🛡️ Security Features (2 tests)
- ✅ Reject direct ETH transfers
- ✅ Prevent reentrancy attacks

### 9. 🎯 Complete Integration Test (1 comprehensive test)
- ✅ Full lifecycle: deploy → setup → deposits → rate changes → withdrawals → admin revocation

## Understanding Test Output

### Successful Test Run

```
  UniBank Contract - Complete Test Suite

    📍 Contract deployed at: 0x5FbDB2315678afecb367f032d93F642f64180aa3

    🏗️  Requirement 10: Deployment
      ✅ Owner set correctly: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
      ✓ Should deploy successfully with correct owner
      ✅ Bank starts inactive
      ✓ Should start with bank inactive
      ✅ Initial interest rate: 0 BP
      ✓ Should have initial interest rate at 0
      ✅ Deposit lock: 2 minutes
      ✓ Should have deposit lock period of 2 minutes

    💰 Requirement 12: Reserve Management
      ✅ Added reserves: 10.0 ETH
      ✓ Should allow owner to add reserves
      ...

  40 passing (5s)
```

### Test Failure Example

If a test fails, you'll see detailed error messages:

```
  1) UniBank Contract - Complete Test Suite
       Requirement 15: Withdrawals with Interest Calculation
         Should calculate and pay interest correctly:
     
     AssertionError: expected 1020000000000000000 to be close to 1050000000000000000 ± 1000000000000000
```

## Key Test Scenarios

### Interest Calculation Test

The test verifies:
- 1 ETH deposited at 100 BP (1% per minute)
- After 5 minutes: Expected interest = 0.05 ETH
- Total payout = 1.05 ETH

### Multi-Rate Deposit Test

1. User deposits at 100 BP (1%)
2. Admin changes rate to 200 BP (2%)
3. User makes second deposit
4. First deposit earns interest at 1%
5. Second deposit earns interest at 2%

### Admin Lifecycle Test

1. Owner creates admin
2. Admin performs actions (whitelist users, change rates)
3. Owner revokes admin rights
4. Former admin blocked from admin actions

### Reserve Protection Test

1. Large deposit made
2. Time passes (high interest accrual)
3. Withdrawal attempt when reserves < interest
4. Transaction reverts with clear error

## Gas Usage

The tests also report gas usage for each transaction, helping you understand the cost of operations.

## Troubleshooting

### "Module not found" errors

```bash
npm install
```

### "Invalid opcode" or compilation errors

Make sure you're using Solidity 0.8.26:
```bash
npm run clean
npm run compile
```

### Tests timing out

Some tests use `time.increase()` to simulate time passing. These should be fast, but if tests hang:
- Check your Node.js version (v18+ recommended)
- Try running individual test files

### Running a specific test

```bash
npx hardhat test --grep "Should calculate and pay interest correctly"
```

## Testing Best Practices

1. **Run tests before deployment**: Always run the full test suite before deploying
2. **Check all tests pass**: All 40+ tests should pass
3. **Review gas costs**: Check the gas usage is acceptable
4. **Test edge cases**: The suite covers edge cases, but add more if needed

## Adding New Tests

To add new tests, edit `test/UniBank.test.js`:

```javascript
it("Should do something new", async function () {
  // Arrange
  await uniBank.setBankStatus(true);
  await uniBank.addAuthorizedUser(user1.address);
  
  // Act
  await uniBank.connect(user1).deposit({ value: toWei(1) });
  
  // Assert
  const count = await uniBank.getUserDepositsCount(user1.address);
  expect(count).to.equal(1);
});
```

## Test Environment Details

- **Framework**: Hardhat
- **Assertion Library**: Chai
- **Network**: Hardhat local network (in-memory)
- **Solidity Version**: 0.8.26
- **Test Accounts**: 5 accounts with 10,000 ETH each

## Continuous Integration

To run tests in CI/CD pipelines:

```yaml
# Example for GitHub Actions
- name: Install dependencies
  run: npm install
  
- name: Run tests
  run: npm test
```

## Performance

The complete test suite runs in approximately **5-10 seconds** on a modern machine.

## Next Steps

After all tests pass:
1. ✅ Tests verify all requirements (10-18)
2. ✅ Review the test output for any warnings
3. ✅ Deploy to Remix VM (Prague) for manual testing
4. ✅ Use README.md for manual testing scenarios

## Support

If you encounter issues:
1. Check this guide
2. Review the test code in `test/UniBank.test.js`
3. Check Hardhat documentation: https://hardhat.org/

---

**Happy Testing! 🚀**
