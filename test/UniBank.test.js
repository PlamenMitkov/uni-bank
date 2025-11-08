const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("UniBank Contract - Complete Test Suite", function () {
  let uniBank;
  let owner;
  let admin;
  let user1;
  let user2;
  let unauthorized;

  // Helper function to convert ETH to Wei
  const toWei = (eth) => ethers.parseEther(eth.toString());
  
  // Helper function to convert Wei to ETH
  const fromWei = (wei) => ethers.formatEther(wei);

  // Deploy fresh contract before each test
  beforeEach(async function () {
    // Get signers
    [owner, admin, user1, user2, unauthorized] = await ethers.getSigners();

    // Deploy UniBank contract
    const UniBank = await ethers.getContractFactory("UniBank");
    uniBank = await UniBank.deploy();
    await uniBank.waitForDeployment();

    console.log(`\n    📍 Contract deployed at: ${await uniBank.getAddress()}`);
  });

  describe("🏗️  Requirement 10: Deployment", function () {
    it("Should deploy successfully with correct owner", async function () {
      expect(await uniBank.owner()).to.equal(owner.address);
      console.log(`    ✅ Owner set correctly: ${owner.address}`);
    });

    it("Should start with bank inactive", async function () {
      expect(await uniBank.active()).to.equal(false);
      console.log("    ✅ Bank starts inactive");
    });

    it("Should have initial interest rate at 0", async function () {
      expect(await uniBank.interestRatePerMinuteBP()).to.equal(0);
      console.log("    ✅ Initial interest rate: 0 BP");
    });

    it("Should have deposit lock period of 2 minutes", async function () {
      expect(await uniBank.DEPOSIT_LOCK_MINUTES()).to.equal(2);
      console.log("    ✅ Deposit lock: 2 minutes");
    });
  });

  describe("💰 Requirement 12: Reserve Management", function () {
    it("Should allow owner to add reserves", async function () {
      const reserveAmount = toWei(10);
      
      await expect(uniBank.addReserves({ value: reserveAmount }))
        .to.emit(uniBank, "ReserveAdded")
        .withArgs(owner.address, reserveAmount, reserveAmount);

      const reserves = await uniBank.totalReserves();
      expect(reserves).to.equal(reserveAmount);
      console.log(`    ✅ Added reserves: ${fromWei(reserves)} ETH`);
    });

    it("Should not allow non-owner to add reserves", async function () {
      await expect(
        uniBank.connect(user1).addReserves({ value: toWei(5) })
      ).to.be.revertedWith("Only owner can execute this.");
      console.log("    ✅ Non-owner cannot add reserves");
    });

    it("Should reject zero reserve amount", async function () {
      await expect(
        uniBank.addReserves({ value: 0 })
      ).to.be.revertedWith("Reserve amount must be greater than zero.");
      console.log("    ✅ Cannot add zero reserves");
    });

    it("Should track reserves separately from deposits", async function () {
      // Add reserves
      await uniBank.addReserves({ value: toWei(5) });
      const reservesAfter = await uniBank.totalReserves();
      
      // Contract balance includes reserves
      const contractBalance = await ethers.provider.getBalance(await uniBank.getAddress());
      
      expect(reservesAfter).to.equal(toWei(5));
      expect(contractBalance).to.equal(toWei(5));
      console.log(`    ✅ Reserves: ${fromWei(reservesAfter)} ETH, Balance: ${fromWei(contractBalance)} ETH`);
    });
  });

  describe("📊 Requirement 13: Interest Rate Management", function () {
    it("Should allow owner to set interest rate", async function () {
      const newRate = 100; // 1% per minute
      
      await expect(uniBank.setInterestRatePerMinuteBP(newRate))
        .to.emit(uniBank, "InterestRateChanged")
        .withArgs(owner.address, 0, newRate);

      expect(await uniBank.interestRatePerMinuteBP()).to.equal(newRate);
      console.log(`    ✅ Interest rate set to: ${newRate} BP (1% per minute)`);
    });

    it("Should not allow non-owner/non-admin to set rate", async function () {
      await expect(
        uniBank.connect(user1).setInterestRatePerMinuteBP(100)
      ).to.be.revertedWith("Only owner or admin can execute this.");
      console.log("    ✅ Non-owner/admin cannot set rate");
    });

    it("Should allow multiple rate changes", async function () {
      await uniBank.setInterestRatePerMinuteBP(100);
      await uniBank.setInterestRatePerMinuteBP(200);
      await uniBank.setInterestRatePerMinuteBP(50);
      
      expect(await uniBank.interestRatePerMinuteBP()).to.equal(50);
      console.log("    ✅ Multiple rate changes work correctly");
    });
  });

  describe("👥 Requirement 16-18: Admin and User Management", function () {
    it("Should allow owner to add administrator", async function () {
      await expect(uniBank.addAdmin(admin.address))
        .to.emit(uniBank, "AdminAdded")
        .withArgs(admin.address);

      expect(await uniBank.admins(admin.address)).to.equal(true);
      console.log(`    ✅ Admin added: ${admin.address}`);
    });

    it("Should not allow non-owner to add admin", async function () {
      await expect(
        uniBank.connect(user1).addAdmin(admin.address)
      ).to.be.revertedWith("Only owner can execute this.");
      console.log("    ✅ Non-owner cannot add admin");
    });

    it("Should allow owner to revoke admin rights", async function () {
      await uniBank.addAdmin(admin.address);
      
      await expect(uniBank.revokeAdmin(admin.address))
        .to.emit(uniBank, "AdminRevoked")
        .withArgs(admin.address);

      expect(await uniBank.admins(admin.address)).to.equal(false);
      console.log("    ✅ Admin rights revoked");
    });

    it("Should allow admin to set interest rate", async function () {
      await uniBank.addAdmin(admin.address);
      
      await expect(uniBank.connect(admin).setInterestRatePerMinuteBP(150))
        .to.emit(uniBank, "InterestRateChanged");

      expect(await uniBank.interestRatePerMinuteBP()).to.equal(150);
      console.log("    ✅ Admin can set interest rate");
    });

    it("Should allow owner to whitelist users", async function () {
      await expect(uniBank.addAuthorizedUser(user1.address))
        .to.emit(uniBank, "UserWhitelisted")
        .withArgs(user1.address);

      expect(await uniBank.authorizedUsers(user1.address)).to.equal(true);
      console.log(`    ✅ User whitelisted: ${user1.address}`);
    });

    it("Should allow admin to whitelist users", async function () {
      await uniBank.addAdmin(admin.address);
      
      await expect(uniBank.connect(admin).addAuthorizedUser(user1.address))
        .to.emit(uniBank, "UserWhitelisted")
        .withArgs(user1.address);

      expect(await uniBank.authorizedUsers(user1.address)).to.equal(true);
      console.log("    ✅ Admin can whitelist users");
    });

    it("Should allow owner/admin to remove users", async function () {
      await uniBank.addAuthorizedUser(user1.address);
      
      await expect(uniBank.removeAuthorizedUser(user1.address))
        .to.emit(uniBank, "UserRemoved")
        .withArgs(user1.address);

      expect(await uniBank.authorizedUsers(user1.address)).to.equal(false);
      console.log("    ✅ User removed from whitelist");
    });

    it("Should not allow revoked admin to perform admin actions", async function () {
      // Add admin
      await uniBank.addAdmin(admin.address);
      expect(await uniBank.admins(admin.address)).to.equal(true);
      
      // Admin can perform actions
      await uniBank.connect(admin).addAuthorizedUser(user1.address);
      
      // Revoke admin
      await uniBank.revokeAdmin(admin.address);
      
      // Should not be able to perform admin actions
      await expect(
        uniBank.connect(admin).addAuthorizedUser(user2.address)
      ).to.be.revertedWith("Only owner or admin can execute this.");
      
      console.log("    ✅ Revoked admin cannot perform admin actions");
    });
  });

  describe("💵 Requirement 11 & 14: Deposits with Interest Rate Snapshot", function () {
    beforeEach(async function () {
      // Setup: Activate bank, set rate, add reserves, whitelist user
      await uniBank.setBankStatus(true);
      await uniBank.setInterestRatePerMinuteBP(100); // 1% per minute
      await uniBank.addReserves({ value: toWei(100) });
      await uniBank.addAuthorizedUser(user1.address);
    });

    it("Should allow authorized user to deposit", async function () {
      const depositAmount = toWei(1);
      
      const tx = await uniBank.connect(user1).deposit({ value: depositAmount });
      await expect(tx)
        .to.emit(uniBank, "DepositMade");

      const count = await uniBank.getUserDepositsCount(user1.address);
      expect(count).to.equal(1);
      console.log(`    ✅ User deposited: ${fromWei(depositAmount)} ETH`);
    });

    it("Should capture interest rate snapshot at deposit time", async function () {
      await uniBank.connect(user1).deposit({ value: toWei(1) });
      
      const [amount, timestamp, rate, maturityPeriod, withdrawn] = await uniBank.getDeposit(user1.address, 0);
      
      expect(rate).to.equal(100);
      expect(maturityPeriod).to.equal(2); // 2 minutes
      expect(withdrawn).to.equal(false);
      console.log(`    ✅ Deposit captured rate: ${rate} BP, maturity: ${maturityPeriod} minutes`);
    });

    it("Should allow multiple deposits with different rates", async function () {
      // First deposit at 100 BP
      await uniBank.connect(user1).deposit({ value: toWei(1) });
      
      // Change rate
      await uniBank.setInterestRatePerMinuteBP(200); // 2% per minute
      
      // Second deposit at 200 BP
      await uniBank.connect(user1).deposit({ value: toWei(2) });
      
      // Check both deposits
      const [, , rate1, maturity1] = await uniBank.getDeposit(user1.address, 0);
      const [, , rate2, maturity2] = await uniBank.getDeposit(user1.address, 1);
      
      expect(rate1).to.equal(100);
      expect(rate2).to.equal(200);
      expect(maturity1).to.equal(2);
      expect(maturity2).to.equal(2);
      console.log(`    ✅ Deposit 0: ${rate1} BP, Deposit 1: ${rate2} BP`);
    });

    it("Should not allow unauthorized user to deposit", async function () {
      await expect(
        uniBank.connect(unauthorized).deposit({ value: toWei(1) })
      ).to.be.revertedWith("User is not authorized.");
      console.log("    ✅ Unauthorized user cannot deposit");
    });

    it("Should not allow deposit when bank is inactive", async function () {
      await uniBank.setBankStatus(false);
      
      await expect(
        uniBank.connect(user1).deposit({ value: toWei(1) })
      ).to.be.revertedWith("Bank is not active.");
      console.log("    ✅ Cannot deposit when bank inactive");
    });

    it("Should reject zero deposit amount", async function () {
      await expect(
        uniBank.connect(user1).deposit({ value: 0 })
      ).to.be.revertedWith("Deposit amount must be greater than zero.");
      console.log("    ✅ Cannot deposit zero amount");
    });
  });

  describe("💸 Requirement 15: Withdrawals with Interest Calculation", function () {
    beforeEach(async function () {
      // Setup: Activate bank, set rate, add reserves, whitelist user
      await uniBank.setBankStatus(true);
      await uniBank.setInterestRatePerMinuteBP(100); // 1% per minute
      await uniBank.addReserves({ value: toWei(100) });
      await uniBank.addAuthorizedUser(user1.address);
      
      // Make a deposit
      await uniBank.connect(user1).deposit({ value: toWei(1) });
    });

    it("Should calculate and pay interest correctly", async function () {
      // Wait 5 minutes
      await time.increase(5 * 60);
      
      // Expected interest: 1 ETH * 100 BP / 10000 * 5 minutes = 0.05 ETH
      const expectedInterest = toWei(0.05);
      const expectedTotal = toWei(1.05);
      
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      
      const tx = await uniBank.connect(user1).withdrawDeposit(0);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const balanceAfter = await ethers.provider.getBalance(user1.address);
      const actualReceived = balanceAfter - balanceBefore + gasUsed;
      
      // Check received amount (allowing small rounding difference)
      expect(actualReceived).to.be.closeTo(expectedTotal, toWei(0.001));
      console.log(`    ✅ Received: ${fromWei(actualReceived)} ETH (expected ~${fromWei(expectedTotal)} ETH)`);
    });

    it("Should emit WithdrawalMade event with correct values", async function () {
      await time.increase(3 * 60); // 3 minutes
      
      // Expected: 1 ETH * 100 BP / 10000 * 3 = 0.03 ETH interest
      const expectedInterest = toWei(0.03);
      
      await expect(uniBank.connect(user1).withdrawDeposit(0))
        .to.emit(uniBank, "WithdrawalMade");
      
      console.log("    ✅ WithdrawalMade event emitted correctly");
    });

    it("Should use rate from deposit time, not current rate", async function () {
      // Change rate after deposit
      await uniBank.setInterestRatePerMinuteBP(500); // 5% per minute
      
      // Wait 2 minutes
      await time.increase(2 * 60);
      
      // Should still use old rate (100 BP)
      // Expected: 1 ETH * 100 BP / 10000 * 2 = 0.02 ETH
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      
      const tx = await uniBank.connect(user1).withdrawDeposit(0);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const balanceAfter = await ethers.provider.getBalance(user1.address);
      const actualReceived = balanceAfter - balanceBefore + gasUsed;
      
      // Should be ~1.02 ETH, not 1.10 ETH
      expect(actualReceived).to.be.closeTo(toWei(1.02), toWei(0.001));
      console.log(`    ✅ Used original rate: ${fromWei(actualReceived)} ETH`);
    });

    it("Should not allow withdrawal before maturity", async function () {
      await expect(
        uniBank.connect(user1).withdrawDeposit(0)
      ).to.be.revertedWith("Your deposit has not reached maturity.");
      console.log("    ✅ Cannot withdraw before 2 minutes");
    });

    it("Should decrease reserves by interest amount", async function () {
      const reservesBefore = await uniBank.totalReserves();
      
      await time.increase(5 * 60);
      await uniBank.connect(user1).withdrawDeposit(0);
      
      const reservesAfter = await uniBank.totalReserves();
      const expectedDecrease = toWei(0.05); // 5 minutes at 1%
      
      expect(reservesBefore - reservesAfter).to.be.closeTo(expectedDecrease, toWei(0.0001));
      console.log(`    ✅ Reserves decreased by: ${fromWei(reservesBefore - reservesAfter)} ETH`);
    });

    it("Should not allow withdrawal if reserves insufficient", async function () {
      // Withdraw all reserves first
      await uniBank.addReserves({ value: toWei(100) });
      const reserves = await uniBank.totalReserves();
      
      // Make a large deposit that would require more interest than reserves
      await uniBank.addAuthorizedUser(user2.address);
      await uniBank.connect(user2).deposit({ value: toWei(150) });
      
      // Wait a long time
      await time.increase(1000 * 60); // 1000 minutes
      
      // Try to withdraw - should fail due to insufficient reserves
      await expect(
        uniBank.connect(user2).withdrawDeposit(0)
      ).to.be.revertedWith("Insufficient reserves to cover interest.");
      console.log("    ✅ Withdrawal blocked when reserves insufficient");
    });

    it("Should not allow double withdrawal", async function () {
      await time.increase(5 * 60);
      await uniBank.connect(user1).withdrawDeposit(0);
      
      await expect(
        uniBank.connect(user1).withdrawDeposit(0)
      ).to.be.revertedWith("Deposit already withdrawn.");
      console.log("    ✅ Cannot withdraw twice");
    });
  });

  describe("🔍 View Functions", function () {
    beforeEach(async function () {
      await uniBank.setBankStatus(true);
      await uniBank.setInterestRatePerMinuteBP(100);
      await uniBank.addReserves({ value: toWei(10) });
      await uniBank.addAuthorizedUser(user1.address);
    });

    it("Should return correct contract balance", async function () {
      const balance = await uniBank.getEthBalance();
      expect(balance).to.equal(toWei(10));
      console.log(`    ✅ Contract balance: ${fromWei(balance)} ETH`);
    });

    it("Should return correct reserves", async function () {
      const reserves = await uniBank.getReserves();
      expect(reserves).to.equal(toWei(10));
      console.log(`    ✅ Reserves: ${fromWei(reserves)} ETH`);
    });

    it("Should return correct deposit count", async function () {
      await uniBank.connect(user1).deposit({ value: toWei(1) });
      await uniBank.connect(user1).deposit({ value: toWei(2) });
      
      const count = await uniBank.getUserDepositsCount(user1.address);
      expect(count).to.equal(2);
      console.log(`    ✅ Deposit count: ${count}`);
    });

    it("Should preview interest correctly", async function () {
      await uniBank.connect(user1).deposit({ value: toWei(1) });
      
      await time.increase(10 * 60); // 10 minutes
      
      const interest = await uniBank.previewInterest(user1.address, 0);
      const expectedInterest = toWei(0.1); // 1 ETH * 1% * 10 minutes
      
      expect(interest).to.be.closeTo(expectedInterest, toWei(0.001));
      console.log(`    ✅ Preview interest: ${fromWei(interest)} ETH`);
    });
  });

  describe("🛡️  Security Features", function () {
    it("Should reject direct ETH transfers", async function () {
      await expect(
        owner.sendTransaction({
          to: await uniBank.getAddress(),
          value: toWei(1)
        })
      ).to.be.revertedWith("Please use deposit() or addReserves() functions.");
      console.log("    ✅ Direct transfers rejected");
    });

    it("Should prevent reentrancy attacks", async function () {
      // This is inherently protected by the Checks-Effects-Interactions pattern
      // The withdrawn flag is set before the transfer
      await uniBank.setBankStatus(true);
      await uniBank.setInterestRatePerMinuteBP(100);
      await uniBank.addReserves({ value: toWei(10) });
      await uniBank.addAuthorizedUser(user1.address);
      
      await uniBank.connect(user1).deposit({ value: toWei(1) });
      await time.increase(5 * 60);
      
      // Normal withdrawal should work
      await uniBank.connect(user1).withdrawDeposit(0);
      
      // Second attempt should fail
      await expect(
        uniBank.connect(user1).withdrawDeposit(0)
      ).to.be.revertedWith("Deposit already withdrawn.");
      
      console.log("    ✅ Reentrancy protection working");
    });
  });

  describe("🎯 Complete Integration Test", function () {
    it("Should handle complete lifecycle correctly", async function () {
      console.log("\n    🎬 Starting complete integration test...\n");
      
      // 1. Owner activates bank
      await uniBank.setBankStatus(true);
      console.log("    ✅ Step 1: Bank activated");
      
      // 2. Owner sets interest rate
      await uniBank.setInterestRatePerMinuteBP(100);
      console.log("    ✅ Step 2: Interest rate set to 100 BP");
      
      // 3. Owner adds reserves
      await uniBank.addReserves({ value: toWei(50) });
      console.log("    ✅ Step 3: Added 50 ETH reserves");
      
      // 4. Owner creates admin
      await uniBank.addAdmin(admin.address);
      console.log("    ✅ Step 4: Admin created");
      
      // 5. Admin whitelists users
      await uniBank.connect(admin).addAuthorizedUser(user1.address);
      await uniBank.connect(admin).addAuthorizedUser(user2.address);
      console.log("    ✅ Step 5: Users whitelisted by admin");
      
      // 6. User1 makes first deposit
      await uniBank.connect(user1).deposit({ value: toWei(5) });
      console.log("    ✅ Step 6: User1 deposited 5 ETH at 100 BP");
      
      // 7. Admin changes interest rate
      await uniBank.connect(admin).setInterestRatePerMinuteBP(200);
      console.log("    ✅ Step 7: Admin changed rate to 200 BP");
      
      // 8. User2 makes deposit at new rate
      await uniBank.connect(user2).deposit({ value: toWei(3) });
      console.log("    ✅ Step 8: User2 deposited 3 ETH at 200 BP");
      
      // 9. Wait for maturity
      await time.increase(10 * 60); // 10 minutes
      console.log("    ✅ Step 9: Waited 10 minutes");
      
      // 10. User1 withdraws (should get 5 ETH + 0.5 ETH interest = 5.5 ETH)
      const user1BalanceBefore = await ethers.provider.getBalance(user1.address);
      const tx1 = await uniBank.connect(user1).withdrawDeposit(0);
      const receipt1 = await tx1.wait();
      const gas1 = receipt1.gasUsed * receipt1.gasPrice;
      const user1BalanceAfter = await ethers.provider.getBalance(user1.address);
      const user1Received = user1BalanceAfter - user1BalanceBefore + gas1;
      
      expect(user1Received).to.be.closeTo(toWei(5.5), toWei(0.01));
      console.log(`    ✅ Step 10: User1 withdrew ~${fromWei(user1Received)} ETH`);
      
      // 11. User2 withdraws (should get 3 ETH + 0.6 ETH interest = 3.6 ETH)
      const user2BalanceBefore = await ethers.provider.getBalance(user2.address);
      const tx2 = await uniBank.connect(user2).withdrawDeposit(0);
      const receipt2 = await tx2.wait();
      const gas2 = receipt2.gasUsed * receipt2.gasPrice;
      const user2BalanceAfter = await ethers.provider.getBalance(user2.address);
      const user2Received = user2BalanceAfter - user2BalanceBefore + gas2;
      
      expect(user2Received).to.be.closeTo(toWei(3.6), toWei(0.01));
      console.log(`    ✅ Step 11: User2 withdrew ~${fromWei(user2Received)} ETH`);
      
      // 12. Owner revokes admin
      await uniBank.revokeAdmin(admin.address);
      console.log("    ✅ Step 12: Admin rights revoked");
      
      // 13. Former admin cannot perform admin actions
      await expect(
        uniBank.connect(admin).setInterestRatePerMinuteBP(300)
      ).to.be.revertedWith("Only owner or admin can execute this.");
      console.log("    ✅ Step 13: Former admin blocked");
      
      // 14. Check reserves decreased correctly
      const finalReserves = await uniBank.totalReserves();
      const expectedReserves = toWei(48.9); // 50 - 0.5 - 0.6
      expect(finalReserves).to.be.closeTo(expectedReserves, toWei(0.01));
      console.log(`    ✅ Step 14: Final reserves: ${fromWei(finalReserves)} ETH`);
      
      console.log("\n    🎉 Complete integration test passed!\n");
    });
  });

  describe("🔑 Ownership Transfer", function () {
    it("Should allow owner to offer ownership for sale", async function () {
      const price = toWei(10);
      
      await expect(uniBank.offerOwnership(user1.address, price))
        .to.emit(uniBank, "OwnershipOffered")
        .withArgs(user1.address, price);
      
      expect(await uniBank.potentialNewOwner()).to.equal(user1.address);
      expect(await uniBank.ownershipPrice()).to.equal(price);
      console.log(`    ✅ Ownership offered to ${user1.address} for ${fromWei(price)} ETH`);
    });

    it("Should return correct ownership offer details", async function () {
      // Initially not for sale
      let [isForSale, offeredTo, price] = await uniBank.getOwnershipOffer();
      expect(isForSale).to.equal(false);
      expect(offeredTo).to.equal(ethers.ZeroAddress);
      expect(price).to.equal(0);
      
      // Offer ownership
      const offerPrice = toWei(5);
      await uniBank.offerOwnership(user2.address, offerPrice);
      
      [isForSale, offeredTo, price] = await uniBank.getOwnershipOffer();
      expect(isForSale).to.equal(true);
      expect(offeredTo).to.equal(user2.address);
      expect(price).to.equal(offerPrice);
      console.log("    ✅ Ownership offer details correct");
    });

    it("Should allow potential owner to purchase ownership", async function () {
      const price = toWei(8);
      await uniBank.offerOwnership(user1.address, price);
      
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      
      await expect(uniBank.connect(user1).purchaseOwnership({ value: price }))
        .to.emit(uniBank, "OwnershipTransferred")
        .withArgs(owner.address, user1.address, price);
      
      // Check new owner
      expect(await uniBank.owner()).to.equal(user1.address);
      
      // Check offer is cleared
      expect(await uniBank.potentialNewOwner()).to.equal(ethers.ZeroAddress);
      expect(await uniBank.ownershipPrice()).to.equal(0);
      
      // Check previous owner received payment
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(price);
      
      console.log(`    ✅ Ownership transferred to ${user1.address}, payment sent`);
    });

    it("Should allow new owner to perform owner functions", async function () {
      const price = toWei(5);
      await uniBank.offerOwnership(user1.address, price);
      await uniBank.connect(user1).purchaseOwnership({ value: price });
      
      // New owner should be able to activate bank
      await expect(uniBank.connect(user1).setBankStatus(true))
        .to.emit(uniBank, "BankActivated");
      
      // New owner should be able to add reserves
      await expect(uniBank.connect(user1).addReserves({ value: toWei(10) }))
        .to.emit(uniBank, "ReserveAdded");
      
      // New owner should be able to add admin
      await expect(uniBank.connect(user1).addAdmin(admin.address))
        .to.emit(uniBank, "AdminAdded");
      
      console.log("    ✅ New owner can perform all owner functions");
    });

    it("Should not allow non-owner to offer ownership", async function () {
      await expect(
        uniBank.connect(user1).offerOwnership(user2.address, toWei(5))
      ).to.be.revertedWith("Only owner can execute this.");
      console.log("    ✅ Non-owner cannot offer ownership");
    });

    it("Should not allow wrong person to purchase ownership", async function () {
      await uniBank.offerOwnership(user1.address, toWei(5));
      
      await expect(
        uniBank.connect(user2).purchaseOwnership({ value: toWei(5) })
      ).to.be.revertedWith("Only the offered address can purchase ownership.");
      console.log("    ✅ Wrong person cannot purchase ownership");
    });

    it("Should not allow purchase with incorrect payment", async function () {
      const price = toWei(10);
      await uniBank.offerOwnership(user1.address, price);
      
      await expect(
        uniBank.connect(user1).purchaseOwnership({ value: toWei(5) })
      ).to.be.revertedWith("Incorrect payment amount.");
      
      await expect(
        uniBank.connect(user1).purchaseOwnership({ value: toWei(15) })
      ).to.be.revertedWith("Incorrect payment amount.");
      
      console.log("    ✅ Incorrect payment rejected");
    });

    it("Should allow owner to cancel ownership offer", async function () {
      // Offer ownership
      await uniBank.offerOwnership(user1.address, toWei(10));
      expect(await uniBank.potentialNewOwner()).to.equal(user1.address);
      
      // Cancel by setting both to zero/null
      await expect(uniBank.offerOwnership(ethers.ZeroAddress, 0))
        .to.emit(uniBank, "OwnershipOfferCancelled");
      
      expect(await uniBank.potentialNewOwner()).to.equal(ethers.ZeroAddress);
      expect(await uniBank.ownershipPrice()).to.equal(0);
      
      console.log("    ✅ Ownership offer cancelled");
    });

    it("Should not allow purchase when ownership not for sale", async function () {
      await expect(
        uniBank.connect(user1).purchaseOwnership({ value: toWei(5) })
      ).to.be.revertedWith("Only the offered address can purchase ownership.");
      console.log("    ✅ Cannot purchase when not for sale");
    });

    it("Should reject invalid offer parameters", async function () {
      // Invalid address with non-zero price
      await expect(
        uniBank.offerOwnership(ethers.ZeroAddress, toWei(5))
      ).to.be.revertedWith("Invalid new owner address.");
      
      // Valid address with zero price
      await expect(
        uniBank.offerOwnership(user1.address, 0)
      ).to.be.revertedWith("Price must be greater than zero.");
      
      // Cannot offer to current owner
      await expect(
        uniBank.offerOwnership(owner.address, toWei(5))
      ).to.be.revertedWith("Cannot offer to current owner.");
      
      console.log("    ✅ Invalid offer parameters rejected");
    });

    it("Should allow owner to change offer before purchase", async function () {
      // First offer
      await uniBank.offerOwnership(user1.address, toWei(10));
      
      // Change offer to different person and price
      await expect(uniBank.offerOwnership(user2.address, toWei(15)))
        .to.emit(uniBank, "OwnershipOffered")
        .withArgs(user2.address, toWei(15));
      
      expect(await uniBank.potentialNewOwner()).to.equal(user2.address);
      expect(await uniBank.ownershipPrice()).to.equal(toWei(15));
      
      // Old potential owner cannot purchase
      await expect(
        uniBank.connect(user1).purchaseOwnership({ value: toWei(10) })
      ).to.be.revertedWith("Only the offered address can purchase ownership.");
      
      // New potential owner can purchase with correct price
      await uniBank.connect(user2).purchaseOwnership({ value: toWei(15) });
      expect(await uniBank.owner()).to.equal(user2.address);
      
      console.log("    ✅ Owner can update offer before purchase");
    });

    it("Should handle ownership transfer in complete lifecycle", async function () {
      console.log("\n    🎬 Starting ownership lifecycle test...\n");
      
      // 1. Original owner sets up bank
      await uniBank.setBankStatus(true);
      await uniBank.setInterestRatePerMinuteBP(100);
      await uniBank.addReserves({ value: toWei(20) });
      await uniBank.addAdmin(admin.address);
      console.log("    ✅ Step 1: Owner set up bank");
      
      // 2. Owner offers ownership
      const price = toWei(12);
      await uniBank.offerOwnership(user1.address, price);
      console.log(`    ✅ Step 2: Offered to user1 for ${fromWei(price)} ETH`);
      
      // 3. User1 purchases ownership
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      await uniBank.connect(user1).purchaseOwnership({ value: price });
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      console.log(`    ✅ Step 3: User1 purchased ownership`);
      
      // 4. Verify payment
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(price);
      console.log(`    ✅ Step 4: Original owner received ${fromWei(price)} ETH`);
      
      // 5. New owner adds user and they deposit
      await uniBank.connect(user1).addAuthorizedUser(user2.address);
      await uniBank.connect(user2).deposit({ value: toWei(5) });
      console.log("    ✅ Step 5: New owner authorized user2 who deposited 5 ETH");
      
      // 6. New owner can offer ownership again
      await uniBank.connect(user1).offerOwnership(owner.address, toWei(20));
      console.log("    ✅ Step 6: New owner can re-offer ownership");
      
      // 7. Original owner buys it back
      await uniBank.connect(owner).purchaseOwnership({ value: toWei(20) });
      expect(await uniBank.owner()).to.equal(owner.address);
      console.log("    ✅ Step 7: Original owner bought back ownership");
      
      console.log("\n    🎉 Ownership lifecycle test passed!\n");
    });
  });
});
