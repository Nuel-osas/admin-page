export interface ClaimPoolInfo {
  remainingNfts: number;
  totalClaimed: number;
  claimingEnabled: boolean;
  admin: string;
}

export interface NFTGatedClaimPoolInfo extends ClaimPoolInfo {
  requirePrimeMachin?: boolean;
  requireRootlet?: boolean;
  requireEither?: boolean;
}

export interface ClaimStatus {
  hasClaimed: boolean;
  canClaim: boolean;
  eligibleNfts?: string[]; // NFT types the user owns that are eligible
}

export interface EligibleCollection {
  type: string;
  typeBytes: number[];
  name: string;
}

export interface BatchDepositResult {
  success: boolean;
  count: number;
  transactionDigest?: string;
  error?: string;
}