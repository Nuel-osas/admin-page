'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { CLAIM_POOL_CONSTANTS, CONTRACT_CONSTANTS } from '@/constants/contract';
import { ClaimPoolInfo, ClaimStatus } from '@/types/claim';
import { Gift, Loader2, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

interface EligibleNFT {
  objectId: string;
  name: string;
  collection: string;
  kioskId: string;
  type: 'prime' | 'rootlet';
  isInKiosk: boolean;
}

export default function ClaimPoolSection() {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction, isPending } = useSignAndExecuteTransaction();
  const client = useSuiClient();
  const [poolInfo, setPoolInfo] = useState<ClaimPoolInfo | null>(null);
  const [claimStatus, setClaimStatus] = useState<ClaimStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [eligibleNfts, setEligibleNfts] = useState<EligibleNFT[]>([]);
  const [selectedNft, setSelectedNft] = useState<EligibleNFT | null>(null);
  const [checkingNfts, setCheckingNfts] = useState(false);
  const [eligibleCollections, setEligibleCollections] = useState<string[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);

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
      
      // Extract eligible collections from the pool data
      setLoadingCollections(true);
      console.log('Pool data fields:', fields);
      console.log('Eligible collections raw:', fields.eligible_collections);
      
      // Try different field structures
      let collections = [];
      
      // Check if it's in contents array
      if (fields.eligible_collections?.contents) {
        collections = fields.eligible_collections.contents.map((col: any) => {
          // Convert bytes back to string
          if (Array.isArray(col)) {
            return new TextDecoder().decode(new Uint8Array(col));
          }
          return col;
        });
      } 
      // Check if it's in fields.contents
      else if (fields.eligible_collections?.fields?.contents) {
        collections = fields.eligible_collections.fields.contents.map((col: any) => {
          if (Array.isArray(col)) {
            return new TextDecoder().decode(new Uint8Array(col));
          }
          return col;
        });
      }
      // Check if it's a direct array
      else if (Array.isArray(fields.eligible_collections)) {
        collections = fields.eligible_collections.map((col: any) => {
          if (Array.isArray(col)) {
            return new TextDecoder().decode(new Uint8Array(col));
          }
          return col;
        });
      }
      
      console.log('Parsed eligible collections:', collections);
      
      if (collections.length > 0) {
        setEligibleCollections(collections);
      } else {
        // If no collections found in contract, use defaults
        console.log('No eligible collections found in contract data, using defaults');
        setEligibleCollections([
          CLAIM_POOL_CONSTANTS.ELIGIBLE_COLLECTIONS.PRIME_MACHIN.TYPE,
          CLAIM_POOL_CONSTANTS.ELIGIBLE_COLLECTIONS.ROOTLET.TYPE
        ]);
      }
      setLoadingCollections(false);
    }
    setLoading(false);
  }, [poolData]);

  // Check claim status when account changes
  useEffect(() => {
    if (currentAccount) {
      checkClaimStatus();
    }
  }, [currentAccount]);

  // Fetch NFTs from BlockVision API when wallet connects
  useEffect(() => {
    const fetchEligibleNfts = async () => {
      if (!currentAccount || eligibleCollections.length === 0) return;
      
      console.log('Starting NFT fetch for wallet:', currentAccount.address);
      console.log('Looking for these collections:', eligibleCollections);
      
      setCheckingNfts(true);
      try {
        // Fetch both kiosk NFTs and regular NFTs
        const [kioskResponse, regularResponse] = await Promise.all([
          fetch(
            `https://api.blockvision.org/v2/sui/account/nfts?account=${currentAccount.address}&type=kiosk&pageIndex=1&pageSize=100`,
            {
              headers: {
                'accept': 'application/json',
                'x-api-key': '2vmcIQeMF5JdhEXyuyQ8n79UNoO'
              }
            }
          ),
          fetch(
            `https://api.blockvision.org/v2/sui/account/nfts?account=${currentAccount.address}&pageIndex=1&pageSize=100`,
            {
              headers: {
                'accept': 'application/json',
                'x-api-key': '2vmcIQeMF5JdhEXyuyQ8n79UNoO'
              }
            }
          )
        ]);
        
        const kioskData = await kioskResponse.json();
        const regularData = await regularResponse.json();
        
        // Only log errors or important info
        if (kioskData.code !== 200) console.error('Kiosk API error:', kioskData);
        if (regularData.code !== 200) console.error('Regular API error:', regularData);
        
        const allNfts = new Map(); // Use Map to deduplicate by objectId
        
        // Add kiosk NFTs
        if (kioskData.code === 200 && kioskData.result?.data) {
          console.log('Kiosk NFTs found:', kioskData.result.data.length);
          if (kioskData.result.data.length > 0) {
            console.log('Sample kiosk NFT:', kioskData.result.data[0]);
          }
          kioskData.result.data.forEach((nft: any) => {
            allNfts.set(nft.objectId, { ...nft, isInKiosk: true });
          });
        }
        
        // Add regular NFTs (some might overlap with kiosk ones)
        if (regularData.code === 200 && regularData.result?.data) {
          console.log('Regular NFTs found:', regularData.result.data.length);
          if (regularData.result.data.length > 0) {
            console.log('Sample regular NFT:', regularData.result.data[0]);
          }
          regularData.result.data.forEach((nft: any) => {
            if (!allNfts.has(nft.objectId)) {
              allNfts.set(nft.objectId, { ...nft, isInKiosk: false });
            }
          });
        }
        
        const eligible: EligibleNFT[] = [];
        
        // Check each unique NFT for eligibility
        console.log('Total NFTs to check:', allNfts.size);
        let nftIndex = 0;
        allNfts.forEach((nft) => {
          // Log first few NFTs for debugging
          if (nftIndex < 3) {
            console.log(`NFT ${nftIndex}:`, {
              objectId: nft.objectId,
              name: nft.name,
              collection: nft.collection,
              type: nft.type,
              objectType: nft.objectType,
              // Log all fields to see what's available
              allFields: Object.keys(nft)
            });
          }
          nftIndex++;
          
          // The API might return the collection in different formats
          // We need to check various fields where the type might be stored
          const nftType = nft.collection || nft.type || nft.objectType || '';
          
          // Special check for ikachan NFT
          if (nftType.includes('ikachan')) {
            console.log('Found ikachan NFT:', {
              nftType,
              objectId: nft.objectId,
              name: nft.name,
              inEligibleList: eligibleCollections.includes('0x0081dfde5fd50f02357ed690459086a6e6890683a921ee19f136ec1a95f30068::ikachan::Nft')
            });
          }
          
          // Check if this NFT's type matches any eligible collection
          const matchedCollection = eligibleCollections.find(eligibleType => {
            // Exact match
            if (nftType === eligibleType) {
              console.log(`Exact match found: ${nftType} === ${eligibleType}`);
              return true;
            }
            
            // Check if the NFT type contains the eligible type (for parameterized types)
            // e.g., "0x123::module::NFT<0x2::sui::SUI>" contains "0x123::module::NFT"
            if (nftType.includes(eligibleType)) {
              // Make sure it's not a partial match of a different type
              const afterMatch = nftType.substring(nftType.indexOf(eligibleType) + eligibleType.length);
              const isMatch = afterMatch === '' || afterMatch.startsWith('<') || afterMatch.startsWith('::');
              if (isMatch) {
                console.log(`Contains match found: ${nftType} contains ${eligibleType}`);
              }
              return isMatch;
            }
            
            // Check if eligible type contains the NFT type (opposite direction)
            if (eligibleType.includes(nftType) && nftType.length > 0) {
              console.log(`Reverse match found: ${eligibleType} contains ${nftType}`);
              return true;
            }
            
            return false;
          });
          
          if (matchedCollection) {
            console.log(`Found eligible NFT: ${nft.name} (${nftType})`);
            
            // Determine display type
            let type: 'prime' | 'rootlet' = 'prime'; // default
            let displayName = 'Eligible NFT';
            
            if (matchedCollection.includes('PrimeMachin')) {
              type = 'prime';
              displayName = 'Prime Machin';
            } else if (matchedCollection.includes('Rootlet')) {
              type = 'rootlet';
              displayName = 'Rootlet';
            } else {
              // Extract a readable name from the type
              const parts = matchedCollection.split('::');
              displayName = parts[parts.length - 1] || 'Eligible NFT';
            }
            
            eligible.push({
              objectId: nft.objectId,
              name: nft.name || displayName,
              collection: matchedCollection, // Use the matched collection from contract
              kioskId: nft.kioskId || '',
              type: type,
              isInKiosk: nft.isInKiosk || !!nft.kioskId
            });
          }
        });
        
        console.log('Found eligible NFTs:', eligible.length);
        setEligibleNfts(eligible);
        
        // Auto-select first NFT if available
        if (eligible.length > 0) {
          setSelectedNft(eligible[0]);
        }
      } catch (error) {
        console.error('Error fetching NFTs from BlockVision:', error);
      } finally {
        setCheckingNfts(false);
      }
    };
    
    if (eligibleCollections.length > 0) {
      fetchEligibleNfts();
    }
  }, [currentAccount, eligibleCollections]); // Re-run when eligible collections change


  const handleClaim = async () => {
    if (!currentAccount) {
      alert('Please connect your wallet to claim NFTs');
      return;
    }

    if (!selectedNft) {
      alert('Please select an NFT');
      return;
    }

    const nftToUse = selectedNft.objectId;
    // For auto-detected NFTs, we have the exact collection type
    const collectionType = selectedNft.collection;
    const collectionTypeBytes = Array.from(new TextEncoder().encode(collectionType));
    
    const collectionInfo = {
      TYPE: collectionType,
      TYPE_BYTES: collectionTypeBytes,
      NAME: selectedNft.name
    };

    setClaiming(true);
    
    try {
      const tx = new Transaction();
      
      // Use simplified claim function that doesn't require NFT object reference
      console.log('Using simplified claim for:', selectedNft.name);
      tx.moveCall({
        target: `${CLAIM_POOL_CONSTANTS.PACKAGE_ID}::${CLAIM_POOL_CONSTANTS.NFT_GATED_MODULE}::claim_simple`,
        typeArguments: [CONTRACT_CONSTANTS.TYPES.SUDOZ_ARTIFACT],
        arguments: [
          tx.object(CLAIM_POOL_CONSTANTS.NFT_GATED_CLAIM_POOL_ID),
          tx.pure.vector('u8', collectionInfo.TYPE_BYTES),
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
            
            // Refresh NFT list
            const fetchNfts = async () => {
              const response = await fetch(
                `https://api.blockvision.org/v2/sui/account/nfts?account=${currentAccount.address}&type=kiosk&pageIndex=1&pageSize=100`,
                {
                  headers: {
                    'accept': 'application/json',
                    'x-api-key': '2vmcIQeMF5JdhEXyuyQ8n79UNoO'
                  }
                }
              );
              const data = await response.json();
              // Process NFTs again...
            };
            fetchNfts();
          },
          onError: (error) => {
            console.error('Claim error:', error);
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetchPool()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh pool data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
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
          <p className="text-sm font-medium text-black">Eligible Collections ({eligibleCollections.length}):</p>
          <div className="flex flex-wrap gap-2">
            {loadingCollections ? (
              <span className="text-xs text-gray-500">Loading collections...</span>
            ) : eligibleCollections.length > 0 ? (
              eligibleCollections.map((collection, index) => {
                // Extract a readable name from the collection type
                let displayName = collection;
                if (collection.includes('PrimeMachin')) displayName = 'Prime Machin';
                else if (collection.includes('Rootlet')) displayName = 'Rootlet';
                else {
                  // Extract module name for other collections
                  const parts = collection.split('::');
                  displayName = parts[parts.length - 1] || collection;
                  // Remove any generic parameters
                  displayName = displayName.split('<')[0];
                }
                
                return (
                  <div key={index} className="group relative">
                    <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full cursor-help font-medium">
                      {displayName}
                    </span>
                    <div className="invisible group-hover:visible absolute z-10 bottom-full left-0 mb-2 p-2 bg-gray-800 text-white text-xs rounded max-w-xs break-all">
                      {collection}
                    </div>
                  </div>
                );
              })
            ) : (
              <span className="text-xs text-gray-500 italic">
                No eligible collections configured
              </span>
            )}
          </div>
          {eligibleCollections.length > 0 && (
            <p className="text-xs text-orange-600 mt-2">
              ⚠️ You must own one of these NFTs to claim from this pool
            </p>
          )}
        </div>

        {currentAccount && (
          <div className="space-y-4">
            {checkingNfts ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <p className="text-sm text-black">Checking your eligible NFTs...</p>
                </div>
              </div>
            ) : eligibleNfts.length > 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-black font-medium mb-3">
                  ✅ Found {eligibleNfts.length} eligible NFT{eligibleNfts.length > 1 ? 's' : ''}!
                </p>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-black">Select NFT to use for claiming:</label>
                    <select
                      value={selectedNft?.objectId || ''}
                      onChange={(e) => {
                        const nft = eligibleNfts.find(n => n.objectId === e.target.value);
                        setSelectedNft(nft || null);
                      }}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-black"
                      disabled={claiming || isPending}
                    >
                      {eligibleNfts.map((nft) => {
                        // Extract a display name for the collection
                        let collectionDisplay = 'Unknown';
                        if (nft.collection.includes('PrimeMachin')) collectionDisplay = 'Prime Machin';
                        else if (nft.collection.includes('Rootlet')) collectionDisplay = 'Rootlet';
                        else {
                          const parts = nft.collection.split('::');
                          collectionDisplay = parts[parts.length - 1] || 'Collection';
                        }
                        
                        return (
                          <option key={nft.objectId} value={nft.objectId}>
                            {nft.name} ({collectionDisplay}) {nft.isInKiosk ? '🔒 In Kiosk' : '✓ In Wallet'}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  
                  {selectedNft?.isInKiosk && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-black font-medium">✅ NFT Detected in Kiosk</p>
                      <p className="text-xs text-gray-700 mt-1">
                        Your {selectedNft.name} has been detected and verified. You can claim even though it's in a kiosk!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-black font-medium">
                  {eligibleNfts.length === 0 && !checkingNfts 
                    ? "No eligible NFTs found. You need to own an eligible NFT collection to claim." 
                    : "To claim, you need to own an eligible NFT"}
                </p>
                {eligibleNfts.length === 0 && !checkingNfts && (
                  <p className="text-xs text-gray-600 mt-2">
                    Make sure you own NFTs from the eligible collections listed above.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

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