'use client';

import { useState } from 'react';
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { CONTRACT_CONSTANTS } from '@/constants/contract';
import { autoGetOrCreateKiosk, ensureKiosk } from '@/utils/kioskUtils';

interface NFTCardProps {
  nft: any;
}

export function NFTCard({ nft }: NFTCardProps) {
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isEvolving, setIsEvolving] = useState(false);
  const [targetLevel, setTargetLevel] = useState<number>(0);
  const client = useSuiClient();
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const content = nft.data?.content?.fields || {};
  const display = nft.data?.display?.data || {};
  const objectId = nft.data?.objectId || '';
  
  const level = parseInt(content.level || '0');
  const points = parseInt(content.points || '0');
  const artifactNumber = content.number || '';
  const name = display.name || content.name || `SUDOZ ARTIFACT #${artifactNumber}`;
  let imageUrl = display.image_url || content.image_url || '';
  const path = content.path;
  
  // Debug logging
  console.log('NFT Image URL (original):', imageUrl);
  console.log('NFT Level:', level);
  console.log('NFT Path:', path);

  // Convert IPFS URLs to HTTP gateway URLs
  if (imageUrl.startsWith('ipfs://')) {
    const ipfsHash = imageUrl.replace('ipfs://', '');
    imageUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
  }
  
  // The contract now returns the correct URLs, no need for additional conversions
  
  // Debug logging after conversion
  console.log('NFT Image URL (converted):', imageUrl);

  // Initialize target level to current level + 1
  if (targetLevel === 0 && level < 10) {
    setTargetLevel(level + 1);
  }

  const handleUpgrade = async () => {
    if (level >= 10 || targetLevel <= level || targetLevel > 10) return;
    
    setIsUpgrading(true);
    try {
      const tx = new Transaction();
      const upgradeCost = (targetLevel - level) * CONTRACT_CONSTANTS.UPGRADE_COST_PER_LEVEL;
      
      // Create coin for payment
      const [coin] = tx.splitCoins(tx.gas, [upgradeCost]);
      
      // Use the flexible upgrade function
      tx.moveCall({
        target: `${CONTRACT_CONSTANTS.PACKAGE_ID}::${CONTRACT_CONSTANTS.MODULE_NAME}::${CONTRACT_CONSTANTS.FUNCTIONS.UPGRADE_TO_LEVEL}`,
        arguments: [
          tx.object(objectId),
          tx.pure.u64(targetLevel),
          coin,
          tx.object(CONTRACT_CONSTANTS.GLOBAL_STATS_ID),
          tx.object(CONTRACT_CONSTANTS.RANDOM_OBJECT_ID),
        ],
      });

      // Set gas budget for upgrade transaction
      tx.setGasBudget(2000000000); // 2 SUI

      const result = await signAndExecute({
        transaction: tx,
      });

      console.log('Upgrade successful:', result);
      // Trigger a refetch instead of reloading
      setTimeout(() => {
        window.dispatchEvent(new Event('nft-updated'));
      }, 1000);
    } catch (error) {
      console.error('Upgrade failed:', error);
      console.error('Failed to upgrade NFT:', error);
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleSingleUpgrade = async () => {
    if (level >= 10) return;
    
    setIsUpgrading(true);
    try {
      const tx = new Transaction();
      
      // Create coin for payment
      const [coin] = tx.splitCoins(tx.gas, [CONTRACT_CONSTANTS.UPGRADE_COST_PER_LEVEL]);
      
      tx.moveCall({
        target: `${CONTRACT_CONSTANTS.PACKAGE_ID}::${CONTRACT_CONSTANTS.MODULE_NAME}::${CONTRACT_CONSTANTS.FUNCTIONS.UPGRADE_LEVEL}`,
        arguments: [
          tx.object(objectId),
          coin,
          tx.object(CONTRACT_CONSTANTS.GLOBAL_STATS_ID),
          tx.object(CONTRACT_CONSTANTS.RANDOM_OBJECT_ID),
        ],
      });

      // Set gas budget for upgrade transaction
      tx.setGasBudget(2000000000); // 2 SUI

      const result = await signAndExecute({
        transaction: tx,
      });

      console.log('Upgrade successful:', result);
      // Trigger a refetch instead of reloading
      setTimeout(() => {
        window.dispatchEvent(new Event('nft-updated'));
      }, 1000);
    } catch (error) {
      console.error('Upgrade failed:', error);
      console.error('Failed to upgrade NFT:', error);
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleEvolve = async () => {
    if (level !== 10) return;
    
    setIsEvolving(true);
    try {
      // Step 1: Get available metadata IDs
      const evolvedStats = await client.getObject({
        id: CONTRACT_CONSTANTS.EVOLVED_STATS_ID,
        options: { showContent: true }
      });
      
      const availableIds = (evolvedStats.data?.content as any)?.fields?.available_metadata_ids || [];
      
      if (availableIds.length === 0) {
        alert('No evolved NFTs available!');
        return;
      }
      
      // Step 2: Select a random metadata ID (you could also let user choose)
      const selectedMetadataId = availableIds[Math.floor(Math.random() * availableIds.length)];
      
      // Step 3: Fetch metadata and traits from IPFS
      const metadataUrl = `https://ipfs.io/ipfs/bafybeic7ymazpspv6ojxwrr6rqu3glnrtzbj3ej477nowr73brmb4hkkka/metadata/${selectedMetadataId}.json`;
      const response = await fetch(metadataUrl);
      const metadata = await response.json();
      
      // Extract traits
      const traitsMap = new Map<string, string>();
      metadata.attributes.forEach((attr: any) => {
        traitsMap.set(attr.trait_type.toLowerCase(), attr.value);
      });
      
      const traits = {
        background: traitsMap.get('background') || 'Unknown',
        skin: traitsMap.get('skin') || 'Unknown',
        clothes: traitsMap.get('clothes') || 'Unknown',
        hats: traitsMap.get('hats') || 'Unknown',
        eyewear: traitsMap.get('eyewear') || 'Unknown',
        mouth: traitsMap.get('mouth') || 'Unknown',
        earrings: traitsMap.get('earrings') || 'Unknown',
      };
      
      // Step 4: Show preview and evolution type selection
      const evolutionType = confirm(
        `Evolve "${metadata.name}" with these traits:\n\n` +
        `• Background: ${traits.background}\n` +
        `• Skin: ${traits.skin}\n` +
        `• Clothes: ${traits.clothes}\n\n` +
        `Choose evolution type:\n` +
        `✅ OK = KIOSK EVOLUTION (Marketplace Ready + Royalties)\n` +
        `❌ Cancel = BASIC EVOLUTION (Simple Transfer)\n\n` +
        `Kiosk evolution locks NFT for trading. Basic evolution gives you the NFT directly.`
      );
      
      // Step 5: Execute evolution transaction based on user choice
      const tx = new Transaction();
      
      if (evolutionType) {
        // Kiosk Evolution - Smart kiosk management
        const userAddress = account?.address;
        if (!userAddress) {
          alert('No wallet connected');
          return;
        }

        // Ensure kiosk exists (create if needed) - same as dev reserve minting
        const kioskInfo = await ensureKiosk(client, userAddress, tx);
        
        // Always use evolve_artifact_to_kiosk since we have a kiosk
        tx.moveCall({
          target: `${CONTRACT_CONSTANTS.PACKAGE_ID}::${CONTRACT_CONSTANTS.MODULE_NAME}::${CONTRACT_CONSTANTS.FUNCTIONS.EVOLVE_ARTIFACT_TO_KIOSK}`,
          arguments: [
            tx.object(objectId),
            kioskInfo.kioskId,
            kioskInfo.kioskCap,
            tx.object(CONTRACT_CONSTANTS.TRANSFER_POLICY_ID),
            tx.object(CONTRACT_CONSTANTS.GLOBAL_STATS_ID),
            tx.object(CONTRACT_CONSTANTS.EVOLVED_STATS_ID),
            tx.object(CONTRACT_CONSTANTS.RANDOM_OBJECT_ID),
            tx.pure.u64(selectedMetadataId),
            tx.pure.string(traits.background),
            tx.pure.string(traits.skin),
            tx.pure.string(traits.clothes),
            tx.pure.string(traits.hats),
            tx.pure.string(traits.eyewear),
            tx.pure.string(traits.mouth),
            tx.pure.string(traits.earrings),
          ],
        });
        
        if (kioskInfo.isNew) {
          console.log('Creating new kiosk and evolving NFT');
        } else {
          console.log('Evolving NFT to existing kiosk:', kioskInfo);
        }
      } else {
        // Basic Evolution (simple transfer)
        tx.moveCall({
          target: `${CONTRACT_CONSTANTS.PACKAGE_ID}::${CONTRACT_CONSTANTS.MODULE_NAME}::${CONTRACT_CONSTANTS.FUNCTIONS.EVOLVE_ARTIFACT}`,
          arguments: [
            tx.object(objectId),
            tx.object(CONTRACT_CONSTANTS.GLOBAL_STATS_ID),
            tx.object(CONTRACT_CONSTANTS.EVOLVED_STATS_ID),
            tx.object(CONTRACT_CONSTANTS.RANDOM_OBJECT_ID),
            tx.pure.u64(selectedMetadataId),
            tx.pure.string(traits.background),
            tx.pure.string(traits.skin),
            tx.pure.string(traits.clothes),
            tx.pure.string(traits.hats),
            tx.pure.string(traits.eyewear),
            tx.pure.string(traits.mouth),
            tx.pure.string(traits.earrings),
          ],
        });
        console.log('Using Basic Evolution - NFT will be transferred directly to you');
      }

      const result = await signAndExecute({
        transaction: tx,
      });

      console.log('Evolution successful:', result);
      console.log('Evolved to metadata ID:', selectedMetadataId);
      // Trigger a refetch instead of reloading
      setTimeout(() => {
        window.dispatchEvent(new Event('nft-updated'));
      }, 1000);
    } catch (error) {
      console.error('Evolution failed:', error);
      alert('Failed to evolve NFT: ' + (error as any).message);
    } finally {
      setIsEvolving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="aspect-square bg-gray-100 relative">
        <a 
          href={`https://suivision.xyz/object/${objectId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full h-full"
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="w-full h-full object-cover hover:opacity-90 transition-opacity cursor-pointer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No Image
            </div>
          )}
        </a>
        <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-sm pointer-events-none">
          Level {level}
        </div>
      </div>
      
      <div className="p-4">
        <h3 className="font-bold text-lg mb-2">{name}</h3>
        <div className="text-sm text-gray-600 mb-4">
          <p>Points: {points}</p>
          {path && <p>Path: {CONTRACT_CONSTANTS.PATHS[parseInt(path)]}</p>}
        </div>
        
        {level < 10 && (
          <div className="space-y-3">
            {/* Single level upgrade button */}
            <button
              onClick={handleSingleUpgrade}
              disabled={isUpgrading}
              className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300 transition-colors"
            >
              {isUpgrading ? 'Upgrading...' : `Upgrade +1 Level (1 SUI)`}
            </button>

            {/* Level selector and upgrade button */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium">Upgrade to level:</label>
                <select
                  value={targetLevel}
                  onChange={(e) => setTargetLevel(parseInt(e.target.value))}
                  className="flex-1 px-2 py-1 border rounded text-sm"
                  disabled={isUpgrading}
                >
                  {Array.from({ length: 10 - level }, (_, i) => level + i + 1).map((lvl) => (
                    <option key={lvl} value={lvl}>
                      Level {lvl} ({lvl - level} SUI)
                    </option>
                  ))}
                </select>
              </div>
              
              <button
                onClick={handleUpgrade}
                disabled={isUpgrading || targetLevel <= level}
                className="w-full bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:bg-gray-300 transition-colors"
              >
                {isUpgrading ? 'Upgrading...' : `Upgrade to Level ${targetLevel} (${targetLevel - level} SUI)`}
              </button>
            </div>
          </div>
        )}
        
        {level === 10 && (
          <button
            className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
            onClick={handleEvolve}
            disabled={isEvolving}
          >
            {isEvolving ? 'Evolving...' : 'Evolve to THE SUDOZ'}
          </button>
        )}
      </div>
    </div>
  );
}