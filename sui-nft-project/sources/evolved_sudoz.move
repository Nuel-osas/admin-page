module sui_nft_collection::evolved_sudoz {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use std::string::{Self, String};
    use sui::url::{Self, Url};
    use sui::event;
    use sui::display;
    use sui::package;
    use std::vector;
    use std::option;
    use sui::random::{Self, Random};
    use sui::kiosk::{Self, Kiosk, KioskOwnerCap};
    use sui::transfer_policy::{Self, TransferPolicy};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::table::{Self, Table};
    use sui::vec_map::{Self, VecMap};

    /// Error codes
    const E_MAX_SUPPLY_REACHED: u64 = 0;
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_INVALID_METADATA_ID: u64 = 2;
    const E_METADATA_ID_NOT_AVAILABLE: u64 = 3;
    const E_INVALID_BATCH_SIZE: u64 = 4;
    // const E_INVALID_EVOLUTION_AUTH: u64 = 5; // Currently unused
    const E_ARTIFACT_ALREADY_EVOLVED: u64 = 6;

    /// Supply constant
    const EVOLVED_SUPPLY: u64 = 5555;
    
    /// Developer reserve constants
    const DEVELOPER_RESERVE_TOTAL: u64 = 280; // Total reserve (250 founder + 30 dev)
    const FOUNDER_RESERVE: u64 = 250; // Founder's allocation
    const DEV_RESERVE: u64 = 30; // Dev's allocation
    const MAX_BATCH_SIZE: u64 = 50;
    
    /// Authorized addresses for minting reserves
    const FOUNDER_ADDRESS: address = @0x21221a34eb06d78b16ef4553572e228970f2972385b1d3feab68cfc80090f430;
    const DEV_ADDRESS: address = @0x9a5b0ad3a18964ab7c0dbf9ab4cdecfd6b3899423b47313ae6e78f4b801022a3;

    /// Royalty basis points (3% = 300 basis points)
    // const ROYALTY_BASIS_POINTS: u16 = 300; // Currently unused

    /// Evolved NFT collection with Kiosk integration
    struct EvolvedSudoz has key, store {
        id: UID,
        name: String,
        description: String,
        image_url: Url,
        number: u64,                        // Sequential evolved number (1-5555)
        metadata_id: u64,                   // Random metadata ID for traits/image
        original_artifact_number: u64,      // Heritage from burned artifact
        original_path: u8,                  // Heritage from burned artifact
        // On-chain traits
        background: String,
        skin: String,
        clothes: String,
        hats: String,
        eyewear: String,
        mouth: String,
        earrings: String,
        attributes: VecMap<String, String>  // Standard Sui NFT attributes
    }

    /// Admin capability for the evolved collection
    struct EvolvedAdminCap has key, store {
        id: UID
    }

    /// Collection stats for evolved NFTs
    struct EvolvedStats has key {
        id: UID,
        evolved_minted: u64,
        available_metadata_ids: vector<u64>,  // Pool of unused metadata IDs
        royalty_fees: Balance<SUI>,           // Accumulated royalty payments
        // Security: Track evolved artifacts to prevent double evolution
        evolved_artifacts: Table<u64, bool>,  // artifact_number -> has_evolved
    }
    
    /// Trait set for storing NFT attributes
    /// NOTE: This struct is no longer used since traits are now provided directly as parameters
    /// Keeping it commented out for reference
    /*
    struct TraitSet has store, drop, copy {
        background: String,
        skin: String,
        clothes: String,
        hats: String,
        eyewear: String,
        mouth: String,
        earrings: String,
    }
    */

    /// Evolution authorization - only held by the artifacts contract
    struct EvolutionAuth has key, store {
        id: UID
    }

    /// Publisher capability for display and transfer policy
    struct EVOLVED_SUDOZ has drop {}

    /// Events
    struct EvolvedMinted has copy, drop {
        evolved_id: ID,
        recipient: address,
        number: u64,
        metadata_id: u64,
        original_artifact_number: u64,
        original_path: u8
    }

    struct RoyaltyCollected has copy, drop {
        amount: u64,
        from_trade: ID
    }

    /// One-time witness for package
    fun init(otw: EVOLVED_SUDOZ, ctx: &mut TxContext) {
        let publisher = package::claim(otw, ctx);
        
        // Set up display for EvolvedSudoz with complete metadata
        let evolved_display = display::new<EvolvedSudoz>(&publisher, ctx);
        display::add(&mut evolved_display, string::utf8(b"name"), string::utf8(b"{name}"));
        display::add(&mut evolved_display, string::utf8(b"description"), string::utf8(b"{description}"));
        display::add(&mut evolved_display, string::utf8(b"image_url"), string::utf8(b"{image_url}"));
        
        // Core NFT attributes
        display::add(&mut evolved_display, string::utf8(b"number"), string::utf8(b"#{number}"));
        display::add(&mut evolved_display, string::utf8(b"metadata_id"), string::utf8(b"{metadata_id}"));
        
        // Heritage attributes from original artifact
        display::add(&mut evolved_display, string::utf8(b"original_artifact_number"), string::utf8(b"#{original_artifact_number}"));
        display::add(&mut evolved_display, string::utf8(b"original_path"), string::utf8(b"{original_path}"));
        
        // Trait attributes
        display::add(&mut evolved_display, string::utf8(b"background"), string::utf8(b"{background}"));
        display::add(&mut evolved_display, string::utf8(b"skin"), string::utf8(b"{skin}"));
        display::add(&mut evolved_display, string::utf8(b"clothes"), string::utf8(b"{clothes}"));
        display::add(&mut evolved_display, string::utf8(b"hats"), string::utf8(b"{hats}"));
        display::add(&mut evolved_display, string::utf8(b"eyewear"), string::utf8(b"{eyewear}"));
        display::add(&mut evolved_display, string::utf8(b"mouth"), string::utf8(b"{mouth}"));
        display::add(&mut evolved_display, string::utf8(b"earrings"), string::utf8(b"{earrings}"));
        
        // Collection metadata
        display::add(&mut evolved_display, string::utf8(b"project_url"), string::utf8(b"https://sudoz.xyz"));
        display::add(&mut evolved_display, string::utf8(b"creator"), string::utf8(b"SUDOZ"));
        display::add(&mut evolved_display, string::utf8(b"collection"), string::utf8(b"THE SUDOZ"));
        
        // Add VecMap attributes for standard marketplace compatibility
        display::add(&mut evolved_display, string::utf8(b"attributes"), string::utf8(b"{attributes}"));
        
        display::update_version(&mut evolved_display);

        // Create transfer policy with 3% royalty
        let (transfer_policy, transfer_policy_cap) = transfer_policy::new<EvolvedSudoz>(&publisher, ctx);
        
        // Note: Royalty rules will be added separately using the transfer policy framework

        // Transfer objects to deployer
        transfer::public_transfer(publisher, tx_context::sender(ctx));
        transfer::public_transfer(evolved_display, tx_context::sender(ctx));
        transfer::public_transfer(transfer_policy_cap, tx_context::sender(ctx));
        transfer::public_share_object(transfer_policy);
        
        // Create admin capability for deployer
        let admin_cap = EvolvedAdminCap {
            id: object::new(ctx)
        };
        transfer::transfer(admin_cap, tx_context::sender(ctx));
        
        // Create second admin capability for founder
        let founder_admin_cap = EvolvedAdminCap {
            id: object::new(ctx)
        };
        transfer::transfer(founder_admin_cap, FOUNDER_ADDRESS);
        
        // Initialize available metadata IDs (1-5555)
        let available_ids = vector::empty<u64>();
        let i = 1;
        while (i <= EVOLVED_SUPPLY) {
            vector::push_back(&mut available_ids, i);
            i = i + 1;
        };
        
        // Create evolved stats
        let stats = EvolvedStats {
            id: object::new(ctx),
            evolved_minted: 0,
            available_metadata_ids: available_ids,
            royalty_fees: balance::zero(),
            evolved_artifacts: table::new(ctx)
        };
        transfer::share_object(stats);
        
        // Create evolution auth for the artifacts contract
        // This will be stored in GlobalStats of the artifacts contract
        let evolution_auth = EvolutionAuth {
            id: object::new(ctx)
        };
        transfer::transfer(evolution_auth, tx_context::sender(ctx));
    }

    /// Mint evolved NFT (called by original contract during evolution)
    public fun mint_evolved(
        _admin: &EvolvedAdminCap,
        recipient: address,
        original_artifact_number: u64,
        original_path: u8,
        metadata_id: u64,
        background: String,
        skin: String,
        clothes: String,
        hats: String,
        eyewear: String,
        mouth: String,
        earrings: String,
        stats: &mut EvolvedStats,
        ctx: &mut TxContext
    ): EvolvedSudoz {
        assert!(stats.evolved_minted < EVOLVED_SUPPLY, E_MAX_SUPPLY_REACHED);
        assert!(metadata_id >= 1 && metadata_id <= EVOLVED_SUPPLY, E_INVALID_METADATA_ID);
        
        // Remove the specific metadata ID from available pool
        let removed = remove_specific_metadata_id(&mut stats.available_metadata_ids, metadata_id);
        assert!(removed, E_METADATA_ID_NOT_AVAILABLE);
        
        let evolved_number = stats.evolved_minted + 1;
        
        // Build evolved URL with metadata ID
        let evolved_url = get_evolved_url(metadata_id);
        
        // Create VecMap attributes for the evolved NFT
        let attributes = vec_map::empty();
        vec_map::insert(&mut attributes, string::utf8(b"Background"), background);
        vec_map::insert(&mut attributes, string::utf8(b"Skin"), skin);
        vec_map::insert(&mut attributes, string::utf8(b"Clothes"), clothes);
        vec_map::insert(&mut attributes, string::utf8(b"Hats"), hats);
        vec_map::insert(&mut attributes, string::utf8(b"Eyewear"), eyewear);
        vec_map::insert(&mut attributes, string::utf8(b"Mouth"), mouth);
        vec_map::insert(&mut attributes, string::utf8(b"Earrings"), earrings);
        vec_map::insert(&mut attributes, string::utf8(b"Metadata ID"), u64_to_string(metadata_id));
        vec_map::insert(&mut attributes, string::utf8(b"Number"), u64_to_string(evolved_number));
        vec_map::insert(&mut attributes, string::utf8(b"Original Artifact"), u64_to_string(original_artifact_number));
        vec_map::insert(&mut attributes, string::utf8(b"Original Path"), get_path_name(original_path));
        
        let evolved = EvolvedSudoz {
            id: object::new(ctx),
            name: build_evolved_name(metadata_id),
            description: string::utf8(b"An evolved form of the SUDOZ artifact with unique traits"),
            image_url: url::new_unsafe(string::to_ascii(evolved_url)),
            number: evolved_number,
            metadata_id,
            original_artifact_number,
            original_path,
            background: background,
            skin: skin,
            clothes: clothes,
            hats: hats,
            eyewear: eyewear,
            mouth: mouth,
            earrings: earrings,
            attributes
        };
        
        let evolved_id = object::id(&evolved);
        stats.evolved_minted = stats.evolved_minted + 1;
        
        event::emit(EvolvedMinted {
            evolved_id,
            recipient,
            number: evolved_number,
            metadata_id,
            original_artifact_number,
            original_path
        });
        
        evolved
    }

    /// Public function for cross-contract calls (allows original contract to mint)
    /// Now requires EvolutionAuth to prove caller is authorized
    public fun mint_evolved_for_evolution(
        _auth: &EvolutionAuth,  // Proves caller has authorization
        original_artifact_number: u64,
        original_path: u8,
        stats: &mut EvolvedStats,
        _random: &Random,  // Keep for compatibility but unused
        metadata_id: u64,
        background: String,
        skin: String,
        clothes: String,
        hats: String,
        eyewear: String,
        mouth: String,
        earrings: String,
        ctx: &mut TxContext
    ): EvolvedSudoz {
        // Security: Check if this artifact has already evolved (prevent double evolution)
        assert!(!table::contains(&stats.evolved_artifacts, original_artifact_number), E_ARTIFACT_ALREADY_EVOLVED);
        
        assert!(stats.evolved_minted < EVOLVED_SUPPLY, E_MAX_SUPPLY_REACHED);
        assert!(!vector::is_empty(&stats.available_metadata_ids), E_MAX_SUPPLY_REACHED);
        
        // Record that this artifact has evolved
        table::add(&mut stats.evolved_artifacts, original_artifact_number, true);
        
        // Validate and use provided metadata ID
        assert!(metadata_id >= 1 && metadata_id <= EVOLVED_SUPPLY, E_INVALID_METADATA_ID);
        
        // Find and remove the metadata_id from available pool
        let (found, index) = vector::index_of(&stats.available_metadata_ids, &metadata_id);
        assert!(found, E_METADATA_ID_NOT_AVAILABLE);
        vector::swap_remove(&mut stats.available_metadata_ids, index);
        
        let evolved_number = stats.evolved_minted + 1;
        let recipient = tx_context::sender(ctx);
        
        // Build evolved URL with metadata ID
        let evolved_url = get_evolved_url(metadata_id);
        
        // Create VecMap attributes for the evolved NFT using passed parameters
        let attributes = vec_map::empty();
        vec_map::insert(&mut attributes, string::utf8(b"Background"), background);
        vec_map::insert(&mut attributes, string::utf8(b"Skin"), skin);
        vec_map::insert(&mut attributes, string::utf8(b"Clothes"), clothes);
        vec_map::insert(&mut attributes, string::utf8(b"Hats"), hats);
        vec_map::insert(&mut attributes, string::utf8(b"Eyewear"), eyewear);
        vec_map::insert(&mut attributes, string::utf8(b"Mouth"), mouth);
        vec_map::insert(&mut attributes, string::utf8(b"Earrings"), earrings);
        vec_map::insert(&mut attributes, string::utf8(b"Metadata ID"), u64_to_string(metadata_id));
        vec_map::insert(&mut attributes, string::utf8(b"Number"), u64_to_string(evolved_number));
        vec_map::insert(&mut attributes, string::utf8(b"Original Artifact"), u64_to_string(original_artifact_number));
        vec_map::insert(&mut attributes, string::utf8(b"Original Path"), get_path_name(original_path));
        
        let evolved = EvolvedSudoz {
            id: object::new(ctx),
            name: build_evolved_name(metadata_id),
            description: string::utf8(b"An evolved form of the SUDOZ artifact with unique traits"),
            image_url: url::new_unsafe(string::to_ascii(evolved_url)),
            number: evolved_number,
            metadata_id,
            original_artifact_number,
            original_path,
            background: background,
            skin: skin,
            clothes: clothes,
            hats: hats,
            eyewear: eyewear,
            mouth: mouth,
            earrings: earrings,
            attributes
        };
        
        let evolved_id = object::id(&evolved);
        stats.evolved_minted = stats.evolved_minted + 1;
        
        event::emit(EvolvedMinted {
            evolved_id,
            recipient,
            number: evolved_number,
            metadata_id,
            original_artifact_number,
            original_path
        });
        
        evolved
    }

    /// Place evolved NFT in kiosk for trading with royalty enforcement
    public fun place_in_kiosk(
        kiosk: &mut Kiosk,
        kiosk_cap: &KioskOwnerCap,
        nft: EvolvedSudoz,
        _ctx: &mut TxContext
    ) {
        kiosk::place(kiosk, kiosk_cap, nft);
    }

    /// List evolved NFT for sale in kiosk
    public fun list_for_sale(
        kiosk: &mut Kiosk,
        kiosk_cap: &KioskOwnerCap,
        nft_id: ID,
        price: u64,
        _ctx: &mut TxContext
    ) {
        kiosk::list<EvolvedSudoz>(kiosk, kiosk_cap, nft_id, price);
    }

    /// Purchase evolved NFT from kiosk (handles royalty automatically)
    public fun purchase_from_kiosk(
        kiosk: &mut Kiosk,
        nft_id: ID,
        payment: Coin<SUI>,
        transfer_policy: &TransferPolicy<EvolvedSudoz>,
        _ctx: &mut TxContext
    ): EvolvedSudoz {
        let (nft, transfer_request) = kiosk::purchase<EvolvedSudoz>(kiosk, nft_id, payment);
        
        // Confirm the transfer request (this handles royalty payments)
        transfer_policy::confirm_request<EvolvedSudoz>(transfer_policy, transfer_request);
        
        nft
    }

    /// Get evolved URL - constructs the IPFS URL with metadata ID
    fun get_evolved_url(metadata_id: u64): String {
        let base_url = b"https://ipfs.io/ipfs/bafybeic7ymazpspv6ojxwrr6rqu3glnrtzbj3ej477nowr73brmb4hkkka/nfts/";
        
        let url = vector::empty<u8>();
        vector::append(&mut url, base_url);
        
        // Convert metadata_id to string bytes
        let id_bytes = u64_to_string_bytes(metadata_id);
        vector::append(&mut url, id_bytes);
        
        vector::append(&mut url, b".webp");
        
        string::utf8(url)
    }
    
    /// Helper function to convert u64 to string bytes
    fun u64_to_string_bytes(num: u64): vector<u8> {
        if (num == 0) {
            return b"0"
        };
        
        let digits = vector::empty<u8>();
        let n = num;
        
        while (n > 0) {
            let digit = ((n % 10) as u8) + 48; // 48 is ASCII for '0'
            vector::push_back(&mut digits, digit);
            n = n / 10;
        };
        
        // Reverse the digits
        let result = vector::empty<u8>();
        let len = vector::length(&digits);
        let i = len;
        while (i > 0) {
            i = i - 1;
            vector::push_back(&mut result, *vector::borrow(&digits, i));
        };
        
        result
    }

    /// Update evolved NFT metadata (Admin only)
    public fun update_evolved_metadata(
        _: &EvolvedAdminCap,
        evolved: &mut EvolvedSudoz,
        background: String,
        skin: String,
        clothes: String,
        hats: String,
        eyewear: String,
        mouth: String,
        earrings: String,
    ) {
        evolved.background = background;
        evolved.skin = skin;
        evolved.clothes = clothes;
        evolved.hats = hats;
        evolved.eyewear = eyewear;
        evolved.mouth = mouth;
        evolved.earrings = earrings;
        
        // Update attributes to reflect new trait values
        vec_map::remove(&mut evolved.attributes, &string::utf8(b"Background"));
        vec_map::insert(&mut evolved.attributes, string::utf8(b"Background"), background);
        
        vec_map::remove(&mut evolved.attributes, &string::utf8(b"Skin"));
        vec_map::insert(&mut evolved.attributes, string::utf8(b"Skin"), skin);
        
        vec_map::remove(&mut evolved.attributes, &string::utf8(b"Clothes"));
        vec_map::insert(&mut evolved.attributes, string::utf8(b"Clothes"), clothes);
        
        vec_map::remove(&mut evolved.attributes, &string::utf8(b"Hats"));
        vec_map::insert(&mut evolved.attributes, string::utf8(b"Hats"), hats);
        
        vec_map::remove(&mut evolved.attributes, &string::utf8(b"Eyewear"));
        vec_map::insert(&mut evolved.attributes, string::utf8(b"Eyewear"), eyewear);
        
        vec_map::remove(&mut evolved.attributes, &string::utf8(b"Mouth"));
        vec_map::insert(&mut evolved.attributes, string::utf8(b"Mouth"), mouth);
        
        vec_map::remove(&mut evolved.attributes, &string::utf8(b"Earrings"));
        vec_map::insert(&mut evolved.attributes, string::utf8(b"Earrings"), earrings);
    }

    /// Update NFT image URL (Admin only - for future use)
    /// This function can be called by admin or future authorized contracts
    public fun update_image_url(
        _admin: &EvolvedAdminCap,
        evolved: &mut EvolvedSudoz,
        new_image_url: String,
        _ctx: &mut TxContext
    ) {
        evolved.image_url = url::new_unsafe(string::to_ascii(new_image_url));
    }
    

    /// Withdraw royalty fees (Admin only)
    public fun withdraw_royalty_fees(
        _: &EvolvedAdminCap,
        stats: &mut EvolvedStats,
        ctx: &mut TxContext
    ): Coin<SUI> {
        let amount = balance::value(&stats.royalty_fees);
        let withdrawn = balance::split(&mut stats.royalty_fees, amount);
        coin::from_balance(withdrawn, ctx)
    }
    
    /// Developer reserve: Mint evolved NFT with specific metadata ID (Founder/Dev only)
    /// Used for minting the 10 1/1s with specific metadata IDs
    public entry fun mint_developer_reserve_specific(
        _admin: &EvolvedAdminCap,
        recipient: address,
        metadata_id: u64,
        background: String,
        skin: String,
        clothes: String,
        hats: String,
        eyewear: String,
        mouth: String,
        earrings: String,
        stats: &mut EvolvedStats,
        ctx: &mut TxContext
    ) {
        // Allow founder or dev to mint
        let sender = tx_context::sender(ctx);
        assert!(
            sender == FOUNDER_ADDRESS || 
            sender == DEV_ADDRESS, 
            E_NOT_AUTHORIZED
        );
        assert!(stats.evolved_minted < EVOLVED_SUPPLY, E_MAX_SUPPLY_REACHED);
        assert!(metadata_id >= 1 && metadata_id <= EVOLVED_SUPPLY, E_INVALID_METADATA_ID);
        
        // Remove the specific metadata ID from available pool
        let removed = remove_specific_metadata_id(&mut stats.available_metadata_ids, metadata_id);
        assert!(removed, E_METADATA_ID_NOT_AVAILABLE);
        
        let evolved_number = stats.evolved_minted + 1;
        
        // Build evolved URL with metadata ID
        let evolved_url = get_evolved_url(metadata_id);
        
        // Create attributes for developer reserve specific mint
        let attributes = vec_map::empty();
        vec_map::insert(&mut attributes, string::utf8(b"Background"), background);
        vec_map::insert(&mut attributes, string::utf8(b"Skin"), skin);
        vec_map::insert(&mut attributes, string::utf8(b"Clothes"), clothes);
        vec_map::insert(&mut attributes, string::utf8(b"Hats"), hats);
        vec_map::insert(&mut attributes, string::utf8(b"Eyewear"), eyewear);
        vec_map::insert(&mut attributes, string::utf8(b"Mouth"), mouth);
        vec_map::insert(&mut attributes, string::utf8(b"Earrings"), earrings);
        vec_map::insert(&mut attributes, string::utf8(b"Metadata ID"), u64_to_string(metadata_id));
        vec_map::insert(&mut attributes, string::utf8(b"Number"), u64_to_string(evolved_number));
        
        if (is_one_of_one(metadata_id)) {
            vec_map::insert(&mut attributes, string::utf8(b"Type"), string::utf8(b"Developer Reserve - 1/1"));
        } else {
            vec_map::insert(&mut attributes, string::utf8(b"Type"), string::utf8(b"Developer Reserve"));
        };
        
        let evolved = EvolvedSudoz {
            id: object::new(ctx),
            name: build_evolved_name(metadata_id),
            description: string::utf8(b"An evolved form of the SUDOZ artifact with unique traits"),
            image_url: url::new_unsafe(string::to_ascii(evolved_url)),
            number: evolved_number,
            metadata_id,
            original_artifact_number: 0, // Developer reserve has no original artifact
            original_path: 0, // Developer reserve has no original path
            background,
            skin,
            clothes,
            hats,
            eyewear,
            mouth,
            earrings,
            attributes
        };
        
        let evolved_id = object::id(&evolved);
        stats.evolved_minted = stats.evolved_minted + 1;
        
        event::emit(EvolvedMinted {
            evolved_id,
            recipient,
            number: evolved_number,
            metadata_id,
            original_artifact_number: 0,
            original_path: 0
        });
        
        transfer::public_transfer(evolved, recipient);
    }
    
    /// Getters for evolved NFT
    public fun get_evolved_number(evolved: &EvolvedSudoz): u64 { evolved.number }
    public fun get_metadata_id(evolved: &EvolvedSudoz): u64 { evolved.metadata_id }
    public fun get_original_artifact_number(evolved: &EvolvedSudoz): u64 { evolved.original_artifact_number }
    public fun get_original_path(evolved: &EvolvedSudoz): u8 { evolved.original_path }
    public fun get_background(evolved: &EvolvedSudoz): String { evolved.background }
    public fun get_skin(evolved: &EvolvedSudoz): String { evolved.skin }
    public fun get_clothes(evolved: &EvolvedSudoz): String { evolved.clothes }
    public fun get_hats(evolved: &EvolvedSudoz): String { evolved.hats }
    public fun get_eyewear(evolved: &EvolvedSudoz): String { evolved.eyewear }
    public fun get_mouth(evolved: &EvolvedSudoz): String { evolved.mouth }
    public fun get_earrings(evolved: &EvolvedSudoz): String { evolved.earrings }
    
    /// Get collection stats
    public fun get_evolved_minted(stats: &EvolvedStats): u64 { stats.evolved_minted }
    public fun get_available_count(stats: &EvolvedStats): u64 { vector::length(&stats.available_metadata_ids) }
    public fun get_evolved_remaining(stats: &EvolvedStats): u64 { 
        EVOLVED_SUPPLY - stats.evolved_minted 
    }
    
    /// Check if a specific metadata ID is available
    public fun is_metadata_id_available(stats: &EvolvedStats, metadata_id: u64): bool {
        let available_ids = &stats.available_metadata_ids;
        let len = vector::length(available_ids);
        let i = 0;
        while (i < len) {
            if (*vector::borrow(available_ids, i) == metadata_id) {
                return true
            };
            i = i + 1;
        };
        false
    }
    
    /// ===== ADDITIONAL KIOSK FUNCTIONS =====
    
    /// Remove NFT from kiosk listing (if user wants to cancel sale)
    public fun delist_from_kiosk(
        kiosk: &mut Kiosk,
        kiosk_cap: &KioskOwnerCap,
        nft_id: ID,
        _ctx: &mut TxContext
    ) {
        kiosk::delist<EvolvedSudoz>(kiosk, kiosk_cap, nft_id);
    }

    /// Take NFT from kiosk (if unlocked)
    public fun take_from_kiosk(
        kiosk: &mut Kiosk,
        kiosk_cap: &KioskOwnerCap,
        nft_id: ID,
        _ctx: &mut TxContext
    ): EvolvedSudoz {
        kiosk::take<EvolvedSudoz>(kiosk, kiosk_cap, nft_id)
    }

    /// Mint evolved NFT and immediately lock in kiosk (requires policy)
    public entry fun mint_evolved_and_lock(
        _admin: &EvolvedAdminCap,
        recipient: address,
        original_artifact_number: u64,
        original_path: u8,
        metadata_id: u64,
        background: String,
        skin: String,
        clothes: String,
        hats: String,
        eyewear: String,
        mouth: String,
        earrings: String,
        stats: &mut EvolvedStats,
        policy: &TransferPolicy<EvolvedSudoz>,
        ctx: &mut TxContext
    ) {
        let evolved = mint_evolved(_admin, recipient, original_artifact_number, original_path, metadata_id, background, skin, clothes, hats, eyewear, mouth, earrings, stats, ctx);
        
        // Create kiosk and lock
        let (kiosk, kiosk_cap) = kiosk::new(ctx);
        kiosk::lock(&mut kiosk, &kiosk_cap, policy, evolved);
        
        // Transfer kiosk to recipient
        transfer::public_share_object(kiosk);
        transfer::public_transfer(kiosk_cap, recipient);
    }

    /// ===== DEVELOPER RESERVE WITH KIOSK INTEGRATION =====

    /// Developer reserve: Mint NFT into user's existing kiosk (Founder/Dev only)
    public entry fun mint_developer_reserve_to_kiosk(
        _admin: &EvolvedAdminCap,
        kiosk: &mut Kiosk,
        kiosk_cap: &KioskOwnerCap,
        metadata_id: u64,
        background: String,
        skin: String,
        clothes: String,
        hats: String,
        eyewear: String,
        mouth: String,
        earrings: String,
        stats: &mut EvolvedStats,
        ctx: &mut TxContext
    ) {
        // Allow founder or dev to mint
        let sender = tx_context::sender(ctx);
        assert!(
            sender == FOUNDER_ADDRESS || 
            sender == DEV_ADDRESS, 
            E_NOT_AUTHORIZED
        );
        assert!(stats.evolved_minted < EVOLVED_SUPPLY, E_MAX_SUPPLY_REACHED);
        assert!(metadata_id >= 1 && metadata_id <= EVOLVED_SUPPLY, E_INVALID_METADATA_ID);
        
        // Remove the specific metadata ID from available pool
        let removed = remove_specific_metadata_id(&mut stats.available_metadata_ids, metadata_id);
        assert!(removed, E_METADATA_ID_NOT_AVAILABLE);
        
        let evolved_number = stats.evolved_minted + 1;
        
        // Build evolved URL with metadata ID
        let evolved_url = get_evolved_url(metadata_id);
        
        // Create attributes for developer reserve specific mint
        let attributes = vec_map::empty();
        vec_map::insert(&mut attributes, string::utf8(b"Background"), background);
        vec_map::insert(&mut attributes, string::utf8(b"Skin"), skin);
        vec_map::insert(&mut attributes, string::utf8(b"Clothes"), clothes);
        vec_map::insert(&mut attributes, string::utf8(b"Hats"), hats);
        vec_map::insert(&mut attributes, string::utf8(b"Eyewear"), eyewear);
        vec_map::insert(&mut attributes, string::utf8(b"Mouth"), mouth);
        vec_map::insert(&mut attributes, string::utf8(b"Earrings"), earrings);
        vec_map::insert(&mut attributes, string::utf8(b"Metadata ID"), u64_to_string(metadata_id));
        vec_map::insert(&mut attributes, string::utf8(b"Number"), u64_to_string(evolved_number));
        vec_map::insert(&mut attributes, string::utf8(b"Type"), string::utf8(b"Developer Reserve"));
        
        let evolved = EvolvedSudoz {
            id: object::new(ctx),
            name: build_evolved_name(metadata_id),
            description: string::utf8(b"An evolved form of the SUDOZ artifact with unique traits"),
            image_url: url::new_unsafe(string::to_ascii(evolved_url)),
            number: evolved_number,
            metadata_id,
            original_artifact_number: 0, // Developer reserve has no original artifact
            original_path: 0, // Developer reserve has no original path
            background,
            skin,
            clothes,
            hats,
            eyewear,
            mouth,
            earrings,
            attributes
        };
        
        let evolved_id = object::id(&evolved);
        stats.evolved_minted = stats.evolved_minted + 1;
        
        // Place NFT in the user's kiosk
        kiosk::place(kiosk, kiosk_cap, evolved);
        
        event::emit(EvolvedMinted {
            evolved_id,
            recipient: tx_context::sender(ctx),
            number: evolved_number,
            metadata_id,
            original_artifact_number: 0,
            original_path: 0
        });
    }

    /// Developer reserve: Mint NFT and lock in user's kiosk (Founder/Dev only)
    public entry fun mint_and_lock_to_kiosk(
        _admin: &EvolvedAdminCap,
        kiosk: &mut Kiosk,
        kiosk_cap: &KioskOwnerCap,
        policy: &TransferPolicy<EvolvedSudoz>,
        metadata_id: u64,
        background: String,
        skin: String,
        clothes: String,
        hats: String,
        eyewear: String,
        mouth: String,
        earrings: String,
        stats: &mut EvolvedStats,
        ctx: &mut TxContext
    ) {
        // Allow founder or dev to mint
        let sender = tx_context::sender(ctx);
        assert!(
            sender == FOUNDER_ADDRESS || 
            sender == DEV_ADDRESS, 
            E_NOT_AUTHORIZED
        );
        assert!(stats.evolved_minted < EVOLVED_SUPPLY, E_MAX_SUPPLY_REACHED);
        assert!(metadata_id >= 1 && metadata_id <= EVOLVED_SUPPLY, E_INVALID_METADATA_ID);
        
        // Remove the specific metadata ID from available pool
        let removed = remove_specific_metadata_id(&mut stats.available_metadata_ids, metadata_id);
        assert!(removed, E_METADATA_ID_NOT_AVAILABLE);
        
        let evolved_number = stats.evolved_minted + 1;
        
        // Build evolved URL with metadata ID
        let evolved_url = get_evolved_url(metadata_id);
        
        // Create attributes for developer reserve specific mint
        let attributes = vec_map::empty();
        vec_map::insert(&mut attributes, string::utf8(b"Background"), background);
        vec_map::insert(&mut attributes, string::utf8(b"Skin"), skin);
        vec_map::insert(&mut attributes, string::utf8(b"Clothes"), clothes);
        vec_map::insert(&mut attributes, string::utf8(b"Hats"), hats);
        vec_map::insert(&mut attributes, string::utf8(b"Eyewear"), eyewear);
        vec_map::insert(&mut attributes, string::utf8(b"Mouth"), mouth);
        vec_map::insert(&mut attributes, string::utf8(b"Earrings"), earrings);
        vec_map::insert(&mut attributes, string::utf8(b"Metadata ID"), u64_to_string(metadata_id));
        vec_map::insert(&mut attributes, string::utf8(b"Number"), u64_to_string(evolved_number));
        vec_map::insert(&mut attributes, string::utf8(b"Type"), string::utf8(b"Developer Reserve - Locked"));
        
        let evolved = EvolvedSudoz {
            id: object::new(ctx),
            name: build_evolved_name(metadata_id),
            description: string::utf8(b"An evolved form of the SUDOZ artifact with unique traits"),
            image_url: url::new_unsafe(string::to_ascii(evolved_url)),
            number: evolved_number,
            metadata_id,
            original_artifact_number: 0, // Developer reserve has no original artifact
            original_path: 0, // Developer reserve has no original path
            background,
            skin,
            clothes,
            hats,
            eyewear,
            mouth,
            earrings,
            attributes
        };
        
        let evolved_id = object::id(&evolved);
        stats.evolved_minted = stats.evolved_minted + 1;
        
        // Lock NFT permanently in user's kiosk
        kiosk::lock(kiosk, kiosk_cap, policy, evolved);
        
        event::emit(EvolvedMinted {
            evolved_id,
            recipient: tx_context::sender(ctx),
            number: evolved_number,
            metadata_id,
            original_artifact_number: 0,
            original_path: 0
        });
    }
    
    /// Developer reserve: Batch mint 1/1s directly to kiosk (Founder only)
    public entry fun mint_one_of_ones_to_kiosk(
        _admin: &EvolvedAdminCap,
        kiosk: &mut Kiosk,
        kiosk_cap: &KioskOwnerCap,
        policy: &TransferPolicy<EvolvedSudoz>,
        stats: &mut EvolvedStats,
        ctx: &mut TxContext
    ) {
        // Allow founder or dev to mint 1/1s (part of founder allocation)
        let sender = tx_context::sender(ctx);
        assert!(
            sender == FOUNDER_ADDRESS || 
            sender == DEV_ADDRESS, 
            E_NOT_AUTHORIZED
        );
        
        let one_of_one_ids = vector::empty<u64>();
        vector::push_back(&mut one_of_one_ids, 504);
        vector::push_back(&mut one_of_one_ids, 998);
        vector::push_back(&mut one_of_one_ids, 1529);
        vector::push_back(&mut one_of_one_ids, 2016);
        vector::push_back(&mut one_of_one_ids, 2530);
        vector::push_back(&mut one_of_one_ids, 3022);
        vector::push_back(&mut one_of_one_ids, 3533);
        vector::push_back(&mut one_of_one_ids, 4059);
        vector::push_back(&mut one_of_one_ids, 4555);
        vector::push_back(&mut one_of_one_ids, 5190);
        
        let i = 0;
        let len = vector::length(&one_of_one_ids);
        
        while (i < len) {
            let metadata_id = *vector::borrow(&one_of_one_ids, i);
            
            // Remove the specific metadata ID from available pool
            let removed = remove_specific_metadata_id(&mut stats.available_metadata_ids, metadata_id);
            assert!(removed, E_METADATA_ID_NOT_AVAILABLE);
            
            let evolved_number = stats.evolved_minted + 1;
            let evolved_url = get_evolved_url(metadata_id);
            
            // All 1/1s have special trait values
            let background = string::utf8(b"AI Generated");
            let skin = string::utf8(b"1/1 Exclusive");
            let clothes = string::utf8(b"Special Edition");
            let hats = string::utf8(b"One of One");
            let eyewear = string::utf8(b"Unique");
            let mouth = string::utf8(b"Limited");
            let earrings = string::utf8(b"AI 1/1S");
            
            // Create attributes
            let attributes = vec_map::empty();
            vec_map::insert(&mut attributes, string::utf8(b"Background"), background);
            vec_map::insert(&mut attributes, string::utf8(b"Skin"), skin);
            vec_map::insert(&mut attributes, string::utf8(b"Clothes"), clothes);
            vec_map::insert(&mut attributes, string::utf8(b"Hats"), hats);
            vec_map::insert(&mut attributes, string::utf8(b"Eyewear"), eyewear);
            vec_map::insert(&mut attributes, string::utf8(b"Mouth"), mouth);
            vec_map::insert(&mut attributes, string::utf8(b"Earrings"), earrings);
            vec_map::insert(&mut attributes, string::utf8(b"Metadata ID"), u64_to_string(metadata_id));
            vec_map::insert(&mut attributes, string::utf8(b"Number"), u64_to_string(evolved_number));
            vec_map::insert(&mut attributes, string::utf8(b"Type"), string::utf8(b"Founder Reserve - 1/1"));
            
            let evolved = EvolvedSudoz {
                id: object::new(ctx),
                name: build_evolved_name(metadata_id),
                description: string::utf8(b"An evolved form of the SUDOZ artifact with unique traits"),
                image_url: url::new_unsafe(string::to_ascii(evolved_url)),
                number: evolved_number,
                metadata_id,
                original_artifact_number: 0,
                original_path: 0,
                background,
                skin,
                clothes,
                hats,
                eyewear,
                mouth,
                earrings,
                attributes
            };
            
            let evolved_id = object::id(&evolved);
            stats.evolved_minted = stats.evolved_minted + 1;
            
            // Lock NFT in kiosk
            kiosk::lock(kiosk, kiosk_cap, policy, evolved);
            
            event::emit(EvolvedMinted {
                evolved_id,
                recipient: tx_context::sender(ctx),
                number: evolved_number,
                metadata_id,
                original_artifact_number: 0,
                original_path: 0
            });
            
            i = i + 1;
        };
    }
    
    /// Developer reserve: Batch mint random NFTs to kiosk (Founder/Dev only)
    public entry fun mint_developer_reserve_batch_to_kiosk(
        _admin: &EvolvedAdminCap,
        kiosk: &mut Kiosk,
        kiosk_cap: &KioskOwnerCap,
        policy: &TransferPolicy<EvolvedSudoz>,
        batch_size: u64,
        stats: &mut EvolvedStats,
        random: &Random,
        ctx: &mut TxContext
    ) {
        // Allow founder or dev to mint
        let sender = tx_context::sender(ctx);
        assert!(
            sender == FOUNDER_ADDRESS || 
            sender == DEV_ADDRESS, 
            E_NOT_AUTHORIZED
        );
        
        assert!(batch_size > 0 && batch_size <= MAX_BATCH_SIZE, E_INVALID_BATCH_SIZE);
        assert!(stats.evolved_minted + batch_size <= EVOLVED_SUPPLY, E_MAX_SUPPLY_REACHED);
        assert!(vector::length(&stats.available_metadata_ids) >= batch_size, E_MAX_SUPPLY_REACHED);
        
        let generator = random::new_generator(random, ctx);
        let i = 0;
        
        while (i < batch_size) {
            // Get random metadata ID from available pool
            let available_count = vector::length(&stats.available_metadata_ids);
            let random_index = random::generate_u64_in_range(&mut generator, 0, available_count - 1);
            let metadata_id = vector::swap_remove(&mut stats.available_metadata_ids, random_index);
            
            let evolved_number = stats.evolved_minted + 1;
            let evolved_url = get_evolved_url(metadata_id);
            
            // Default trait values for developer reserve
            let background = string::utf8(b"Unknown");
            let skin = string::utf8(b"Unknown");
            let clothes = string::utf8(b"Unknown");
            let hats = string::utf8(b"Unknown");
            let eyewear = string::utf8(b"Unknown");
            let mouth = string::utf8(b"Unknown");
            let earrings = string::utf8(b"Unknown");
            
            // Create attributes
            let attributes = vec_map::empty();
            vec_map::insert(&mut attributes, string::utf8(b"Background"), background);
            vec_map::insert(&mut attributes, string::utf8(b"Skin"), skin);
            vec_map::insert(&mut attributes, string::utf8(b"Clothes"), clothes);
            vec_map::insert(&mut attributes, string::utf8(b"Hats"), hats);
            vec_map::insert(&mut attributes, string::utf8(b"Eyewear"), eyewear);
            vec_map::insert(&mut attributes, string::utf8(b"Mouth"), mouth);
            vec_map::insert(&mut attributes, string::utf8(b"Earrings"), earrings);
            vec_map::insert(&mut attributes, string::utf8(b"Metadata ID"), u64_to_string(metadata_id));
            vec_map::insert(&mut attributes, string::utf8(b"Number"), u64_to_string(evolved_number));
            vec_map::insert(&mut attributes, string::utf8(b"Type"), string::utf8(b"Developer Reserve"));
            
            let evolved = EvolvedSudoz {
                id: object::new(ctx),
                name: build_evolved_name(metadata_id),
                description: string::utf8(b"An evolved form of the SUDOZ artifact with unique traits"),
                image_url: url::new_unsafe(string::to_ascii(evolved_url)),
                number: evolved_number,
                metadata_id,
                original_artifact_number: 0,
                original_path: 0,
                background,
                skin,
                clothes,
                hats,
                eyewear,
                mouth,
                earrings,
                attributes
            };
            
            let evolved_id = object::id(&evolved);
            stats.evolved_minted = stats.evolved_minted + 1;
            
            // Lock NFT in kiosk
            kiosk::lock(kiosk, kiosk_cap, policy, evolved);
            
            event::emit(EvolvedMinted {
                evolved_id,
                recipient: tx_context::sender(ctx),
                number: evolved_number,
                metadata_id,
                original_artifact_number: 0,
                original_path: 0
            });
            
            i = i + 1;
        };
    }
    
    /// Build evolved NFT name with number
    fun build_evolved_name(number: u64): String {
        let name_bytes = vector::empty<u8>();
        vector::append(&mut name_bytes, b"THE SUDOZ #");
        let number_bytes = u64_to_string_bytes(number);
        vector::append(&mut name_bytes, number_bytes);
        string::utf8(name_bytes)
    }
    
    /// Helper function to remove a specific metadata ID from the available pool
    fun remove_specific_metadata_id(available_ids: &mut vector<u64>, target_id: u64): bool {
        let len = vector::length(available_ids);
        let i = 0;
        while (i < len) {
            if (*vector::borrow(available_ids, i) == target_id) {
                vector::swap_remove(available_ids, i);
                return true
            };
            i = i + 1;
        };
        false
    }
    
    /// Helper function to convert u64 to string
    fun u64_to_string(val: u64): String {
        if (val == 0) {
            return string::utf8(b"0")
        };
        
        let vec = vector::empty<u8>();
        while (val > 0) {
            let digit = ((val % 10) as u8) + 48; // 48 is ASCII for '0'
            vector::push_back(&mut vec, digit);
            val = val / 10;
        };
        
        // Reverse the vector
        vector::reverse(&mut vec);
        string::utf8(vec)
    }
    
    /// Get path name from path ID
    fun get_path_name(path: u8): String {
        if (path == 0) {
            string::utf8(b"Frostbark")
        } else if (path == 1) {
            string::utf8(b"Toxinpup")
        } else if (path == 2) {
            string::utf8(b"Cryoblink")
        } else if (path == 3) {
            string::utf8(b"Emberfang")
        } else if (path == 4) {
            string::utf8(b"Glitchtail")
        } else if (path == 5) {
            string::utf8(b"Aurapup")
        } else {
            string::utf8(b"Voidpaw")
        }
    }

    /// Check if a metadata ID is one of the special 1/1 NFTs
    fun is_one_of_one(metadata_id: u64): bool {
        metadata_id == 504 || metadata_id == 998 || metadata_id == 1529 || 
        metadata_id == 2016 || metadata_id == 2530 || metadata_id == 3022 || 
        metadata_id == 3533 || metadata_id == 4059 || metadata_id == 4555 || 
        metadata_id == 5190
    }

    /// Generate traits from metadata ID (deterministic)
    /// NOTE: This function is no longer used since traits are now provided by the frontend
    /// Keeping it commented out for reference
    /*
    fun generate_traits_from_metadata_id(metadata_id: u64): TraitSet {
        // For 1/1s, return special traits
        if (is_one_of_one(metadata_id)) {
            TraitSet {
                background: string::utf8(b"1/1"),
                skin: string::utf8(b"1/1"),
                clothes: string::utf8(b"1/1"),
                hats: string::utf8(b"1/1"),
                eyewear: string::utf8(b"1/1"),
                mouth: string::utf8(b"1/1"),
                earrings: string::utf8(b"1/1")
            }
        } else {
            // Generate traits based on metadata ID patterns
            let backgrounds = vector[
                string::utf8(b"Galaxy"), string::utf8(b"Nebula"), string::utf8(b"Void"), 
                string::utf8(b"Aurora"), string::utf8(b"Cosmos"), string::utf8(b"Stellar"),
                string::utf8(b"Quantum"), string::utf8(b"Prismatic")
            ];
            let skins = vector[
                string::utf8(b"Ethereal"), string::utf8(b"Crystalline"), string::utf8(b"Luminous"),
                string::utf8(b"Astral"), string::utf8(b"Radiant"), string::utf8(b"Spectral")
            ];
            let clothes_items = vector[
                string::utf8(b"Evolved Armor"), string::utf8(b"Cosmic Suit"), string::utf8(b"Void Walker"),
                string::utf8(b"Star Cloak"), string::utf8(b"Quantum Vest"), string::utf8(b"Neural Interface"),
                string::utf8(b"Plasma Jacket")
            ];
            let hats_items = vector[
                string::utf8(b"Neural Crown"), string::utf8(b"Void Helm"), string::utf8(b"Star Cap"),
                string::utf8(b"Quantum Hood"), string::utf8(b"None"), string::utf8(b"Cosmic Visor")
            ];
            let eyewear_items = vector[
                string::utf8(b"Plasma Visor"), string::utf8(b"Void Specs"), string::utf8(b"Neural Lens"),
                string::utf8(b"None"), string::utf8(b"Quantum Goggles"), string::utf8(b"Star Shades")
            ];
            let mouth_items = vector[
                string::utf8(b"Energy Mask"), string::utf8(b"Void Breath"), string::utf8(b"None"),
                string::utf8(b"Plasma Grin"), string::utf8(b"Neural Link"), string::utf8(b"Cosmic Smile")
            ];
            let earrings_items = vector[
                string::utf8(b"Quantum Studs"), string::utf8(b"None"), string::utf8(b"Void Rings"),
                string::utf8(b"Star Drops"), string::utf8(b"Energy Hoops"), string::utf8(b"Neural Plugs")
            ];
            
            // Use metadata_id to deterministically select traits
            let bg_index = (((metadata_id * 7) % vector::length(&backgrounds)) as u64);
            let skin_index = (((metadata_id * 11) % vector::length(&skins)) as u64);
            let clothes_index = (((metadata_id * 13) % vector::length(&clothes_items)) as u64);
            let hats_index = (((metadata_id * 17) % vector::length(&hats_items)) as u64);
            let eyewear_index = (((metadata_id * 19) % vector::length(&eyewear_items)) as u64);
            let mouth_index = (((metadata_id * 23) % vector::length(&mouth_items)) as u64);
            let earrings_index = (((metadata_id * 29) % vector::length(&earrings_items)) as u64);
            
            TraitSet {
                background: *vector::borrow(&backgrounds, bg_index),
                skin: *vector::borrow(&skins, skin_index),
                clothes: *vector::borrow(&clothes_items, clothes_index),
                hats: *vector::borrow(&hats_items, hats_index),
                eyewear: *vector::borrow(&eyewear_items, eyewear_index),
                mouth: *vector::borrow(&mouth_items, mouth_index),
                earrings: *vector::borrow(&earrings_items, earrings_index)
            }
        }
    }
    */

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(EVOLVED_SUDOZ {}, ctx);
    }
}