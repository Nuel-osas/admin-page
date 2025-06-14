// Updated handleMintOneOfOne function with trait fetching
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
    
    // Call with all required parameters including traits
    tx.moveCall({
      target: `${CONTRACT_CONSTANTS.PACKAGE_ID}::${CONTRACT_CONSTANTS.EVOLVED_MODULE_NAME}::${CONTRACT_CONSTANTS.FUNCTIONS.MINT_DEVELOPER_RESERVE_TO_KIOSK}`,
      arguments: [
        tx.object(evolvedAdminCapId),
        kioskInfo.kioskId,
        kioskInfo.kioskCap,
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

// For random batch minting, the contract doesn't require traits
// but we should update it anyway for consistency
const handleMintRandomBatch = async () => {
  if (!hasEvolvedAdminCap || !evolvedAdminCapId || !account || !CONTRACT_CONSTANTS.EVOLVED_STATS_ID) return;

  setIsMintingRandomBatch(true);
  try {
    const tx = new Transaction();
    
    // Ensure kiosk exists
    const kioskInfo = await ensureKiosk(client, account.address, tx);
    
    // Note: mint_developer_reserve_batch_to_kiosk doesn't require trait parameters
    // The contract uses "Unknown" for all traits for random mints
    tx.moveCall({
      target: `${CONTRACT_CONSTANTS.PACKAGE_ID}::${CONTRACT_CONSTANTS.EVOLVED_MODULE_NAME}::${CONTRACT_CONSTANTS.FUNCTIONS.MINT_DEVELOPER_RESERVE_BATCH_TO_KIOSK}`,
      arguments: [
        tx.object(evolvedAdminCapId),
        kioskInfo.kioskId,
        kioskInfo.kioskCap,
        tx.object(CONTRACT_CONSTANTS.TRANSFER_POLICY_ID),
        tx.pure.u64(1), // Fixed batch size of 1
        tx.object(CONTRACT_CONSTANTS.EVOLVED_STATS_ID),
        tx.object(CONTRACT_CONSTANTS.RANDOM_OBJECT_ID),
      ],
    });
    
    tx.setGasBudget(5000000000); // 5 SUI for batch

    const result = await signAndExecute({
      transaction: tx,
    });

    console.log('Random batch mint successful:', result);
    
    setTimeout(() => {
      window.dispatchEvent(new Event('nft-updated'));
    }, 1000);
    
    if (refetchEvolvedStats) {
      await refetchEvolvedStats();
    }
  } catch (error) {
    console.error('Random batch mint failed:', error);
  } finally {
    setIsMintingRandomBatch(false);
  }
};