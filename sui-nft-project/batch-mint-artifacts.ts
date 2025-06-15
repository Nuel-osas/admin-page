import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Constants from deployment
const PACKAGE_ID = '0xfe1b4b8aa749be78e4adff15432b22b0f0efd8c9ab74b002fe1bbcf2e5d80b02';
const ADMIN_CAP_ID = '0x8c652cf1b08ba07c82b47cf5f5f16ca2b03fb48f29bc1a97c89f056bc1096e21';
const GLOBAL_STATS_ID = '0x9f7f49bb47bf6f016d891e5aefc79bd36f4734f813dbbbb824a88fdb21559b13';

// Minting configuration
const TOTAL_SUPPLY = 13600;
const BATCH_SIZE = 100; // Contract limit
const TOTAL_BATCHES = Math.ceil(TOTAL_SUPPLY / BATCH_SIZE);

interface MintProgress {
  totalMinted: number;
  batchesCompleted: number;
  failedBatches: number[];
  txDigests: string[];
}

async function mintBatch(
  client: SuiClient,
  keypair: Ed25519Keypair,
  amount: number,
  progress: MintProgress
): Promise<string> {
  const tx = new Transaction();
  
  // Call batch mint function
  tx.moveCall({
    target: `${PACKAGE_ID}::sudoz_artifacts_v2::batch_mint`,
    arguments: [
      tx.object(ADMIN_CAP_ID),
      tx.object(GLOBAL_STATS_ID),
      tx.pure.u64(amount),
    ],
  });

  // Set gas budget
  tx.setGasBudget(1000000000); // 1 SUI for gas

  try {
    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    return result.digest;
  } catch (error) {
    console.error(`Failed to mint batch: ${error}`);
    throw error;
  }
}

async function main() {
  // Initialize Sui client
  const rpcUrl = process.env.SUI_RPC_URL || getFullnodeUrl('testnet');
  const client = new SuiClient({ url: rpcUrl });

  // Setup keypair from environment variable
  const privateKey = process.env.ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('ADMIN_PRIVATE_KEY not found in environment variables');
  }

  const keypair = Ed25519Keypair.fromSecretKey(
    Buffer.from(privateKey, 'hex')
  );
  const address = keypair.getPublicKey().toSuiAddress();

  console.log('=== SUDOZ ARTIFACTS Batch Minting Script ===');
  console.log(`Admin Address: ${address}`);
  console.log(`Total Supply Target: ${TOTAL_SUPPLY.toLocaleString()}`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log(`Total Batches: ${TOTAL_BATCHES}`);
  console.log('');

  // Check current supply
  try {
    const stats = await client.getObject({
      id: GLOBAL_STATS_ID,
      options: { showContent: true },
    });
    
    if (stats.data?.content?.dataType === 'moveObject') {
      const fields = stats.data.content.fields as any;
      const currentSupply = parseInt(fields.total_minted || '0');
      console.log(`Current Supply: ${currentSupply.toLocaleString()}`);
      
      if (currentSupply >= TOTAL_SUPPLY) {
        console.log('Target supply already reached!');
        return;
      }
      
      console.log(`Remaining to mint: ${(TOTAL_SUPPLY - currentSupply).toLocaleString()}`);
    }
  } catch (error) {
    console.error('Failed to fetch current supply:', error);
  }

  // Check balance
  const balance = await client.getBalance({
    owner: address,
    coinType: '0x2::sui::SUI',
  });
  console.log(`\nWallet Balance: ${(parseInt(balance.totalBalance) / 1e9).toFixed(4)} SUI`);

  // Confirm before proceeding
  console.log('\nPress Enter to start minting or Ctrl+C to cancel...');
  await new Promise(resolve => process.stdin.once('data', resolve));

  // Initialize progress tracking
  const progress: MintProgress = {
    totalMinted: 0,
    batchesCompleted: 0,
    failedBatches: [],
    txDigests: [],
  };

  // Start minting
  console.log('\nStarting batch minting process...\n');
  const startTime = Date.now();

  for (let batch = 0; batch < TOTAL_BATCHES; batch++) {
    const remaining = TOTAL_SUPPLY - progress.totalMinted;
    const mintAmount = Math.min(BATCH_SIZE, remaining);

    if (mintAmount <= 0) break;

    try {
      console.log(`Batch ${batch + 1}/${TOTAL_BATCHES}: Minting ${mintAmount} NFTs...`);
      
      const digest = await mintBatch(client, keypair, mintAmount, progress);
      
      progress.totalMinted += mintAmount;
      progress.batchesCompleted++;
      progress.txDigests.push(digest);

      console.log(`✓ Success! TX: ${digest}`);
      console.log(`  Total Minted: ${progress.totalMinted.toLocaleString()}/${TOTAL_SUPPLY.toLocaleString()}`);
      console.log('');

      // Add delay between batches to avoid rate limits
      if (batch < TOTAL_BATCHES - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }

    } catch (error) {
      console.error(`✗ Batch ${batch + 1} failed:`, error);
      progress.failedBatches.push(batch + 1);
      
      // Retry once after a longer delay
      console.log('Retrying in 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      try {
        const digest = await mintBatch(client, keypair, mintAmount, progress);
        progress.totalMinted += mintAmount;
        progress.batchesCompleted++;
        progress.txDigests.push(digest);
        console.log(`✓ Retry successful! TX: ${digest}`);
        
        // Remove from failed batches
        progress.failedBatches = progress.failedBatches.filter(b => b !== batch + 1);
      } catch (retryError) {
        console.error('✗ Retry failed. Continuing to next batch...');
      }
      console.log('');
    }
  }

  // Final report
  const duration = (Date.now() - startTime) / 1000;
  console.log('\n=== Minting Complete ===');
  console.log(`Total Minted: ${progress.totalMinted.toLocaleString()}`);
  console.log(`Batches Completed: ${progress.batchesCompleted}/${TOTAL_BATCHES}`);
  console.log(`Failed Batches: ${progress.failedBatches.length > 0 ? progress.failedBatches.join(', ') : 'None'}`);
  console.log(`Duration: ${duration.toFixed(1)} seconds`);
  console.log(`\nTransaction Digests saved to: mint-results.json`);

  // Save results
  const results = {
    timestamp: new Date().toISOString(),
    totalMinted: progress.totalMinted,
    batchesCompleted: progress.batchesCompleted,
    failedBatches: progress.failedBatches,
    duration: duration,
    transactions: progress.txDigests,
  };

  await require('fs').promises.writeFile(
    'mint-results.json',
    JSON.stringify(results, null, 2)
  );
}

// Run the script
main().catch(console.error);