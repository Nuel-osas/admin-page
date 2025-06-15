'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction, useSuiClientQuery } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { CONTRACT_CONSTANTS } from '@/constants/contract';
import { ensureKiosk } from '@/utils/kioskUtils';

export function AdminSection() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [hasAdminCap, setHasAdminCap] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [adminCapId, setAdminCapId] = useState<string | null>(null);
  const [hasEvolvedAdminCap, setHasEvolvedAdminCap] = useState(false);
  const [evolvedAdminCapId, setEvolvedAdminCapId] = useState<string | null>(null);
  const [isMintingDevReserve, setIsMintingDevReserve] = useState(false);
  const [selectedOneOfOne, setSelectedOneOfOne] = useState<number>(CONTRACT_CONSTANTS.ONE_OF_ONE_IDS[0]);
  const [isWithdrawingRoyalties, setIsWithdrawingRoyalties] = useState(false);

  // Check if current account owns the AdminCap
  const { data: adminCapData } = useSuiClientQuery('getOwnedObjects', {
    owner: account?.address || '',
    filter: {
      StructType: `${CONTRACT_CONSTANTS.PACKAGE_ID}::${CONTRACT_CONSTANTS.MODULE_NAME}::AdminCap`,
    },
  }, {
    enabled: !!account,
  });

  // Check if current account owns the EvolvedAdminCap
  const { data: evolvedAdminCapData } = useSuiClientQuery('getOwnedObjects', {
    owner: account?.address || '',
    filter: {
      StructType: `${CONTRACT_CONSTANTS.PACKAGE_ID}::${CONTRACT_CONSTANTS.EVOLVED_MODULE_NAME}::EvolvedAdminCap`,
    },
  }, {
    enabled: !!account && CONTRACT_CONSTANTS.EVOLVED_ADMIN_CAP_ID !== '',
  });

  // Fetch global stats to show accumulated fees
  const { data: statsData, refetch: refetchStats } = useSuiClientQuery('getObject', {
    id: CONTRACT_CONSTANTS.GLOBAL_STATS_ID,
    options: {
      showContent: true,
    },
  });

  // Fetch evolved stats if available
  const { data: evolvedStatsData, refetch: refetchEvolvedStats } = useSuiClientQuery('getObject', {
    id: CONTRACT_CONSTANTS.EVOLVED_STATS_ID,
    options: {
      showContent: true,
    },
  }, {
    enabled: CONTRACT_CONSTANTS.EVOLVED_STATS_ID !== '',
  });

  // Fetch Transfer Policy to get actual royalty balance
  const { data: transferPolicyData, refetch: refetchTransferPolicy, isLoading: isLoadingPolicy } = useSuiClientQuery('getObject', {
    id: CONTRACT_CONSTANTS.TRANSFER_POLICY_ID,
    options: {
      showContent: true,
      showType: true,
    },
  }, {
    enabled: !!CONTRACT_CONSTANTS.TRANSFER_POLICY_ID && CONTRACT_CONSTANTS.TRANSFER_POLICY_ID.length > 0,
  });
  
  // Log the transfer policy loading state
  console.log('Transfer Policy Loading:', isLoadingPolicy);
  console.log('Transfer Policy ID exists:', !!CONTRACT_CONSTANTS.TRANSFER_POLICY_ID);

  useEffect(() => {
    console.log('AdminCap query result:', adminCapData);
    console.log('AdminCap data array:', adminCapData?.data);
    if (adminCapData?.data && adminCapData.data.length > 0) {
      setHasAdminCap(true);
      // Get the actual AdminCap object ID
      const adminCap = adminCapData.data[0];
      const capId = adminCap.data?.objectId || null;
      console.log('Found AdminCap:', capId);
      console.log('AdminCap data:', adminCap);
      setAdminCapId(capId);
    } else if (account?.address === CONTRACT_CONSTANTS.REVENUE_CONFIG.FOUNDER_ADDRESS && CONTRACT_CONSTANTS.FOUNDER_ADMIN_CAP_ID) {
      // Manually set for founder address
      console.log('Manually setting AdminCap for founder address');
      setHasAdminCap(true);
      setAdminCapId(CONTRACT_CONSTANTS.FOUNDER_ADMIN_CAP_ID);
    } else if (account?.address === CONTRACT_CONSTANTS.REVENUE_CONFIG.DEV_ADDRESS && CONTRACT_CONSTANTS.DEV_ADMIN_CAP_ID) {
      // Manually set for dev address
      console.log('Manually setting AdminCap for dev address');
      setHasAdminCap(true);
      setAdminCapId(CONTRACT_CONSTANTS.DEV_ADMIN_CAP_ID);
    } else {
      setHasAdminCap(false);
      setAdminCapId(null);
      console.log('No AdminCap found for address:', account?.address);
      console.log('AdminCap filter:', `${CONTRACT_CONSTANTS.PACKAGE_ID}::${CONTRACT_CONSTANTS.MODULE_NAME}::AdminCap`);
    }
  }, [adminCapData, account]);

  // Auto-refresh evolved stats and transfer policy every 30 seconds to keep royalty value updated
  useEffect(() => {
    if ((evolvedStatsData && refetchEvolvedStats) || (transferPolicyData && refetchTransferPolicy)) {
      const interval = setInterval(() => {
        console.log('Auto-refreshing stats...');
        if (refetchEvolvedStats) refetchEvolvedStats();
        if (refetchTransferPolicy) refetchTransferPolicy();
      }, 30000); // Refresh every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [evolvedStatsData, refetchEvolvedStats, transferPolicyData, refetchTransferPolicy]);

  useEffect(() => {
    console.log('EvolvedAdminCap query result:', evolvedAdminCapData);
    console.log('Current account:', account?.address);
    console.log('Is Founder:', account?.address === CONTRACT_CONSTANTS.REVENUE_CONFIG.FOUNDER_ADDRESS);
    console.log('Founder EvolvedAdminCap ID:', (CONTRACT_CONSTANTS as any).FOUNDER_EVOLVED_ADMIN_CAP_ID);
    
    if (evolvedAdminCapData?.data && evolvedAdminCapData.data.length > 0) {
      setHasEvolvedAdminCap(true);
      // Get the actual EvolvedAdminCap object ID
      const evolvedAdminCap = evolvedAdminCapData.data[0];
      setEvolvedAdminCapId(evolvedAdminCap.data?.objectId || null);
      console.log('Found EvolvedAdminCap from query:', evolvedAdminCap.data?.objectId);
    } else if (account?.address === CONTRACT_CONSTANTS.REVENUE_CONFIG.FOUNDER_ADDRESS && (CONTRACT_CONSTANTS as any).FOUNDER_EVOLVED_ADMIN_CAP_ID) {
      // Manually set for founder address
      console.log('Manually setting EvolvedAdminCap for founder address');
      setHasEvolvedAdminCap(true);
      setEvolvedAdminCapId((CONTRACT_CONSTANTS as any).FOUNDER_EVOLVED_ADMIN_CAP_ID);
    } else if (account?.address === CONTRACT_CONSTANTS.REVENUE_CONFIG.DEV_ADDRESS && CONTRACT_CONSTANTS.EVOLVED_ADMIN_CAP_ID) {
      // Manually set for dev address
      console.log('Manually setting EvolvedAdminCap for dev address');
      setHasEvolvedAdminCap(true);
      setEvolvedAdminCapId(CONTRACT_CONSTANTS.EVOLVED_ADMIN_CAP_ID);
    } else {
      console.log('No EvolvedAdminCap found or set');
      setHasEvolvedAdminCap(false);
      setEvolvedAdminCapId(null);
    }
  }, [evolvedAdminCapData, account]);

  // Check if current account is authorized
  const isFounder = account?.address === CONTRACT_CONSTANTS.REVENUE_CONFIG.FOUNDER_ADDRESS;
  const isDev = account?.address === CONTRACT_CONSTANTS.REVENUE_CONFIG.DEV_ADDRESS;
  const isDeployer = account?.address === CONTRACT_CONSTANTS.REVENUE_CONFIG.DEPLOYER_ADDRESS;

  if (!account || (!hasAdminCap && !isFounder && !isDev && !isDeployer)) {
    return null;
  }

  const content = statsData?.data?.content;
  const stats: any = content && 'fields' in content ? content.fields : {};
  // Get pool balances for v2 contract
  const devPoolBalance = stats.dev_pool || '0';
  const founderPoolBalance = stats.founder_pool || '0';
  const devPoolInSui = Number(devPoolBalance) / 1_000_000_000;
  const founderPoolInSui = Number(founderPoolBalance) / 1_000_000_000;
  const totalFeesInSui = devPoolInSui + founderPoolInSui;
  const artifactsMinted = stats.artifacts_minted || '0';
  const artifactsBurned = stats.artifacts_burned || '0';
  const evolvedMinted = stats.evolved_minted || '0';
  
  // Also get evolved stats directly if available
  const evolvedContent = evolvedStatsData?.data?.content;
  const evolvedStatsFields: any = evolvedContent && 'fields' in evolvedContent ? evolvedContent.fields : {};
  const actualEvolvedMinted = evolvedStatsFields.evolved_minted || evolvedMinted;
  const level10Burns = stats.level_10_burns || '0';
  
  // Extract royalty fees from Transfer Policy instead of evolved stats
  const transferPolicyContent = transferPolicyData?.data?.content;
  const transferPolicyFields: any = transferPolicyContent && 'fields' in transferPolicyContent ? transferPolicyContent.fields : {};
  // Handle both string and number balance values
  const transferPolicyBalance = transferPolicyFields.balance || transferPolicyFields.Balance || '0';
  const balanceValue = typeof transferPolicyBalance === 'object' ? '0' : String(transferPolicyBalance);
  const royaltyFeesInSui = isNaN(Number(balanceValue)) ? 0 : Number(balanceValue) / 1_000_000_000;
  
  // Debug logging
  console.log('=== ROYALTY DEBUG ===');
  console.log('Transfer Policy Data:', transferPolicyData);
  console.log('Transfer Policy Content:', transferPolicyContent);
  console.log('Transfer Policy Fields:', transferPolicyFields);
  console.log('Transfer Policy Balance Raw:', transferPolicyBalance);
  console.log('Balance Value:', balanceValue);
  console.log('Royalty fees in SUI:', royaltyFeesInSui);
  console.log('Transfer Policy ID:', CONTRACT_CONSTANTS.TRANSFER_POLICY_ID);
  console.log('Button should be enabled:', royaltyFeesInSui > 0);
  console.log('===================');

  const handleWithdrawFees = async () => {
    if (!isFounder || founderPoolInSui <= 0) return;

    setIsWithdrawing(true);
    try {
      const tx = new Transaction();
      
      console.log('Founder withdrawal - GlobalStats ID:', CONTRACT_CONSTANTS.GLOBAL_STATS_ID);
      console.log('Founder withdrawal - Package ID:', CONTRACT_CONSTANTS.PACKAGE_ID);
      console.log('Founder withdrawal - Module:', CONTRACT_CONSTANTS.MODULE_NAME);
      console.log('Founder withdrawal - Account:', account.address);
      
      // For founder withdrawal - no AdminCap needed, just founder address
      tx.moveCall({
        target: `${CONTRACT_CONSTANTS.PACKAGE_ID}::${CONTRACT_CONSTANTS.MODULE_NAME}::withdraw_founder_pool`,
        arguments: [
          tx.object(CONTRACT_CONSTANTS.GLOBAL_STATS_ID),
        ],
      });

      // Set gas budget for withdrawal transaction
      tx.setGasBudget(2000000000); // 2 SUI

      const result = await signAndExecute({
        transaction: tx,
      });

      console.log('Founder withdrawal successful:', result);
      
      if (result.digest) {
        alert(`Founder pool withdrawal successful! Transaction: ${result.digest}\n\nView on explorer: https://suivision.xyz/txblock/${result.digest}`);
      }
      
      // Refresh stats with delay
      setTimeout(async () => {
        await refetchStats();
      }, 2000);
    } catch (error) {
      console.error('Founder withdrawal failed:', error);
      alert(`Founder withdrawal failed: ${error}`);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleWithdrawDevFees = async () => {
    if (!isDev || devPoolInSui <= 0) return;

    setIsWithdrawing(true);
    try {
      const tx = new Transaction();

      console.log('Dev withdrawal - GlobalStats ID:', CONTRACT_CONSTANTS.GLOBAL_STATS_ID);
      console.log('Dev withdrawal - Package ID:', CONTRACT_CONSTANTS.PACKAGE_ID);
      console.log('Dev withdrawal - Module:', CONTRACT_CONSTANTS.MODULE_NAME);
      console.log('Dev withdrawal - Account:', account.address);

      // For dev withdrawal - no AdminCap needed, just dev address
      tx.moveCall({
        target: `${CONTRACT_CONSTANTS.PACKAGE_ID}::${CONTRACT_CONSTANTS.MODULE_NAME}::withdraw_dev_pool`,
        arguments: [
          tx.object(CONTRACT_CONSTANTS.GLOBAL_STATS_ID),
        ],
      });

      // Set gas budget for withdrawal transaction
      tx.setGasBudget(2000000000); // 2 SUI

      const result = await signAndExecute({
        transaction: tx,
      });

      console.log('Dev withdrawal successful:', result);
      
      if (result.digest) {
        alert(`Dev pool withdrawal successful! Transaction: ${result.digest}\n\nView on explorer: https://suivision.xyz/txblock/${result.digest}`);
      }
      
      // Refresh stats with delay
      setTimeout(async () => {
        await refetchStats();
      }, 2000);
    } catch (error) {
      console.error('Dev withdrawal failed:', error);
      alert(`Dev withdrawal failed: ${error}`);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleWithdrawRoyalties = async () => {
    if (!account || !CONTRACT_CONSTANTS.TRANSFER_POLICY_ID || !CONTRACT_CONSTANTS.TRANSFER_POLICY_CAP_ID) {
      alert('Missing requirements: Transfer Policy or TransferPolicyCap not found');
      return;
    }

    // Check if user owns the TransferPolicyCap
    const hasTransferPolicyCap = account.address === CONTRACT_CONSTANTS.REVENUE_CONFIG.FOUNDER_ADDRESS || 
                                 account.address === CONTRACT_CONSTANTS.REVENUE_CONFIG.DEV_ADDRESS ||
                                 account.address === CONTRACT_CONSTANTS.REVENUE_CONFIG.DEPLOYER_ADDRESS;
    
    if (!hasTransferPolicyCap) {
      alert('You need to own the TransferPolicyCap to withdraw royalties');
      return;
    }

    // Get the balance from the Transfer Policy
    const policyContent = transferPolicyData?.data?.content;
    const balance = (policyContent && 'fields' in policyContent) 
      ? (policyContent.fields as any)?.balance || '0'
      : '0';
    
    if (balance === '0') {
      alert('No royalties available to withdraw');
      return;
    }

    setIsWithdrawingRoyalties(true);
    try {
      console.log('Royalty withdrawal - Transfer Policy ID:', CONTRACT_CONSTANTS.TRANSFER_POLICY_ID);
      console.log('Royalty withdrawal - TransferPolicyCap ID:', CONTRACT_CONSTANTS.TRANSFER_POLICY_CAP_ID);
      console.log('Royalty withdrawal - Account:', account.address);
      console.log('Royalty withdrawal - Balance:', balance);
      console.log('Royalty withdrawal - Amount:', royaltyFeesInSui, 'SUI');

      const tx = new Transaction();

      // Construct Option::None to withdraw all funds
      // Using the proper format for Option in Sui
      const [withdrawnCoin] = tx.moveCall({
        target: `0x2::transfer_policy::withdraw`,
        typeArguments: [CONTRACT_CONSTANTS.TYPES.EVOLVED_SUDOZ],
        arguments: [
          tx.object(CONTRACT_CONSTANTS.TRANSFER_POLICY_ID),
          tx.object(CONTRACT_CONSTANTS.TRANSFER_POLICY_CAP_ID),
          tx.pure.option('u64', undefined) // Option::None to withdraw all
        ],
      });

      // Transfer to the current account
      tx.transferObjects([withdrawnCoin], account.address);

      // Set gas budget
      tx.setGasBudget(10000000); // 0.01 SUI

      const result = await signAndExecute({
        transaction: tx,
      });

      console.log('Royalty withdrawal successful:', result);
      
      if (result.digest) {
        alert(`Royalty withdrawal successful! Transaction: ${result.digest}\n\nAmount: ${royaltyFeesInSui} SUI\n\nView on explorer: https://suivision.xyz/txblock/${result.digest}`);
      }
      
      // Refresh stats with delay
      setTimeout(async () => {
        if (refetchTransferPolicy) await refetchTransferPolicy();
        if (refetchEvolvedStats) await refetchEvolvedStats();
      }, 2000);
    } catch (error) {
      console.error('Royalty withdrawal failed:', error);
      alert(`Royalty withdrawal failed: ${error}`);
    } finally {
      setIsWithdrawingRoyalties(false);
    }
  };

  const handleMintArtifact = async () => {
    if (!hasAdminCap || !adminCapId || !account) {
      alert('Missing requirements: AdminCap or account not found');
      return;
    }

    setIsMinting(true);
    try {
      const tx = new Transaction();

      const target = `${CONTRACT_CONSTANTS.PACKAGE_ID}::${CONTRACT_CONSTANTS.MODULE_NAME}::${CONTRACT_CONSTANTS.FUNCTIONS.MINT_ARTIFACT}`;
      console.log('Target:', target);
      console.log('AdminCap:', adminCapId);
      console.log('Account:', account.address);
      console.log('GlobalStats:', CONTRACT_CONSTANTS.GLOBAL_STATS_ID);

      tx.moveCall({
        target,
        arguments: [
          tx.object(adminCapId),
          tx.pure.address(account.address),
          tx.object(CONTRACT_CONSTANTS.GLOBAL_STATS_ID),
        ],
      });

      // Set gas budget for mint transaction
      tx.setGasBudget(2000000000); // 2 SUI

      const result = await signAndExecute({
        transaction: tx,
      });

      console.log('Mint result:', result);
      console.log('Transaction digest:', result.digest);
      
      // The result structure from dapp-kit is different
      if (result.digest) {
        // Transaction was submitted successfully
        console.log('Transaction submitted successfully');
        alert(`NFT minted successfully! Transaction: ${result.digest}\n\nView on explorer: https://suivision.xyz/txblock/${result.digest}`);
        
        // Also log the effects if available
        if (result.effects) {
          console.log('Effects:', result.effects);
        }
      } else {
        console.error('Transaction may have failed:', result);
        alert('Transaction may have failed. Check console for details.');
      }
      
      // Trigger a refetch with longer delay
      setTimeout(() => {
        window.dispatchEvent(new Event('nft-updated'));
      }, 2000);
      
      // Refresh stats
      await refetchStats();
    } catch (error: any) {
      console.error('Mint failed:', error);
      alert(`Mint failed: ${error.message || error}`);
    } finally {
      setIsMinting(false);
    }
  };

  const handleMintOneOfOne = async () => {
    if (!hasEvolvedAdminCap || !evolvedAdminCapId || !account || !CONTRACT_CONSTANTS.EVOLVED_STATS_ID) return;

    setIsMintingDevReserve(true);
    try {
      // Fetch metadata and traits from IPFS for the selected 1/1
      const metadataUrl = `https://ipfs.io/ipfs/bafybeic7ymazpspv6ojxwrr6rqu3glnrtzbj3ej477nowr73brmb4hkkka/metadata/${selectedOneOfOne}.json`;
      const response = await fetch(metadataUrl);
      const metadata = await response.json();
      
      // Extract traits from metadata
      const traitsMap = new Map<string, string>();
      metadata.attributes.forEach((attr: any) => {
        traitsMap.set(attr.trait_type.toLowerCase(), attr.value);
      });
      
      const traits = {
        background: traitsMap.get('background') || 'AI Generated',
        skin: traitsMap.get('skin') || '1/1 Exclusive',
        clothes: traitsMap.get('clothes') || 'Special Edition',
        hats: traitsMap.get('hats') || 'One of One',
        eyewear: traitsMap.get('eyewear') || 'Unique',
        mouth: traitsMap.get('mouth') || 'Limited',
        earrings: traitsMap.get('earrings') || 'AI 1/1S',
      };

      const tx = new Transaction();
      
      // Ensure kiosk exists (create if needed)
      const kioskInfo = await ensureKiosk(client, account.address, tx);
      
      // Always use kiosk version with all trait parameters
      tx.moveCall({
        target: `${CONTRACT_CONSTANTS.PACKAGE_ID}::${CONTRACT_CONSTANTS.EVOLVED_MODULE_NAME}::${CONTRACT_CONSTANTS.FUNCTIONS.MINT_DEVELOPER_RESERVE_TO_KIOSK}`,
        arguments: [
          tx.object(evolvedAdminCapId),
          kioskInfo.kioskId,  // Already wrapped by ensureKiosk
          kioskInfo.kioskCap, // Already wrapped by ensureKiosk
          tx.pure.u64(selectedOneOfOne),
          tx.pure.string(traits.background),
          tx.pure.string(traits.skin),
          tx.pure.string(traits.clothes),
          tx.pure.string(traits.hats),
          tx.pure.string(traits.eyewear),
          tx.pure.string(traits.mouth),
          tx.pure.string(traits.earrings),
          tx.object(CONTRACT_CONSTANTS.EVOLVED_STATS_ID),
        ],
      });
      
      if (kioskInfo.isNew) {
        console.log('Creating new kiosk and minting 1/1 NFT');
        // Share the kiosk AFTER using it in mint
        tx.moveCall({
          target: '0x2::transfer::public_share_object',
          arguments: [kioskInfo.kioskId],
          typeArguments: ['0x2::kiosk::Kiosk'],
        });
        
        // Transfer cap to user
        tx.moveCall({
          target: '0x2::transfer::public_transfer',
          arguments: [kioskInfo.kioskCap, tx.pure.address(account.address)],
          typeArguments: ['0x2::kiosk::KioskOwnerCap'],
        });
      } else {
        console.log('Minting 1/1 to existing kiosk');
      }

      // Set gas budget for evolved mint transaction
      tx.setGasBudget(2000000000); // 2 SUI

      const result = await signAndExecute({
        transaction: tx,
      });

      console.log('1/1 mint successful:', result);
      
      // Trigger a refetch
      setTimeout(() => {
        window.dispatchEvent(new Event('nft-updated'));
      }, 1000);
      
      // Refresh evolved stats
      if (refetchEvolvedStats) {
        await refetchEvolvedStats();
        console.log('Evolved stats refetched after 1/1 mint');
      }
    } catch (error) {
      console.error('1/1 mint failed:', error);
    } finally {
      setIsMintingDevReserve(false);
    }
  };


  const handleMintRandomBatch = async () => {
    if (!hasEvolvedAdminCap || !evolvedAdminCapId || !account || !CONTRACT_CONSTANTS.EVOLVED_STATS_ID) return;

    setIsMintingDevReserve(true);
    try {
      // Step 1: Get available metadata IDs from contract
      const evolvedStatsObj = await client.getObject({
        id: CONTRACT_CONSTANTS.EVOLVED_STATS_ID,
        options: { showContent: true }
      });
      
      const availableIds = (evolvedStatsObj.data?.content as any)?.fields?.available_metadata_ids || [];
      
      if (availableIds.length === 0) {
        alert('No metadata IDs available!');
        return;
      }
      
      // Step 2: Select a random metadata ID
      const randomMetadataId = availableIds[Math.floor(Math.random() * availableIds.length)];
      
      // Step 3: Fetch metadata and traits from IPFS
      const metadataUrl = `https://ipfs.io/ipfs/bafybeic7ymazpspv6ojxwrr6rqu3glnrtzbj3ej477nowr73brmb4hkkka/metadata/${randomMetadataId}.json`;
      const response = await fetch(metadataUrl);
      const metadata = await response.json();
      
      // Step 4: Extract traits from metadata
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
      
      console.log(`Minting random NFT with metadata ID: ${randomMetadataId}`, traits);
      
      const tx = new Transaction();
      
      // Ensure kiosk exists (create if needed)
      const kioskInfo = await ensureKiosk(client, account.address, tx);
      
      // Use mint_developer_reserve_to_kiosk with traits - same as evolution!
      tx.moveCall({
        target: `${CONTRACT_CONSTANTS.PACKAGE_ID}::${CONTRACT_CONSTANTS.EVOLVED_MODULE_NAME}::${CONTRACT_CONSTANTS.FUNCTIONS.MINT_DEVELOPER_RESERVE_TO_KIOSK}`,
        arguments: [
          tx.object(evolvedAdminCapId),
          kioskInfo.kioskId,  // Already wrapped by ensureKiosk
          kioskInfo.kioskCap, // Already wrapped by ensureKiosk
          tx.pure.u64(randomMetadataId),
          tx.pure.string(traits.background),
          tx.pure.string(traits.skin),
          tx.pure.string(traits.clothes),
          tx.pure.string(traits.hats),
          tx.pure.string(traits.eyewear),
          tx.pure.string(traits.mouth),
          tx.pure.string(traits.earrings),
          tx.object(CONTRACT_CONSTANTS.EVOLVED_STATS_ID),
        ],
      });
      
      if (kioskInfo.isNew) {
        console.log('Creating new kiosk and minting NFT');
        // Share the kiosk AFTER using it in mint
        tx.moveCall({
          target: '0x2::transfer::public_share_object',
          arguments: [kioskInfo.kioskId],
          typeArguments: ['0x2::kiosk::Kiosk'],
        });
        
        // Transfer cap to user
        tx.moveCall({
          target: '0x2::transfer::public_transfer',
          arguments: [kioskInfo.kioskCap, tx.pure.address(account.address)],
          typeArguments: ['0x2::kiosk::KioskOwnerCap'],
        });
      } else {
        console.log('Minting NFT to existing kiosk');
      }

      // Set gas budget for evolved mint transaction
      tx.setGasBudget(2000000000); // 2 SUI

      const result = await signAndExecute({
        transaction: tx,
      });

      console.log('Random NFT mint successful:', result);
      
      // Trigger a refetch
      setTimeout(() => {
        window.dispatchEvent(new Event('nft-updated'));
      }, 1000);
      
      // Refresh evolved stats
      if (refetchEvolvedStats) await refetchEvolvedStats();
    } catch (error) {
      console.error('Random NFT mint failed:', error);
    } finally {
      setIsMintingDevReserve(false);
    }
  };

  return (
    <div className="mb-8 bg-red-50 border-2 border-red-200 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4 text-black">Admin Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 shadow">
          <p className="text-sm text-gray-600">Artifacts Minted</p>
          <p className="text-2xl font-bold text-black">{artifactsMinted}/13,600</p>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow">
          <p className="text-sm text-gray-600">Artifacts Burned</p>
          <p className="text-2xl font-bold text-black">{artifactsBurned}</p>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow">
          <p className="text-sm text-gray-600">Evolved Minted</p>
          <p className="text-2xl font-bold text-black">{actualEvolvedMinted}/5,555</p>
          <p className="text-sm text-green-600 font-medium">
            {5555 - Number(actualEvolvedMinted)} left
          </p>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow">
          <p className="text-sm text-gray-600">Level 10 Burns</p>
          <p className="text-2xl font-bold text-black">{level10Burns}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 shadow">
        <h3 className="text-lg font-bold mb-4 text-black">Fee Management - Auto-Split Pools</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Founder Pool (85%)</p>
            <p className="text-2xl font-bold text-black">{founderPoolInSui.toFixed(4)} SUI</p>
            <p className="text-xs text-gray-500">Admin withdrawable</p>
          </div>
          
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Dev Pool (15%)</p>
            <p className="text-2xl font-bold text-black">{devPoolInSui.toFixed(4)} SUI</p>
            <p className="text-xs text-gray-500">Protected - Dev only</p>
          </div>
        </div>
        
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-600">Total Accumulated Fees</p>
            <p className="text-3xl font-bold text-black">{totalFeesInSui.toFixed(4)} SUI</p>
          </div>
          
          {isFounder && (
            <button
              onClick={handleWithdrawFees}
              disabled={isWithdrawing || founderPoolInSui === 0}
              className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 disabled:bg-gray-300 transition-colors font-medium"
            >
              {isWithdrawing ? 'Withdrawing...' : `Withdraw Founder Pool (${founderPoolInSui.toFixed(2)} SUI)`}
            </button>
          )}
          {!isFounder && !isDev && (
            <p className="text-sm text-gray-500">Only founder/dev addresses can withdraw</p>
          )}
        </div>
        
        {isDev && (
          <div className="mt-4">
            <button
              onClick={handleWithdrawDevFees}
              disabled={isWithdrawing || devPoolInSui === 0}
              className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition-colors font-medium w-full"
            >
              {isWithdrawing ? 'Withdrawing...' : `Withdraw Dev Pool (${devPoolInSui.toFixed(2)} SUI)`}
            </button>
          </div>
        )}
        
        <p className="text-sm text-gray-500 mt-4">
          {isFounder && "You can withdraw the founder's 85% share."}
          {isDev && "You can withdraw the dev's 15% share."}
          {!isFounder && !isDev && "Only authorized addresses can withdraw from their respective pools."}
        </p>
      </div>

      <div className="bg-white rounded-lg p-6 shadow mt-6">
        <h3 className="text-lg font-bold mb-4 text-black">Mint NFTs</h3>
        
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-600">Mint SUDOZ Artifacts</p>
            <p className="text-sm text-gray-500">Current supply: {artifactsMinted}/13,600</p>
          </div>
          
          <button
            onClick={handleMintArtifact}
            disabled={isMinting || Number(artifactsMinted) >= 13600}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition-colors font-medium"
          >
            {isMinting ? 'Minting...' : 'Mint Artifact'}
          </button>
        </div>
      </div>

      {(hasEvolvedAdminCap || isFounder || isDev) && CONTRACT_CONSTANTS.EVOLVED_STATS_ID && (
        <div className="bg-white rounded-lg p-6 shadow mt-6">
          <h3 className="text-lg font-bold mb-4 text-black">Developer Reserve - THE SUDOZ Collection</h3>
          <p className="text-sm text-gray-600 mb-2">
            Total Reserve: 280 NFTs (250 Founder + 30 Dev)
          </p>
          {isFounder && (
            <p className="text-sm font-medium text-purple-700 mb-2">
              👑 Founder: 250 NFTs (includes 10 x 1/1s)
            </p>
          )}
          {isDev && (
            <p className="text-sm font-medium text-blue-700 mb-4">
              🛠️ Developer: 30 NFTs
            </p>
          )}
          
          <div className="space-y-6">
            {/* 1/1 NFTs Section */}
            <div className="border-b pb-4">
              <h4 className="font-medium mb-3 text-black">Mint Specific 1/1 NFTs (Founder Reserve)</h4>
              <p className="text-sm text-gray-600 mb-3">10 specific rare NFTs - Part of founder's 250 allocation</p>
              
              <div className="flex items-center space-x-4 mb-3">
                <select
                  value={selectedOneOfOne}
                  onChange={(e) => setSelectedOneOfOne(Number(e.target.value))}
                  className="px-3 py-2 border rounded-lg"
                  disabled={isMintingDevReserve}
                >
                  {CONTRACT_CONSTANTS.ONE_OF_ONE_IDS.map((id) => (
                    <option key={id} value={id}>
                      Metadata ID: {id}
                    </option>
                  ))}
                </select>
                
                <button
                  onClick={handleMintOneOfOne}
                  disabled={isMintingDevReserve}
                  className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 disabled:bg-gray-300 transition-colors"
                >
                  {isMintingDevReserve ? 'Minting...' : 'Mint Selected 1/1'}
                </button>
              </div>
            </div>
            
            {/* Random NFTs Section */}
            <div>
              <h4 className="font-medium mb-3 text-black">Mint Random NFTs</h4>
              <p className="text-sm text-gray-600 mb-3">270 random NFTs from the remaining pool</p>
              
              <button
                onClick={handleMintRandomBatch}
                disabled={isMintingDevReserve}
                className="bg-indigo-500 text-white px-6 py-2 rounded-lg hover:bg-indigo-600 disabled:bg-gray-300 transition-colors"
              >
                {isMintingDevReserve ? 'Minting...' : 'Mint 1 Random NFT'}
              </button>
              
              <p className="text-xs text-gray-500 mt-2">
                Note: NFTs are minted one at a time. For 270 NFTs, you'll need 270 transactions.
              </p>
            </div>
            
            {/* Evolved Stats */}
            {evolvedStatsData && (
              <div className="bg-gray-50 rounded-lg p-4 mt-4">
                <h4 className="font-medium mb-2 text-black">Evolved Collection Stats</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Total Evolved Minted</p>
                    <p className="font-bold text-black">
                      {(() => {
                        const count = evolvedStatsData.data?.content && 'fields' in evolvedStatsData.data.content 
                          ? (evolvedStatsData.data.content.fields as any).evolved_minted || '0' 
                          : '0';
                        return count;
                      })()} / {CONTRACT_CONSTANTS.EVOLVED_SUPPLY}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Available Metadata IDs</p>
                    <p className="font-bold text-black">
                      {evolvedStatsData.data?.content && 'fields' in evolvedStatsData.data.content 
                        ? (evolvedStatsData.data.content.fields as any).available_metadata_ids?.length || '0' 
                        : '0'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Royalty Fees Section */}
      {(isFounder || isDev || isDeployer) && CONTRACT_CONSTANTS.TRANSFER_POLICY_ID && (
        <div className="bg-white rounded-lg p-6 shadow mt-6">
          <h3 className="text-lg font-bold mb-4 text-black">THE SUDOZ Collection Royalties (Transfer Policy)</h3>
          
          <div className="bg-purple-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-600">Accumulated Royalty Fees (3% from marketplace sales)</p>
            <p className="text-2xl font-bold text-black">{(royaltyFeesInSui || 0).toFixed(4)} SUI</p>
            <p className="text-xs text-gray-500 mt-1">
              Royalties from Transfer Policy (ID: {CONTRACT_CONSTANTS.TRANSFER_POLICY_ID.slice(0, 6)}...{CONTRACT_CONSTANTS.TRANSFER_POLICY_ID.slice(-4)})
            </p>
            <p className="text-xs text-gray-500">
              These are marketplace royalties enforced by Sui's Transfer Policy system
            </p>
          </div>
          
          <button
            onClick={handleWithdrawRoyalties}
            disabled={isWithdrawingRoyalties || royaltyFeesInSui === 0}
            className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 disabled:bg-gray-300 transition-colors font-medium w-full"
          >
            {isWithdrawingRoyalties ? 'Withdrawing...' : `Withdraw All Royalties (${royaltyFeesInSui.toFixed(2)} SUI)`}
          </button>
          
          <p className="text-sm text-gray-500 mt-4">
            Note: Only the holder of the TransferPolicyCap can withdraw royalties. Royalties are collected from marketplace sales 
            when NFTs are traded with the transfer policy enforced (3% of sale price).
          </p>
        </div>
      )}

      <div className="mt-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
        <p className="font-bold">Admin Notice:</p>
        <p className="text-sm">You are logged in as an admin. Only accounts with AdminCap can see this section and withdraw fees.</p>
      </div>
    </div>
  );
}