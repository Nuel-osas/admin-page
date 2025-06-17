// Revenue split configuration
export const REVENUE_CONFIG = {
  DEV_PERCENTAGE: 15,
  FOUNDER_PERCENTAGE: 85,
  DEV_ADDRESS: '0x9a5b0ad3a18964ab7c0dbf9ab4cdecfd6b3899423b47313ae6e78f4b801022a3',
  FOUNDER_ADDRESS: '0x21221a34eb06d78b16ef4553572e228970f2972385b1d3feab68cfc80090f430',
  // Add deployer address for testing
  DEPLOYER_ADDRESS: '0x4822bfc9c86d1a77daf48b0bdf8f012ae9b7f8f01b4195dc0f3fd4fb838525bd',
};

export const CONTRACT_CONSTANTS = {
  // MAINNET Deployment - 2025-06-14
  PACKAGE_ID: '0x5c67326d96aa593599722a174b1f358036f3b6ee3a42eccf3065aa02d9ecc666',
  ADMIN_CAP_ID: '0xf3c1995e5d77f75e9350369285a93d13c038a4019d91a508ef4375b31ca9f886', // Dev AdminCap
  DEV_ADMIN_CAP_ID: '0xf3c1995e5d77f75e9350369285a93d13c038a4019d91a508ef4375b31ca9f886', // Dev AdminCap
  FOUNDER_ADMIN_CAP_ID: '0x1321544ceac5fce3f8837de4f7e8384ed17cfae5d2c352df8f013572d5924ee9', // Founder AdminCap
  GLOBAL_STATS_ID: '0x788140e00a029ec80fbbce02592ddeb18696207af57cc3062fe8d629be608c45', // GlobalStats
  RANDOM_OBJECT_ID: '0x8',
  MODULE_NAME: 'sudoz_artifacts_v2',
  EVOLVED_MODULE_NAME: 'evolved_sudoz',
  
  // EVOLVED SUDOZ Contract IDs - MAINNET
  EVOLVED_ADMIN_CAP_ID: '0xe44533f1edf53af5f8badb6fbedb6ec751e70b935997f264414a931a5d82d5a7', // Dev EvolvedAdminCap
  FOUNDER_EVOLVED_ADMIN_CAP_ID: '0xe44533f1edf53af5f8badb6fbedb6ec751e70b935997f264414a931a5d82d5a7', // Founder EvolvedAdminCap
  EVOLVED_STATS_ID: '0x286e8100bf52f8fd0b5992bad1dbb8b5ee71e0dfc48eed8ac285563d65e7a02d', // EvolvedStats
  TRANSFER_POLICY_ID: '0x42fee34d5e843199096ae25d571a14eb4907000fdd431de45387b9cb21ca3452', // TransferPolicy
  TRANSFER_POLICY_CAP_ID: '0x41fa50d362073d1baf03267647e9c8cfcc5460f7aef1435a9d26d9c882694405', // TransferPolicyCap
  EVOLUTION_AUTH_ID: '0xdb95f7f4d0d7ac124eb9633fd0bbb664c9193ab93ae78074580aed311ce9c53d', // EvolutionAuth
  
  // Revenue configuration
  REVENUE_CONFIG: REVENUE_CONFIG,
  
  // Function names
  FUNCTIONS: {
    MINT_ARTIFACT: 'mint_artifact',
    BATCH_MINT_ARTIFACTS: 'batch_mint_artifacts',
    UPGRADE_LEVEL: 'entry_upgrade_level',
    UPGRADE_TO_LEVEL: 'entry_upgrade_to_level',
    UPGRADE_TO_LEVEL_10: 'upgrade_to_level_10',
    EVOLVE_ARTIFACT: 'entry_evolve_artifact',
    EVOLVE_ARTIFACT_WITH_POLICY: 'entry_evolve_artifact_with_policy',
    EVOLVE_ARTIFACT_TO_KIOSK: 'evolve_artifact_to_kiosk',
    GET_LEVEL: 'get_level',
    GET_POINTS: 'get_points',
    GET_NAME: 'get_name',
    GET_PATH: 'get_path',
    WITHDRAW_UPGRADE_FEES: 'withdraw_upgrade_fees',
    // Evolved module functions
    MINT_DEVELOPER_RESERVE_SPECIFIC: 'mint_developer_reserve_specific',
    MINT_DEVELOPER_RESERVE_BATCH: 'mint_developer_reserve_batch',
    MINT_DEVELOPER_RESERVE_ONE_OF_ONES: 'mint_developer_reserve_one_of_ones',
    MINT_DEVELOPER_RESERVE_TO_KIOSK: 'mint_developer_reserve_to_kiosk',
    MINT_AND_LOCK_TO_KIOSK: 'mint_and_lock_to_kiosk',
    MINT_ONE_OF_ONES_TO_KIOSK: 'mint_one_of_ones_to_kiosk',
    MINT_DEVELOPER_RESERVE_BATCH_TO_KIOSK: 'mint_developer_reserve_batch_to_kiosk',
    // Kiosk functions
    PLACE_IN_KIOSK: 'place_in_kiosk',
    LIST_FOR_SALE: 'list_for_sale',
    PURCHASE_FROM_KIOSK: 'purchase_from_kiosk',
    DELIST_FROM_KIOSK: 'delist_from_kiosk',
    TAKE_FROM_KIOSK: 'take_from_kiosk',
  },
  
  // Type names (will be set below)
  TYPES: {
    SUDOZ_ARTIFACT: '',
    EVOLVED_SUDOZ: '',
  },
  
  // Constants
  UPGRADE_COST_PER_LEVEL: 1_000_000_000, // 1 SUI in MIST
  MAX_LEVEL: 10,
  ARTIFACT_SUPPLY: 13600,
  EVOLVED_SUPPLY: 5555,
  DEVELOPER_RESERVE_TOTAL: 280,
  FOUNDER_RESERVE: 250, // Founder's allocation (includes 1/1s)
  DEV_RESERVE: 30, // Dev's allocation
  DEVELOPER_RESERVE_ONE_OF_ONES: 10, // Part of founder's 250
  DEVELOPER_RESERVE_RANDOM: 270, // 240 founder + 30 dev
  MAX_BATCH_SIZE: 50,
  
  // 1/1 metadata IDs for developer reserve
  ONE_OF_ONE_IDS: [504, 998, 1529, 2016, 2530, 3022, 3533, 4059, 4555, 5190],
  
  // Path names
  PATHS: [
    'SUDO-A5 Frostbark',
    'SUDO-E8 Toxinpup',
    'SUDO-N0 Cryoblink',
    'SUDO-V9 Emberfang',
    'SUDO-X7 Glitchtail',
    'SUDO-Z1 Aurapup',
    'SUDO-Z3 Voidpaw',
  ],
};

// Fix the TYPES object
CONTRACT_CONSTANTS.TYPES = {
  SUDOZ_ARTIFACT: `${CONTRACT_CONSTANTS.PACKAGE_ID}::${CONTRACT_CONSTANTS.MODULE_NAME}::SudozArtifact`,
  EVOLVED_SUDOZ: `${CONTRACT_CONSTANTS.PACKAGE_ID}::${CONTRACT_CONSTANTS.EVOLVED_MODULE_NAME}::EvolvedSudoz`,
};

// Claim Pool Constants
export const CLAIM_POOL_CONSTANTS = {
  // Package and object IDs
  PACKAGE_ID: '0x81a27789d618d02cdc3bbda97625dbfc93887237581a1d68575265d700393f0e',
  NFT_GATED_CLAIM_POOL_ID: '0xa232f0313e18b6ead61abcae2b1189ea2161dfc018bf58ddbbeb825be70c6655',
  BASIC_CLAIM_POOL_ID: '0x4b56f0499416cfd0eff564939573b91ff82df8031ec898af82599852091e0523',
  
  // Module names
  CLAIM_POOL_MODULE: 'claim_pool',
  NFT_GATED_MODULE: 'nft_gated_claim_pool_v2',
  BATCH_DEPOSIT_MODULE: 'batch_deposit_v2',
  
  // Function names
  FUNCTIONS: {
    // Basic claim pool
    ADD_NFT_TO_POOL: 'add_nft_to_pool',
    CLAIM_NFT: 'claim_nft',
    SET_CLAIMING_ENABLED: 'set_claiming_enabled',
    
    // NFT-gated claim pool
    CLAIM_WITH_NFT: 'claim_with_nft',
    ADD_ELIGIBLE_COLLECTION: 'add_eligible_collection',
    REMOVE_ELIGIBLE_COLLECTION: 'remove_eligible_collection',
    CREATE_OWNERSHIP_PROOF: 'create_ownership_proof',
    ADD_AUTHORIZED_DEPOSITOR: 'add_authorized_depositor',
    REMOVE_AUTHORIZED_DEPOSITOR: 'remove_authorized_depositor',
    REMOVE_NFTS_FROM_POOL: 'remove_nfts_from_pool',
    
    // Batch deposit functions
    BATCH_DEPOSIT_5: 'batch_deposit_5',
    BATCH_DEPOSIT_10: 'batch_deposit_10',
    BATCH_DEPOSIT_20: 'batch_deposit_20',
    
    // View functions
    GET_POOL_INFO: 'get_pool_info',
    HAS_CLAIMED: 'has_claimed',
    CAN_CLAIM: 'can_claim',
    IS_COLLECTION_ELIGIBLE: 'is_collection_eligible',
    IS_AUTHORIZED_DEPOSITOR: 'is_authorized_depositor',
  },
  
  // Eligible NFT collections
  ELIGIBLE_COLLECTIONS: {
    PRIME_MACHIN: {
      TYPE: '0x034c162f6b594cb5a1805264dd01ca5d80ce3eca6522e6ee37fd9ebfb9d3ddca::factory::PrimeMachin',
      TYPE_BYTES: Array.from(new TextEncoder().encode('0x034c162f6b594cb5a1805264dd01ca5d80ce3eca6522e6ee37fd9ebfb9d3ddca::factory::PrimeMachin')),
      NAME: 'Prime Machin',
    },
    ROOTLET: {
      TYPE: '0x8f74a7d632191e29956df3843404f22d27bd84d92cca1b1abde621d033098769::rootlet::Rootlet',
      TYPE_BYTES: Array.from(new TextEncoder().encode('0x8f74a7d632191e29956df3843404f22d27bd84d92cca1b1abde621d033098769::rootlet::Rootlet')),
      NAME: 'Rootlet',
    },
  },
  
  // Error codes
  ERRORS: {
    NOT_ADMIN: 1,
    POOL_EMPTY: 2,
    ALREADY_CLAIMED: 3,
    CLAIMING_PAUSED: 4,
    NOT_ELIGIBLE: 5,
    NO_ELIGIBLE_NFT: 6,
  },
};

