#!/usr/bin/env tsx

// Script to set up royalty rules for the Evolved Sudoz collection
// Run with: npx tsx setup-royalty.ts

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';

// Configuration
const NETWORK = 'testnet';
const PACKAGE_ID = '0x8a6133d17482db4461e3eb799669265adededf69ba243f5934e8b01e339355d4';
const TRANSFER_POLICY_ID = '0x171e7985784e4947273b0d619070b2ef7d146361b46663251dc0e90d4663fead';
const TRANSFER_POLICY_CAP_ID = '0x67fa74ec1bc9733d383ebead0de8fea4560844c5b9746232f505251bbb9562bc';
const EVOLVED_STATS_ID = '0x66b0ce0a448b6cdea641f19317b9142e38438ff7a94730f260486cdd602a6775';

// Royalty configuration
const ROYALTY_BASIS_POINTS = 300; // 3% = 300 basis points
const MIN_AMOUNT = 1000000; // 0.001 SUI minimum royalty

async function setupRoyalty() {
    // Initialize Sui client
    const client = new SuiClient({ url: getFullnodeUrl(NETWORK) });
    
    // Get your keypair from environment or Sui config
    // For this example, we'll need to set up the keypair
    console.log('Setting up royalty for Evolved Sudoz collection...');
    console.log('Package ID:', PACKAGE_ID);
    console.log('Transfer Policy ID:', TRANSFER_POLICY_ID);
    console.log('Royalty:', ROYALTY_BASIS_POINTS / 100, '%');
    
    // Create transaction
    const tx = new Transaction();
    
    // Add the royalty rule
    // Using the kiosk royalty rule module
    tx.moveCall({
        target: '0x434b5bd8f6a7b05fede0ff46c6e511d71ea326ed38056e3bcd681d2d7c2a7879::royalty_rule::add',
        typeArguments: [`${PACKAGE_ID}::evolved_sudoz::EvolvedSudoz`],
        arguments: [
            tx.object(TRANSFER_POLICY_ID),
            tx.object(TRANSFER_POLICY_CAP_ID),
            tx.pure.u16(ROYALTY_BASIS_POINTS),
            tx.pure.u64(MIN_AMOUNT),
        ],
    });
    
    console.log('\nTransaction created. To execute:');
    console.log('1. Make sure you have the Transfer Policy Cap');
    console.log('2. Sign and submit this transaction with your wallet');
    console.log('\nAlternatively, use the Sui CLI:');
    console.log(`sui client call --package 0x434b5bd8f6a7b05fede0ff46c6e511d71ea326ed38056e3bcd681d2d7c2a7879 --module royalty_rule --function add --type-args ${PACKAGE_ID}::evolved_sudoz::EvolvedSudoz --args ${TRANSFER_POLICY_ID} ${TRANSFER_POLICY_CAP_ID} ${ROYALTY_BASIS_POINTS} ${MIN_AMOUNT} --gas-budget 10000000`);
}

setupRoyalty().catch(console.error);