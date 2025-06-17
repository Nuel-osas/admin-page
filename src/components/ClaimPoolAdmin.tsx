'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { CLAIM_POOL_CONSTANTS, CONTRACT_CONSTANTS } from '@/constants/contract';
import { Settings, Users, Package, ToggleLeft, ToggleRight, UserPlus, UserMinus, Trash2, Plus, X } from 'lucide-react';

export default function ClaimPoolAdmin() {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction, isPending } = useSignAndExecuteTransaction();
  const client = useSuiClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [poolInfo, setPoolInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [newDepositor, setNewDepositor] = useState('');
  const [removeDepositor, setRemoveDepositor] = useState('');
  const [newCollection, setNewCollection] = useState('');
  const [removeCollection, setRemoveCollection] = useState('');
  const [removeNftCount, setRemoveNftCount] = useState('1');
  const [removeNftRecipient, setRemoveNftRecipient] = useState('');
  const [newAdmin, setNewAdmin] = useState('');

  // Fetch pool data to check admin and get pool info
  const { data: poolData, refetch: refetchPool } = useSuiClientQuery(
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
          setPoolInfo({
            admin: adminAddress,
            remainingNfts: fields.nft_ids?.length || 0,
            totalClaimed: parseInt(fields.total_claimed || '0'),
            claimingEnabled: fields.claiming_enabled || false,
            eligibleCollections: fields.eligible_collections?.contents || [],
          });
        } else {
          setIsAdmin(false);
        }
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  }, [currentAccount, poolData]);

  if (!currentAccount || !isAdmin) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col items-center justify-center gap-4 p-12">
          <Settings className="h-12 w-12 text-gray-400" />
          <p className="text-black text-center">
            {!currentAccount ? 'Connect wallet to access admin panel' : 'You are not the admin of this claim pool'}
          </p>
        </div>
      </div>
    );
  }

  const executeTransaction = async (txBuilder: (tx: Transaction) => void, successMessage: string) => {
    if (!currentAccount) return;

    setLoading(true);
    try {
      const tx = new Transaction();
      txBuilder(tx);

      await signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: () => {
            alert(successMessage);
            refetchPool();
            // Clear form fields
            setNewDepositor('');
            setRemoveDepositor('');
            setNewCollection('');
            setRemoveCollection('');
            setRemoveNftCount('1');
            setRemoveNftRecipient('');
            setNewAdmin('');
          },
          onError: (error) => {
            alert(`Transaction failed: ${error.message || 'Unknown error'}`);
          },
        }
      );
    } catch (error) {
      console.error('Transaction error:', error);
      alert('Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleClaiming = () => {
    executeTransaction(
      (tx) => {
        tx.moveCall({
          target: `${CLAIM_POOL_CONSTANTS.PACKAGE_ID}::${CLAIM_POOL_CONSTANTS.NFT_GATED_MODULE}::set_claiming_enabled`,
          arguments: [
            tx.object(CLAIM_POOL_CONSTANTS.NFT_GATED_CLAIM_POOL_ID),
            tx.pure.bool(!poolInfo.claimingEnabled),
          ],
        });
      },
      `Claiming ${poolInfo.claimingEnabled ? 'disabled' : 'enabled'} successfully!`
    );
  };

  const addAuthorizedDepositor = () => {
    if (!newDepositor.trim()) return;
    
    executeTransaction(
      (tx) => {
        tx.moveCall({
          target: `${CLAIM_POOL_CONSTANTS.PACKAGE_ID}::${CLAIM_POOL_CONSTANTS.NFT_GATED_MODULE}::add_authorized_depositor`,
          arguments: [
            tx.object(CLAIM_POOL_CONSTANTS.NFT_GATED_CLAIM_POOL_ID),
            tx.pure.address(newDepositor.trim()),
          ],
        });
      },
      `Added ${newDepositor} as authorized depositor!`
    );
  };

  const removeAuthorizedDepositor = () => {
    if (!removeDepositor.trim()) return;
    
    executeTransaction(
      (tx) => {
        tx.moveCall({
          target: `${CLAIM_POOL_CONSTANTS.PACKAGE_ID}::${CLAIM_POOL_CONSTANTS.NFT_GATED_MODULE}::remove_authorized_depositor`,
          arguments: [
            tx.object(CLAIM_POOL_CONSTANTS.NFT_GATED_CLAIM_POOL_ID),
            tx.pure.address(removeDepositor.trim()),
          ],
        });
      },
      `Removed ${removeDepositor} from authorized depositors!`
    );
  };

  const addEligibleCollection = () => {
    if (!newCollection.trim()) return;
    
    executeTransaction(
      (tx) => {
        tx.moveCall({
          target: `${CLAIM_POOL_CONSTANTS.PACKAGE_ID}::${CLAIM_POOL_CONSTANTS.NFT_GATED_MODULE}::add_eligible_collection`,
          arguments: [
            tx.object(CLAIM_POOL_CONSTANTS.NFT_GATED_CLAIM_POOL_ID),
            tx.pure.vector('u8', Array.from(new TextEncoder().encode(newCollection.trim()))),
          ],
        });
      },
      `Added ${newCollection} as eligible collection!`
    );
  };

  const removeEligibleCollection = () => {
    if (!removeCollection.trim()) return;
    
    executeTransaction(
      (tx) => {
        tx.moveCall({
          target: `${CLAIM_POOL_CONSTANTS.PACKAGE_ID}::${CLAIM_POOL_CONSTANTS.NFT_GATED_MODULE}::remove_eligible_collection`,
          arguments: [
            tx.object(CLAIM_POOL_CONSTANTS.NFT_GATED_CLAIM_POOL_ID),
            tx.pure.vector('u8', Array.from(new TextEncoder().encode(removeCollection.trim()))),
          ],
        });
      },
      `Removed ${removeCollection} from eligible collections!`
    );
  };

  const removeNftsFromPool = () => {
    if (!removeNftRecipient.trim() || !removeNftCount) return;
    
    executeTransaction(
      (tx) => {
        tx.moveCall({
          target: `${CLAIM_POOL_CONSTANTS.PACKAGE_ID}::${CLAIM_POOL_CONSTANTS.NFT_GATED_MODULE}::remove_nfts_from_pool`,
          typeArguments: [CONTRACT_CONSTANTS.TYPES.SUDOZ_ARTIFACT],
          arguments: [
            tx.object(CLAIM_POOL_CONSTANTS.NFT_GATED_CLAIM_POOL_ID),
            tx.pure.u64(removeNftCount),
            tx.pure.address(removeNftRecipient.trim()),
          ],
        });
      },
      `Removed ${removeNftCount} NFTs from pool and sent to ${removeNftRecipient}!`
    );
  };

  const removeAllNftsFromPool = () => {
    if (!removeNftRecipient.trim()) return;
    
    executeTransaction(
      (tx) => {
        tx.moveCall({
          target: `${CLAIM_POOL_CONSTANTS.PACKAGE_ID}::${CLAIM_POOL_CONSTANTS.NFT_GATED_MODULE}::remove_all_nfts_from_pool`,
          typeArguments: [CONTRACT_CONSTANTS.TYPES.SUDOZ_ARTIFACT],
          arguments: [
            tx.object(CLAIM_POOL_CONSTANTS.NFT_GATED_CLAIM_POOL_ID),
            tx.pure.address(removeNftRecipient.trim()),
          ],
        });
      },
      `Removed all NFTs from pool and sent to ${removeNftRecipient}!`
    );
  };

  const transferAdmin = () => {
    if (!newAdmin.trim()) return;
    
    executeTransaction(
      (tx) => {
        tx.moveCall({
          target: `${CLAIM_POOL_CONSTANTS.PACKAGE_ID}::${CLAIM_POOL_CONSTANTS.NFT_GATED_MODULE}::transfer_admin`,
          arguments: [
            tx.object(CLAIM_POOL_CONSTANTS.NFT_GATED_CLAIM_POOL_ID),
            tx.pure.address(newAdmin.trim()),
          ],
        });
      },
      `Admin rights transferred to ${newAdmin}!`
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-6 border-b">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          <h3 className="text-lg font-semibold text-black">Claim Pool Admin Panel</h3>
        </div>
        <p className="text-sm text-black mt-1">
          Manage pool settings, depositors, and eligible collections
        </p>
      </div>

      <div className="p-6 space-y-8">
        {/* Pool Status */}
        <div className="space-y-4">
          <h4 className="font-medium text-black flex items-center gap-2">
            <Package className="h-4 w-4" />
            Pool Status
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-black">Admin</p>
              <p className="text-xs text-black font-mono break-all">{poolInfo?.admin}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-black">Remaining NFTs</p>
              <p className="text-xl font-bold text-black">{poolInfo?.remainingNfts}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-black">Total Claimed</p>
              <p className="text-xl font-bold text-black">{poolInfo?.totalClaimed}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-black">Claiming Status</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleClaiming}
                  disabled={loading || isPending}
                  className="flex items-center gap-1 text-sm font-medium disabled:opacity-50"
                >
                  {poolInfo?.claimingEnabled ? (
                    <>
                      <ToggleRight className="h-5 w-5 text-green-600" />
                      <span className="text-green-600">Enabled</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="h-5 w-5 text-red-600" />
                      <span className="text-red-600">Disabled</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Depositor Management */}
        <div className="space-y-4">
          <h4 className="font-medium text-black flex items-center gap-2">
            <Users className="h-4 w-4" />
            Authorized Depositors
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-black">Add Authorized Depositor</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDepositor}
                  onChange={(e) => setNewDepositor(e.target.value)}
                  placeholder="Enter wallet address"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-black"
                />
                <button
                  onClick={addAuthorizedDepositor}
                  disabled={!newDepositor.trim() || loading || isPending}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 flex items-center gap-1"
                >
                  <UserPlus className="h-4 w-4" />
                  Add
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-black">Remove Authorized Depositor</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={removeDepositor}
                  onChange={(e) => setRemoveDepositor(e.target.value)}
                  placeholder="Enter wallet address"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-black"
                />
                <button
                  onClick={removeAuthorizedDepositor}
                  disabled={!removeDepositor.trim() || loading || isPending}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 flex items-center gap-1"
                >
                  <UserMinus className="h-4 w-4" />
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Collection Management */}
        <div className="space-y-4">
          <h4 className="font-medium text-black flex items-center gap-2">
            <Package className="h-4 w-4" />
            Eligible Collections
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-black">Add Eligible Collection</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCollection}
                  onChange={(e) => setNewCollection(e.target.value)}
                  placeholder="Enter collection type (e.g., 0x...::module::Type)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-black"
                />
                <button
                  onClick={addEligibleCollection}
                  disabled={!newCollection.trim() || loading || isPending}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-black">Remove Eligible Collection</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={removeCollection}
                  onChange={(e) => setRemoveCollection(e.target.value)}
                  placeholder="Enter collection type"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-black"
                />
                <button
                  onClick={removeEligibleCollection}
                  disabled={!removeCollection.trim() || loading || isPending}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 flex items-center gap-1"
                >
                  <X className="h-4 w-4" />
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* NFT Pool Management */}
        <div className="space-y-4">
          <h4 className="font-medium text-black flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            NFT Pool Management
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-black">Remove Specific Number of NFTs</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={removeNftCount}
                  onChange={(e) => setRemoveNftCount(e.target.value)}
                  placeholder="Count"
                  min="1"
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-black"
                />
                <input
                  type="text"
                  value={removeNftRecipient}
                  onChange={(e) => setRemoveNftRecipient(e.target.value)}
                  placeholder="Recipient address"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-black"
                />
                <button
                  onClick={removeNftsFromPool}
                  disabled={!removeNftRecipient.trim() || !removeNftCount || loading || isPending}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300"
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-black">Remove All NFTs</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={removeNftRecipient}
                  onChange={(e) => setRemoveNftRecipient(e.target.value)}
                  placeholder="Recipient address"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-black"
                />
                <button
                  onClick={removeAllNftsFromPool}
                  disabled={!removeNftRecipient.trim() || loading || isPending}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300"
                >
                  Remove All
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Transfer */}
        <div className="space-y-4 pt-4 border-t">
          <h4 className="font-medium text-black flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Transfer Admin Rights
          </h4>
          <div className="max-w-md space-y-2">
            <label className="text-sm text-black">New Admin Address</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newAdmin}
                onChange={(e) => setNewAdmin(e.target.value)}
                placeholder="Enter new admin address"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-black"
              />
              <button
                onClick={transferAdmin}
                disabled={!newAdmin.trim() || loading || isPending}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300"
              >
                Transfer
              </button>
            </div>
            <p className="text-xs text-red-600">
              Warning: This will transfer admin rights permanently. You will lose admin access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}