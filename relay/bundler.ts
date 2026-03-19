import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

// ✅ Direct relay mode — bypasses bundler entirely
// Uses HTTP provider with staticNetwork to avoid IPv6 issues
const provider = new ethers.JsonRpcProvider(
    process.env.INEVM_RPC_URL!,
    {
        chainId: parseInt(process.env.INEVM_CHAIN_ID || "1439"),
        name: "injective-testnet"
    },
    { staticNetwork: true }
);

const relaySigner = new ethers.Wallet(
    process.env.RELAY_SIGNER_EVM_PRIVATE_KEY!,
    provider
);

const vaultAbi = [
    "function executeTrade(address user, bytes32 pair, uint256 qty, uint8 side) external",
];

export async function sendUserOperation(userOp: any): Promise<string> {
    console.log("UserOp received:", JSON.stringify(userOp, null, 2));

    const vaultAddress = process.env.VAULT_CONTRACT;
    if (!vaultAddress) throw new Error("VAULT_CONTRACT not set in .env");

    // Handle both shapes frontend might send
    const user = userOp.sender || userOp.user || relaySigner.address;
    const pair = userOp.pair || userOp.tradePair || "INJ/USDT";
    const qty = userOp.qty || userOp.amount || "1";
    const side = userOp.side ?? 0;

    console.log(`Trade: ${side === 0 ? "BUY" : "SELL"} ${qty} ${pair} for ${user}`);

    const pairBytes32 = ethers.keccak256(ethers.toUtf8Bytes(pair));
    const vault = new ethers.Contract(vaultAddress, vaultAbi, relaySigner);

    const feeData = await provider.getFeeData();
    const overrides = {
        maxFeePerGas: feeData.maxFeePerGas ?? ethers.parseUnits("1", "gwei"),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? ethers.parseUnits("1", "gwei"),
        gasLimit: 300000,
    };

    const tx = await vault.executeTrade(
        user,
        pairBytes32,
        ethers.parseUnits(String(qty), 18),
        side,
        overrides
    );

    console.log("Tx sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Confirmed:", receipt!.hash);

    return receipt!.hash;
}

export async function getUserOperationReceipt(hash: string) {
    try {
        const receipt = await provider.getTransactionReceipt(hash);
        if (!receipt) return null;
        return {
            receipt: {
                transactionHash: receipt.hash,
                status: receipt.status
            }
        };
    } catch {
        return null;
    }
}