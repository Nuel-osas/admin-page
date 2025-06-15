# Batch Minting Script for SUDOZ ARTIFACTS

This script mints all 13,600 SUDOZ ARTIFACT NFTs in batches of 100.

## Prerequisites

1. Node.js and npm installed
2. Admin private key for the deployed contract
3. Sufficient SUI balance for gas fees (~136 SUI recommended)

## Setup

1. Install dependencies:
```bash
npm install @mysten/sui dotenv
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Edit `.env` and add your admin private key (hex format, no 0x prefix)

## Usage

Run the script:
```bash
npx tsx batch-mint-artifacts.ts
```

## Features

- **Batch Processing**: Mints in batches of 100 NFTs (contract limit)
- **Progress Tracking**: Shows real-time progress and estimated completion
- **Error Handling**: Automatic retry on failed batches
- **Transaction Logging**: Saves all transaction digests to `mint-results.json`
- **Safety Checks**: Verifies current supply before minting
- **Rate Limiting**: 1-second delay between batches to avoid network limits

## Expected Output

```
=== SUDOZ ARTIFACTS Batch Minting Script ===
Admin Address: 0x...
Total Supply Target: 13,600
Batch Size: 100
Total Batches: 136

Current Supply: 0
Remaining to mint: 13,600

Wallet Balance: 150.0000 SUI

Press Enter to start minting or Ctrl+C to cancel...

Starting batch minting process...

Batch 1/136: Minting 100 NFTs...
✓ Success! TX: 0x...
  Total Minted: 100/13,600

[... continues for all batches ...]

=== Minting Complete ===
Total Minted: 13,600
Batches Completed: 136/136
Failed Batches: None
Duration: 272.5 seconds

Transaction Digests saved to: mint-results.json
```

## Gas Costs

- Each batch transaction uses approximately 0.5-1 SUI in gas
- Total estimated gas cost: ~136 SUI for complete minting
- Recommended balance: 150+ SUI to ensure completion

## Troubleshooting

1. **"ADMIN_PRIVATE_KEY not found"**: Make sure `.env` file exists with your private key
2. **"Insufficient gas"**: Increase wallet SUI balance
3. **"Transaction failed"**: Check that you're using the correct admin address
4. **Rate limit errors**: Script includes automatic delays, but increase if needed

## Important Notes

- This script is for testnet deployment
- For mainnet, update the RPC URL in `.env`
- Keep your private key secure and never commit it to version control
- The script creates `mint-results.json` with all transaction details for record keeping