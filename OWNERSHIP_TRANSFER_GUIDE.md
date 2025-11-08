# Ownership Transfer Feature - Technical Specification

## Overview
This document describes the **Ownership Transfer** functionality added to the UniBank smart contract, allowing the contract owner to sell ownership for a price.

## Implementation Details

### State Variables Added
```solidity
address public potentialNewOwner;  // Address that can purchase ownership
uint256 public ownershipPrice;     // Price to purchase ownership (0 = not for sale)
```

### Events Added
```solidity
event OwnershipOffered(address indexed potentialNewOwner, uint256 price);
event OwnershipOfferCancelled();
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner, uint256 price);
```

### Functions Added

#### 1. `offerOwnership(address newOwner, uint256 price)` - Owner Only
Allows the current owner to offer ownership for sale.

**Parameters:**
- `newOwner`: Address that will be allowed to purchase ownership
- `price`: Price in wei that must be paid

**Functionality:**
- Sets the potential new owner and price
- Emits `OwnershipOffered` event
- Can be called multiple times to update the offer
- Pass `address(0)` and `0` to cancel the offer

**Validations:**
- Only current owner can call
- Cannot offer to current owner
- Invalid address rejected (unless cancelling)
- Zero price rejected (unless cancelling)

#### 2. `purchaseOwnership()` - Payable, Potential Owner Only
Allows the designated potential owner to purchase ownership.

**Functionality:**
- Transfers ownership to caller
- Sends payment to previous owner
- Clears the ownership offer
- Emits `OwnershipTransferred` event

**Validations:**
- Only the designated potential owner can call
- Must send exact payment amount
- Ownership must be offered (price > 0)

#### 3. `getOwnershipOffer()` - View Function
Returns current ownership offer details.

**Returns:**
- `isForSale` (bool): Whether ownership is currently for sale
- `offeredTo` (address): Address that can purchase
- `price` (uint256): Purchase price in wei

## Testing in Remix VM (Prague)

### Prerequisites
1. Open Remix IDE: https://remix.ethereum.org/
2. Create file `UniBank.sol` with the contract code
3. Set compiler to **0.8.26**
4. Select environment: **Remix VM (Prague)**
5. Deploy the contract

### Test Account Setup
For testing, you'll need at least 3 accounts:
- **Account 0**: Original owner (deployer)
- **Account 1**: Potential buyer
- **Account 2**: Optional third party

### Test Scenario 1: Basic Ownership Transfer

**Step 1:** As Account 0 (Owner), offer ownership
```
Function: offerOwnership
Parameters:
  - newOwner: [Paste Account 1 address]
  - price: 10000000000000000000 (10 ETH)
```
✅ Check: `OwnershipOffered` event emitted

**Step 2:** Check offer details (any account)
```
Function: getOwnershipOffer
Returns:
  - isForSale: true
  - offeredTo: [Account 1 address]
  - price: 10000000000000000000
```

**Step 3:** Switch to Account 1, purchase ownership
```
Function: purchaseOwnership
Value: 10 ETH (10000000000000000000 wei)
```
✅ Check: `OwnershipTransferred` event emitted
✅ Check: Account 0 balance increased by 10 ETH
✅ Check: `owner()` now returns Account 1 address

**Step 4:** Verify new owner powers
```
Function: setBankStatus
Parameters: true
```
✅ Check: Works successfully, Account 1 is now owner

### Test Scenario 2: Offer Cancellation

**Step 1:** As owner, create offer
```
Function: offerOwnership
Parameters:
  - newOwner: [Account 1 address]
  - price: 5000000000000000000 (5 ETH)
```

**Step 2:** Cancel the offer
```
Function: offerOwnership
Parameters:
  - newOwner: 0x0000000000000000000000000000000000000000
  - price: 0
```
✅ Check: `OwnershipOfferCancelled` event emitted

**Step 3:** Verify offer cleared
```
Function: getOwnershipOffer
Returns:
  - isForSale: false
  - offeredTo: 0x0000000000000000000000000000000000000000
  - price: 0
```

### Test Scenario 3: Access Control

**Test 3.1:** Non-owner cannot offer ownership
```
Switch to Account 1 (non-owner)
Function: offerOwnership
Parameters:
  - newOwner: [Account 2 address]
  - price: 1000000000000000000
```
❌ Expected: Transaction reverts with "Only owner can execute this."

**Test 3.2:** Wrong person cannot purchase
```
As owner (Account 0), create offer to Account 1 for 5 ETH
Switch to Account 2 (not the designated buyer)
Function: purchaseOwnership
Value: 5 ETH
```
❌ Expected: Transaction reverts with "Only the offered address can purchase ownership."

**Test 3.3:** Incorrect payment rejected
```
As owner (Account 0), create offer to Account 1 for 10 ETH
Switch to Account 1
Function: purchaseOwnership
Value: 5 ETH (wrong amount)
```
❌ Expected: Transaction reverts with "Incorrect payment amount."

## Sample Transaction Flow

### Complete Lifecycle Example

```
1. Deploy contract (Account 0 becomes owner)
   owner() → Account 0

2. Set up bank (Account 0)
   setBankStatus(true)
   setInterestRatePerMinuteBP(100)
   addReserves() with 50 ETH

3. Offer ownership (Account 0)
   offerOwnership(Account 1, 12 ETH)
   
4. Check offer
   getOwnershipOffer() → (true, Account 1, 12 ETH)

5. Purchase ownership (Account 1)
   purchaseOwnership() with 12 ETH
   
6. Verify transfer
   owner() → Account 1
   Account 0 balance increased by 12 ETH

7. New owner operates bank (Account 1)
   addAuthorizedUser(Account 2)
   Account 2 can now deposit

8. New owner can re-sell (Account 1)
   offerOwnership(Account 0, 20 ETH)
   
9. Original owner buys back (Account 0)
   purchaseOwnership() with 20 ETH
   owner() → Account 0 again
```

## Security Considerations

✅ **Reentrancy Protection**: Uses CEI pattern - ownership transferred before payment
✅ **Exact Payment**: Requires exact amount, prevents overpayment exploitation
✅ **Access Control**: Only designated buyer can purchase
✅ **Owner Flexibility**: Owner can update or cancel offer anytime
✅ **Event Transparency**: All actions emit events for auditability
✅ **Zero Address Check**: Prevents invalid ownership transfers
✅ **Self-Transfer Prevention**: Cannot offer to current owner

## Technical Requirements Compliance

✅ **1. Remix VM (Prague)**: Contract compiled with Solidity 0.8.26, fully compatible
✅ **2. English Comments**: All functions documented with `@notice`, `@param`, `@dev` tags
✅ **3. README.md**: Updated with feature description, testing steps, and account roles
✅ **4. Compilation**: Contract compiles successfully with zero errors (51 tests passing)
✅ **5. Sample Transactions**: Three complete scenarios provided above

## Files Modified

- `contracts/UniBank.sol`: Added ownership transfer functionality
- `test/UniBank.test.js`: Added 12 comprehensive tests (all passing)
- `README.md`: Added documentation and Remix testing guide
- `OWNERSHIP_TRANSFER_GUIDE.md`: This technical specification document

## Testing Summary

Total Tests: **51** (all passing)
New Tests Added: **12**
Test Categories:
- Offer ownership for sale
- Purchase ownership
- New owner permissions
- Access control (non-owner, wrong buyer)
- Payment validation
- Offer cancellation
- Offer updates
- Complete lifecycle

Compilation: ✅ Success, zero errors
Test Execution Time: ~2 seconds
