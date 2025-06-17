import { Transaction } from '@mysten/sui/transactions';
import { CLAIM_POOL_CONSTANTS } from '../src/constants/contract';

// Script to add ikachan NFT collection to the eligible list
// Run this as admin to allow ikachan NFT holders to claim

const IKACHAN_TYPE = '0x0081dfde5fd50f02357ed690459086a6e6890683a921ee19f136ec1a95f30068::ikachan::Nft';

export function createAddIkachanTx() {
  const tx = new Transaction();
  
  // Convert the type string to bytes
  const typeBytes = Array.from(new TextEncoder().encode(IKACHAN_TYPE));
  
  tx.moveCall({
    target: `${CLAIM_POOL_CONSTANTS.PACKAGE_ID}::${CLAIM_POOL_CONSTANTS.NFT_GATED_MODULE}::add_eligible_collection`,
    arguments: [
      tx.object(CLAIM_POOL_CONSTANTS.NFT_GATED_CLAIM_POOL_ID),
      tx.pure.vector('u8', typeBytes),
    ],
  });
  
  return tx;
}

console.log('Add ikachan collection transaction created');
console.log('Type to add:', IKACHAN_TYPE);
console.log('Type bytes:', Array.from(new TextEncoder().encode(IKACHAN_TYPE)));