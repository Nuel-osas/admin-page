'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { CLAIM_POOL_CONSTANTS, CONTRACT_CONSTANTS } from '@/constants/contract';
import { ClaimPoolInfo, ClaimStatus } from '@/types/claim';
import { Gift, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ClaimPoolSection() {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction, isPending } = useSignAndExecuteTransaction();
  const [poolInfo, setPoolInfo] = useState<ClaimPoolInfo | null>(null);
  const [claimStatus, setClaimStatus] = useState<ClaimStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  // Fetch pool info
  const { data: poolData, refetch: refetchPool } = useSuiClientQuery('getObject', {
    id: CLAIM_POOL_CONSTANTS.NFT_GATED_CLAIM_POOL_ID,
    options: {
      showContent: true,
    },
  });

  // Check if user has claimed (simplified - we'll check this during the actual claim attempt)
  const checkClaimStatus = async () => {
    if (!currentAccount) return;
    
    try {
      // For now, we'll set default values and let the contract handle validation during claim
      // In a production app, you'd implement proper view function calls using a read-only transaction
      setClaimStatus({
        hasClaimed: false, // We'll detect this during claim attempt
        canClaim: true, // We'll let the contract validate this
      });
    } catch (error) {
      console.error('Error checking claim status:', error);
    }
  };

  // Parse pool info from chain data
  useEffect(() => {
    if (poolData?.data?.content?.dataType === 'moveObject') {
      const fields = (poolData.data.content as any).fields;
      setPoolInfo({
        remainingNfts: fields.nft_ids?.length || 0,
        totalClaimed: parseInt(fields.total_claimed || '0'),
        claimingEnabled: fields.claiming_enabled || false,
        admin: fields.admin || '',
      });
    }
    setLoading(false);
  }, [poolData]);

  // Check claim status when account changes
  useEffect(() => {
    if (currentAccount) {
      checkClaimStatus();
    }
  }, [currentAccount]);

  const handleClaim = async () => {
    if (!currentAccount) {
      alert('Please connect your wallet to claim NFTs');
      return;
    }

    setClaiming(true);
    
    try {
      const tx = new Transaction();
      
      // For NFT-gated claim, we need to pass an eligible NFT
      // This is a simplified version - in production, you'd fetch user's eligible NFTs
      tx.moveCall({
        target: `${CLAIM_POOL_CONSTANTS.PACKAGE_ID}::${CLAIM_POOL_CONSTANTS.NFT_GATED_MODULE}::claim_with_nft`,
        typeArguments: [CONTRACT_CONSTANTS.TYPES.SUDOZ_ARTIFACT, CLAIM_POOL_CONSTANTS.ELIGIBLE_COLLECTIONS.PRIME_MACHIN.TYPE],
        arguments: [
          tx.object(CLAIM_POOL_CONSTANTS.NFT_GATED_CLAIM_POOL_ID),
          tx.object('USER_NFT_ID'), // Replace with actual user's eligible NFT
          tx.pure.vector('u8', CLAIM_POOL_CONSTANTS.ELIGIBLE_COLLECTIONS.PRIME_MACHIN.TYPE_BYTES),
        ],
      });

      await signAndExecuteTransaction(
        {
          transaction: tx,
        },
        {
          onSuccess: () => {
            alert('NFT Claimed! You have successfully claimed your NFT from the pool.');
            refetchPool();
            checkClaimStatus();
          },
          onError: (error) => {
            alert(`Claim Failed: ${error.message || 'Failed to claim NFT'}`);
          },
        }
      );
    } catch (error) {
      console.error('Error claiming NFT:', error);
      alert('Error: An unexpected error occurred');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Gift className="h-5 w-5" />
              NFT Claim Pool
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Claim free NFTs if you hold eligible collections
            </p>
          </div>
          {poolInfo?.claimingEnabled ? (
            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Active
            </span>
          ) : (
            <span className="bg-gray-400 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center">
              <AlertCircle className="mr-1 h-3 w-3" />
              Paused
            </span>
          )}
        </div>
      </div>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-black">Available NFTs</p>
            <p className="text-2xl font-bold text-black">{poolInfo?.remainingNfts || 0}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-black">Total Claimed</p>
            <p className="text-2xl font-bold text-black">{poolInfo?.totalClaimed || 0}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-black">Eligible Collections:</p>
          <div className="flex flex-wrap gap-2">
            <span className="border border-gray-300 text-gray-700 text-xs px-2 py-1 rounded-full">
              Prime Machin
            </span>
            <span className="border border-gray-300 text-gray-700 text-xs px-2 py-1 rounded-full">
              Rootlet
            </span>
          </div>
        </div>

        {!currentAccount ? (
          <p className="text-sm text-black text-center py-4">
            Connect your wallet to check eligibility
          </p>
        ) : claimStatus?.hasClaimed ? (
          <div className="flex items-center justify-center gap-2 py-4 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium text-black">You have already claimed</span>
          </div>
        ) : (
          <button
            onClick={handleClaim}
            disabled={
              !poolInfo?.claimingEnabled ||
              poolInfo?.remainingNfts === 0 ||
              claiming ||
              isPending
            }
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {claiming || isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                Claiming...
              </>
            ) : poolInfo?.remainingNfts === 0 ? (
              'Pool Empty'
            ) : !poolInfo?.claimingEnabled ? (
              'Claiming Paused'
            ) : (
              'Claim NFT'
            )}
          </button>
        )}
      </div>
    </div>
  );
}