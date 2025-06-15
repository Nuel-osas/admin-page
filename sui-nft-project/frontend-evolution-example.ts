// Example of how to handle evolution in the frontend with metadata selection

import { TransactionBlock } from '@mysten/sui.js/transactions';

interface EvolvedMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
}

// Fetch metadata from IPFS and extract traits
async function fetchEvolvedMetadata(metadataId: number): Promise<{
  metadata: EvolvedMetadata;
  traits: {
    background: string;
    skin: string;
    clothes: string;
    hats: string;
    eyewear: string;
    mouth: string;
    earrings: string;
  };
}> {
  const metadataUrl = `https://ipfs.io/ipfs/bafybeic7ymazpspv6ojxwrr6rqu3glnrtzbj3ej477nowr73brmb4hkkka/metadata/${metadataId}.json`;
  
  const response = await fetch(metadataUrl);
  const metadata: EvolvedMetadata = await response.json();
  
  // Extract traits from attributes
  const traitsMap = new Map<string, string>();
  metadata.attributes.forEach(attr => {
    traitsMap.set(attr.trait_type.toLowerCase(), attr.value);
  });
  
  return {
    metadata,
    traits: {
      background: traitsMap.get('background') || 'Unknown',
      skin: traitsMap.get('skin') || 'Unknown',
      clothes: traitsMap.get('clothes') || 'Unknown',
      hats: traitsMap.get('hats') || 'Unknown',
      eyewear: traitsMap.get('eyewear') || 'Unknown',
      mouth: traitsMap.get('mouth') || 'Unknown',
      earrings: traitsMap.get('earrings') || 'Unknown',
    }
  };
}

// Get available metadata IDs from the contract
async function getAvailableMetadataIds(
  suiClient: any,
  evolvedStatsId: string
): Promise<number[]> {
  const stats = await suiClient.getObject({
    id: evolvedStatsId,
    options: { showContent: true }
  });
  
  const content = stats.data?.content as any;
  return content?.fields?.available_metadata_ids || [];
}

// Main evolution function
export async function evolveArtifact(
  artifact: any,
  suiClient: any,
  signAndExecuteTransaction: any,
  packageId: string,
  globalStatsId: string,
  evolvedStatsId: string
) {
  try {
    // Step 1: Get available metadata IDs
    const availableIds = await getAvailableMetadataIds(suiClient, evolvedStatsId);
    
    if (availableIds.length === 0) {
      throw new Error('No evolved NFTs available');
    }
    
    // Step 2: Let user select or randomly pick a metadata ID
    // For this example, we'll randomly select one
    const selectedMetadataId = availableIds[Math.floor(Math.random() * availableIds.length)];
    
    // Step 3: Fetch the metadata and traits for the selected ID
    const { metadata, traits } = await fetchEvolvedMetadata(selectedMetadataId);
    
    // Step 4: Show preview to user (optional)
    console.log(`Evolving to: ${metadata.name}`);
    console.log('Traits:', traits);
    
    // Step 5: Execute the evolution transaction
    const tx = new TransactionBlock();
    
    tx.moveCall({
      target: `${packageId}::sudoz_artifacts_v2::entry_evolve_artifact`,
      arguments: [
        tx.object(artifact.id),
        tx.object(globalStatsId),
        tx.object(evolvedStatsId),
        tx.object('0x8'), // Random object
        tx.pure(selectedMetadataId, 'u64'), // Pass the selected metadata ID
        tx.pure(traits.background, 'string'),
        tx.pure(traits.skin, 'string'),
        tx.pure(traits.clothes, 'string'),
        tx.pure(traits.hats, 'string'),
        tx.pure(traits.eyewear, 'string'),
        tx.pure(traits.mouth, 'string'),
        tx.pure(traits.earrings, 'string'),
      ],
    });
    
    const result = await signAndExecuteTransaction({
      transaction: tx,
      options: {
        showObjectChanges: true,
        showEffects: true,
      },
    });
    
    return {
      result,
      selectedMetadataId,
      metadata,
      traits
    };
    
  } catch (error) {
    console.error('Evolution failed:', error);
    throw error;
  }
}

// Alternative: Let user browse and select evolved NFT
export async function browseEvolvedOptions(
  evolvedStatsId: string,
  suiClient: any,
  limit: number = 10
): Promise<Array<{
  metadataId: number;
  metadata: EvolvedMetadata;
  traits: any;
  preview: string;
}>> {
  const availableIds = await getAvailableMetadataIds(suiClient, evolvedStatsId);
  
  // Take a sample of available IDs
  const sampleIds = availableIds
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(limit, availableIds.length));
  
  const options = await Promise.all(
    sampleIds.map(async (metadataId) => {
      const { metadata, traits } = await fetchEvolvedMetadata(metadataId);
      return {
        metadataId,
        metadata,
        traits,
        preview: `https://ipfs.io/ipfs/bafybeic7ymazpspv6ojxwrr6rqu3glnrtzbj3ej477nowr73brmb4hkkka/nfts/${metadataId}.webp`
      };
    })
  );
  
  return options;
}