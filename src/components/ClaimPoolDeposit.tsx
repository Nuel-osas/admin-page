'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { CLAIM_POOL_CONSTANTS, CONTRACT_CONSTANTS } from '@/constants/contract';
import { SuiObjectData } from '@mysten/sui/client';
import { Upload, Loader2, Package, AlertCircle } from 'lucide-react';

interface NFTOption {
  id: string;
  name: string;
  number: number;
  level: number;
}

export default function ClaimPoolDeposit() {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction, isPending } = useSignAndExecuteTransaction();
  const client = useSuiClient();
  const [selectedNfts, setSelectedNfts] = useState<string[]>([]);
  const [availableNfts, setAvailableNfts] = useState<NFTOption[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [depositing, setDepositing] = useState(false);

  // Fetch user's NFTs
  const { data: userObjects } = useSuiClientQuery(
    'getOwnedObjects',
    {
      owner: currentAccount?.address || '',
      filter: {
        StructType: CONTRACT_CONSTANTS.TYPES.SUDOZ_ARTIFACT,
      },
      options: {
        showContent: true,
        showDisplay: true,
      },
    },
    {
      enabled: !!currentAccount,
    }
  );

  // Fetch pool data to check admin
  const { data: poolData } = useSuiClientQuery(
    'getObject',
    {
      id: CLAIM_POOL_CONSTANTS.NFT_GATED_CLAIM_POOL_ID,
      options: {
        showContent: true,
      },
    },
    {
      enabled: !!currentAccount,
    }
  );

  // Check if user is admin
  useEffect(() => {
    if (!currentAccount || !poolData?.data?.content) return;

    try {
      const poolContent = poolData.data.content;
      if (poolContent.dataType === 'moveObject') {
        const fields = (poolContent as any).fields;
        const adminAddress = fields.admin;
        
        if (adminAddress === currentAccount.address) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  }, [currentAccount, poolData]);

  // Parse NFTs from user objects
  useEffect(() => {
    if (userObjects?.data) {
      const nfts: NFTOption[] = userObjects.data
        .map((obj) => {
          if (obj.data?.content?.dataType === 'moveObject') {
            const fields = (obj.data.content as any).fields;
            return {
              id: obj.data.objectId,
              name: fields.name || 'SUDOZ ARTIFACT',
              number: parseInt(fields.number || '0'),
              level: parseInt(fields.level || '0'),
            };
          }
          return null;
        })
        .filter((nft): nft is NFTOption => nft !== null);
      
      setAvailableNfts(nfts);
    }
  }, [userObjects]);


  const handleDeposit = async () => {
    if (!currentAccount || selectedNfts.length === 0) return;

    setDepositing(true);
    
    try {
      const tx = new Transaction();
      
      // Use batch deposit functions based on count
      if (selectedNfts.length <= 5) {
        // Use batch_deposit_5
        for (let i = 0; i < selectedNfts.length; i++) {
          tx.moveCall({
            target: `${CLAIM_POOL_CONSTANTS.PACKAGE_ID}::${CLAIM_POOL_CONSTANTS.NFT_GATED_MODULE}::add_nft_to_pool`,
            typeArguments: [CONTRACT_CONSTANTS.TYPES.SUDOZ_ARTIFACT],
            arguments: [
              tx.object(CLAIM_POOL_CONSTANTS.NFT_GATED_CLAIM_POOL_ID),
              tx.object(selectedNfts[i]),
            ],
          });
        }
      } else if (selectedNfts.length <= 10) {
        // Use batch_deposit_10
        tx.moveCall({
          target: `${CLAIM_POOL_CONSTANTS.PACKAGE_ID}::${CLAIM_POOL_CONSTANTS.BATCH_DEPOSIT_MODULE}::batch_deposit_10`,
          typeArguments: [CONTRACT_CONSTANTS.TYPES.SUDOZ_ARTIFACT],
          arguments: [
            tx.object(CLAIM_POOL_CONSTANTS.NFT_GATED_CLAIM_POOL_ID),
            ...selectedNfts.slice(0, 10).map(id => tx.object(id)),
          ],
        });
      } else if (selectedNfts.length <= 20) {
        // Use batch_deposit_20
        tx.moveCall({
          target: `${CLAIM_POOL_CONSTANTS.PACKAGE_ID}::${CLAIM_POOL_CONSTANTS.BATCH_DEPOSIT_MODULE}::batch_deposit_20`,
          typeArguments: [CONTRACT_CONSTANTS.TYPES.SUDOZ_ARTIFACT],
          arguments: [
            tx.object(CLAIM_POOL_CONSTANTS.NFT_GATED_CLAIM_POOL_ID),
            ...selectedNfts.slice(0, 20).map(id => tx.object(id)),
          ],
        });
      }

      await signAndExecuteTransaction(
        {
          transaction: tx,
        },
        {
          onSuccess: () => {
            alert(`NFTs Deposited! Successfully deposited ${selectedNfts.length} NFTs to the claim pool.`);
            setSelectedNfts([]);
          },
          onError: (error) => {
            alert(`Deposit Failed: ${error.message || 'Failed to deposit NFTs'}`);
          },
        }
      );
    } catch (error) {
      console.error('Error depositing NFTs:', error);
      alert('Error: An unexpected error occurred');
    } finally {
      setDepositing(false);
    }
  };

  if (!currentAccount) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-center p-12">
          <p className="text-gray-600">Connect wallet to manage deposits</p>
        </div>
      </div>
    );
  }

  // Remove authorization check - let the contract handle it
  // The contract will reject unauthorized deposits

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 text-black">
              <Upload className="h-5 w-5" />
              Deposit NFTs to Claim Pool
            </h3>
            <p className="text-sm text-black mt-1">
              Add your SUDOZ ARTIFACT NFTs to the claim pool
            </p>
          </div>
          {isAdmin && (
            <span className="bg-purple-500 text-white text-xs px-2 py-1 rounded-full font-medium">
              Admin
            </span>
          )}
        </div>
      </div>
      <div className="p-6 space-y-4">
        {!isAdmin && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-black">
              <strong>Note:</strong> Only the admin and authorized depositors can add NFTs to this pool. 
              If you're not authorized, the transaction will fail.
            </p>
          </div>
        )}
        
        <div className="space-y-2">
          <p className="text-sm font-medium text-black">Available NFTs ({availableNfts.length})</p>
          {availableNfts.length === 0 ? (
            <p className="text-sm text-black">No SUDOZ ARTIFACT NFTs found in your wallet</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {availableNfts.map((nft) => (
                <label
                  key={nft.id}
                  className="flex items-center space-x-2 p-2 rounded-lg border cursor-pointer hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={selectedNfts.includes(nft.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedNfts([...selectedNfts, nft.id]);
                      } else {
                        setSelectedNfts(selectedNfts.filter(id => id !== nft.id));
                      }
                    }}
                    className="rounded"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm text-black">#{nft.number}</p>
                    <p className="text-xs text-black">Level {nft.level}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-black">
            Selected: {selectedNfts.length} NFTs
          </p>
          {selectedNfts.length > 20 && (
            <p className="text-sm text-black font-medium">
              Max 20 NFTs per transaction
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setSelectedNfts(availableNfts.slice(0, 20).map(nft => nft.id))}
            disabled={availableNfts.length === 0}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors text-black font-medium"
          >
            Select First 20
          </button>
          <button
            onClick={() => setSelectedNfts([])}
            disabled={selectedNfts.length === 0}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors text-black font-medium"
          >
            Clear Selection
          </button>
          <button
            onClick={handleDeposit}
            disabled={
              selectedNfts.length === 0 ||
              selectedNfts.length > 20 ||
              depositing ||
              isPending
            }
            className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-medium"
          >
            {depositing || isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Depositing...
              </>
            ) : (
              <>
                <Package className="mr-2 h-4 w-4" />
                Deposit {selectedNfts.length} NFTs
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}