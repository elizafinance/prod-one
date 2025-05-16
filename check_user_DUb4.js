// MongoDB Script to Diagnose User Profile Issue for DUb4SMkgJRs2cDCVZDzVG3o8YYCimPh3NVfBVhZLUuFJ

// --- Instructions ---
// 1. Connect to your MongoDB instance using the mongo shell or your preferred GUI.
// 2. Select your database: use your_database_name
// 3. Paste and run this script.

// --- Configuration ---
const targetWalletAddress = "DUb4SMkgJRs2cDCVZDzVG3o8YYCimPh3NVfBVhZLUuFJ";
// If you know the user's X (Twitter) ID or username, set it here. Otherwise, leave as null.
const targetXUserId = null; // e.g., "1234567890" (string)
const targetXUsername = null; // e.g., "twitteruser" (string, case-insensitive search will be attempted)

// --- Script ---
print(`🔍 Starting diagnosis for walletAddress: ${targetWalletAddress}`);

// 1. Check for user by the specific walletAddress
print("\n--- 1. Checking for user by exact walletAddress ---");
const userByWallet = db.users.findOne({ walletAddress: targetWalletAddress });

if (userByWallet) {
    print(`✅ Found user record by walletAddress: ${targetWalletAddress}`);
    printjson(userByWallet);
    if (userByWallet.xUserId) {
        print(`   Associated xUserId: ${userByWallet.xUserId}`);
    } else {
        print(`   This user record does NOT have an xUserId associated.`);
    }
} else {
    print(`❌ No user record found with walletAddress: ${targetWalletAddress}`);
    print(`   This is likely the primary reason for the "User profile not found" error when navigating to /profile/${targetWalletAddress}`);
}

// 2. Check for user by xUserId (if provided)
if (targetXUserId) {
    print(`\n--- 2. Checking for user by xUserId: ${targetXUserId} ---`);
    const userByXId = db.users.findOne({ xUserId: targetXUserId });
    if (userByXId) {
        print(`✅ Found user record by xUserId: ${targetXUserId}`);
        printjson(userByXId);
        print(`   WalletAddress in this record: ${userByXId.walletAddress || 'Not set'}`);
        if (userByXId.walletAddress !== targetWalletAddress) {
            print(`   ⚠️ WalletAddress in this X user record (${userByXId.walletAddress || 'Not set'}) does NOT match the targetWalletAddress (${targetWalletAddress}).`);
        }
    } else {
        print(`❌ No user record found with xUserId: ${targetXUserId}`);
    }
}

// 3. Check for user by xUsername (if provided)
if (targetXUsername) {
    print(`\n--- 3. Checking for user by xUsername (case-insensitive): ${targetXUsername} ---`);
    const userByXUsername = db.users.findOne({ xUsername: { $regex: new RegExp(`^${targetXUsername}$`, 'i') } });
    if (userByXUsername) {
        print(`✅ Found user record by xUsername: ${targetXUsername}`);
        printjson(userByXUsername);
        print(`   WalletAddress in this record: ${userByXUsername.walletAddress || 'Not set'}`);
        print(`   xUserId in this record: ${userByXUsername.xUserId || 'Not set'}`);
        if (userByXUsername.walletAddress !== targetWalletAddress) {
            print(`   ⚠️ WalletAddress in this X user record (${userByXUsername.walletAddress || 'Not set'}) does NOT match the targetWalletAddress (${targetWalletAddress}).`);
        }
    } else {
        print(`❌ No user record found with xUsername: ${targetXUsername}`);
    }
}

print("\n--- 4. Searching for records where walletAddress might be an X User ID or vice-versa ---");
const usersWithTargetAsXId = db.users.find({ xUserId: targetWalletAddress }).toArray();
if (usersWithTargetAsXId.length > 0) {
    print(`⚠️ Found ${usersWithTargetAsXId.length} user(s) where xUserId is mistakenly set to the wallet address ${targetWalletAddress}:`);
    usersWithTargetAsXId.forEach(u => printjson(u));
} else {
    print(`✅ No users found where xUserId is ${targetWalletAddress}.`);
}

if (targetXUserId) {
    const usersWithXIdAsWallet = db.users.find({ walletAddress: targetXUserId }).toArray();
    if (usersWithXIdAsWallet.length > 0) {
        print(`⚠️ Found ${usersWithXIdAsWallet.length} user(s) where walletAddress is mistakenly set to the xUserId ${targetXUserId}:`);
        usersWithXIdAsWallet.forEach(u => printjson(u));
    } else {
        print(`✅ No users found where walletAddress is ${targetXUserId}.`);
    }
}


print("\n--- 💡 Suggestions for Manual Fix ---");
print("Based on the findings, you might need to perform a manual update.");
print("SCENARIO 1: User logged in with X, and that record (found by xUserId/xUsername) has an INCORRECT or MISSING walletAddress.");
print(`  - Find the user record by their xUserId (e.g., userByXId from step 2 or userByXUsername from step 3).`);
print(`  - Update its walletAddress:`);
print(`    db.users.updateOne({ xUserId: "THE_CORRECT_XUSERID" }, { $set: { walletAddress: "${targetWalletAddress}", updatedAt: new Date() } });`);
print(`  - If the old walletAddress was the xUserId, you might want to ensure it's just the Solana address.`);

print("\nSCENARIO 2: Two separate records exist: one with the correct walletAddress but no X info, and one with X info but an incorrect/missing walletAddress.");
print(`  - This implies the linking failed. You'll need to merge them.`);
print(`  - Decide which record to keep (usually the one with more history or the correct _id).`);
print(`  - Copy relevant fields (xUserId, xUsername, xProfileImageUrl) from the X record to the Wallet record.`);
print(`  - Example: db.users.updateOne({ walletAddress: "${targetWalletAddress}" }, { $set: { xUserId: "THE_XUSERID_FROM_OTHER_RECORD", xUsername: "THE_XUSERNAME", xProfileImageUrl: "THE_XIMAGE_URL", updatedAt: new Date() } });`);
print(`  - Then, potentially delete the now-redundant X-only record (BE CAREFUL!).`);

print("\nSCENARIO 3: No record for the wallet, but an X record exists (found by xUserId/xUsername) that should be associated with this wallet.");
print(`  - This is similar to SCENARIO 1. Update the existing X record's walletAddress field.`);
print(`    db.users.updateOne({ xUserId: "THE_CORRECT_XUSERID" }, { $set: { walletAddress: "${targetWalletAddress}", updatedAt: new Date() } });`);


print("\n--- Example Update (USE WITH CAUTION after identifying the correct document to update) ---");
print(`// If you found a user document via xUserId (e.g., 'ACTUAL_X_USER_ID_OF_THE_USER') `);
print(`// that needs its walletAddress corrected to ${targetWalletAddress}:`);
print(`// db.users.updateOne(`);
print(`//   { xUserId: "ACTUAL_X_USER_ID_OF_THE_USER" },`);
print(`//   { $set: { walletAddress: "${targetWalletAddress}", updatedAt: new Date() } }`);
print(`// );`);

print(`\n// If a user document exists with walletAddress: "${targetWalletAddress}" but is missing X details,`);
print(`// and you found a separate X profile (e.g., with xUserId: "ACTUAL_X_USER_ID_OF_THE_USER"):`);
print(`// db.users.updateOne(`);
print(`//   { walletAddress: "${targetWalletAddress}" },`);
print(`//   { $set: { xUserId: "ACTUAL_X_USER_ID_OF_THE_USER", xUsername: "ACTUAL_X_USERNAME", xProfileImageUrl: "ACTUAL_X_PROFILE_IMAGE_URL", updatedAt: new Date() } }`);
print(`// );`);
print(`// And then, if the separate X profile is now redundant and ONLY contained X info:`);
print(`// db.users.deleteOne({ xUserId: "ACTUAL_X_USER_ID_OF_THE_USER", walletAddress: { $ne: "${targetWalletAddress}" } }); // EXTREME CAUTION`);


print("\n--- ✅ End of Diagnosis Script ---"); 