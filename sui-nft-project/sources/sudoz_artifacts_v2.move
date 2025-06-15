module sui_nft_collection::sudoz_artifacts_v2 {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use std::string::{Self, String};
    use sui::url::{Self, Url};
    use sui::event;
    use sui::display;
    use sui::package;
    use sui::table::{Self, Table};
    use std::vector;
    use std::option::{Self, Option};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::random::{Self, Random};
    use sui::vec_map::{Self, VecMap};
    use sui::kiosk::{Self, Kiosk, KioskOwnerCap};
    use sui::transfer_policy::{TransferPolicy};

    // Import evolved module for cross-contract calls
    use sui_nft_collection::evolved_sudoz;

    /// Error codes
    // const E_NOT_ADMIN: u64 = 1; // Currently unused
    const E_MAX_SUPPLY_REACHED: u64 = 2;
    const E_INSUFFICIENT_PAYMENT: u64 = 3;
    const E_INVALID_LEVEL: u64 = 4;
    const E_MAX_LEVEL_REACHED: u64 = 5;
    const E_INVALID_BATCH_SIZE: u64 = 6;
    const E_BURN_NOT_ENABLED: u64 = 7;
    const E_NOT_LEVEL_10: u64 = 8;
    const E_MINIMUM_LEVEL_FOR_REFUND: u64 = 9;
    const E_MINIMUM_LEVEL_FOR_REWARDS: u64 = 10;
    const E_INSUFFICIENT_FOUNDER_BALANCE: u64 = 20;
    const E_NOT_AUTHORIZED: u64 = 21;
    const E_NO_BALANCE: u64 = 22;
    // const E_NOT_MAX_LEVEL: u64 = 23; // Currently unused

    /// Constants
    const MAX_SUPPLY: u64 = 13600;
    const MAX_BATCH_SIZE: u64 = 100;
    const UPGRADE_COST_PER_LEVEL: u64 = 1_000_000_000; // 1 SUI in MIST
    const MIN_LEVEL_FOR_REFUND: u64 = 5;
    const MIN_LEVEL_FOR_REWARDS: u64 = 3;
    // const MAX_LEVEL: u64 = 10; // Currently unused
    
    /// Revenue split constants
    const DEV_PERCENTAGE: u64 = 15;
    // const FOUNDER_PERCENTAGE: u64 = 85; // Currently unused
    const DEV_ADDRESS: address = @0x9a5b0ad3a18964ab7c0dbf9ab4cdecfd6b3899423b47313ae6e78f4b801022a3; // Dev's 15% revenue address
    const FOUNDER_ADDRESS: address = @0x21221a34eb06d78b16ef4553572e228970f2972385b1d3feab68cfc80090f430; // Founder's 85% revenue address

    /// NFT struct representing each collectible
    struct SudozArtifact has key, store {
        id: UID,
        name: String,
        description: String,
        image_url: Url,
        number: u64,
        level: u64,
        points: u64,
        path: Option<u8>, // None for level 0, Some(path) for level 1+
        attributes: VecMap<String, String>  // Standard Sui NFT attributes
    }

    /// Admin capability for minting
    struct AdminCap has key, store {
        id: UID
    }

    /// Stats tracking with dual pools
    struct GlobalStats has key {
        id: UID,
        artifacts_minted: u64,
        artifacts_burned: u64,
        founder_pool: Balance<SUI>,    // 85% - pays refunds
        dev_pool: Balance<SUI>,        // 15% - never touched for refunds
        level_10_burns: u64,
        burn_mechanisms_enabled: bool,
        burn_records: Table<address, BurnRecord>,
        evolution_auth: Option<evolved_sudoz::EvolutionAuth>,
    }
    
    /// Burn record for each wallet
    struct BurnRecord has store {
        refund_burns: u64,
        refund_amount_claimed: u64,
        reward_burns: u64,
        total_points_accumulated: u64,
        burned_nfts: vector<BurnedNFT>,
    }
    
    /// Individual burn record
    struct BurnedNFT has store {
        nft_number: u64,
        level: u64,
        points: u64,
        path: Option<u8>,
        burn_type: u8,  // 0 = refund, 1 = reward
        timestamp: u64,
    }

    /// One-time witness for package
    struct SUDOZ_ARTIFACTS_V2 has drop {}

    /// Events
    struct ArtifactMinted has copy, drop {
        object_id: ID,
        recipient: address,
        number: u64,
    }

    struct ArtifactUpgraded has copy, drop {
        artifact_id: ID,
        old_level: u64,
        new_level: u64,
        path_selected: Option<u8>,
        upgrade_cost: u64,
    }

    struct PathSelected has copy, drop {
        artifact_id: ID,
        path: u8,
        path_name: String,
    }

    struct ArtifactBurned has copy, drop {
        artifact_id: ID,
        artifact_number: u64,
        level: u64,
    }

    struct ArtifactBurnedForEvolved has copy, drop {
        artifact_id: ID,
        evolved_id: ID,
        artifact_number: u64,
        evolved_number: u64,
    }
    
    struct NFTBurnedForRefund has copy, drop {
        burner: address,
        nft_number: u64,
        level: u64,
        refund_amount: u64,
    }
    
    struct NFTBurnedForRewards has copy, drop {
        burner: address,
        nft_number: u64,
        level: u64,
        points: u64,
    }
    
    struct RevenueSplit has copy, drop {
        total_payment: u64,
        to_dev_pool: u64,
        to_founder_pool: u64,
    }
    
    struct RefundFromFounderPool has copy, drop {
        refund_amount: u64,
        remaining_founder_balance: u64,
        dev_pool_untouched: u64,
    }
    
    struct DevPoolWithdrawn has copy, drop {
        amount: u64,
        withdrawn_by: address,
        timestamp: u64,
    }
    
    struct FounderPoolWithdrawn has copy, drop {
        amount: u64,
        withdrawn_by: address,
        timestamp: u64,
    }

    /// Initialize module
    fun init(otw: SUDOZ_ARTIFACTS_V2, ctx: &mut TxContext) {
        let publisher = package::claim(otw, ctx);
        
        // Set up display for NFT with complete attribute metadata
        let display = display::new<SudozArtifact>(&publisher, ctx);
        display::add(&mut display, string::utf8(b"name"), string::utf8(b"{name}"));
        display::add(&mut display, string::utf8(b"description"), string::utf8(b"{description}"));
        display::add(&mut display, string::utf8(b"image_url"), string::utf8(b"{image_url}"));
        display::add(&mut display, string::utf8(b"project_url"), string::utf8(b"https://sudoz.xyz"));
        display::add(&mut display, string::utf8(b"creator"), string::utf8(b"SUDOZ"));
        
        // Add custom attributes for marketplace display
        display::add(&mut display, string::utf8(b"number"), string::utf8(b"#{number}"));
        display::add(&mut display, string::utf8(b"level"), string::utf8(b"{level}"));
        display::add(&mut display, string::utf8(b"points"), string::utf8(b"{points}"));
        display::add(&mut display, string::utf8(b"path"), string::utf8(b"{path}"));
        
        // Add VecMap attributes for standard marketplace compatibility
        display::add(&mut display, string::utf8(b"attributes"), string::utf8(b"{attributes}"));
        
        display::update_version(&mut display);
        
        transfer::public_transfer(publisher, tx_context::sender(ctx));
        transfer::public_transfer(display, tx_context::sender(ctx));
        
        // Create admin capabilities - one for founder, one for dev
        let founder_admin_cap = AdminCap {
            id: object::new(ctx)
        };
        let dev_admin_cap = AdminCap {
            id: object::new(ctx)
        };
        
        // Transfer AdminCaps to respective addresses
        transfer::transfer(founder_admin_cap, FOUNDER_ADDRESS);
        transfer::transfer(dev_admin_cap, DEV_ADDRESS);
        
        // Create global stats with dual pools
        let stats = GlobalStats {
            id: object::new(ctx),
            artifacts_minted: 0,
            artifacts_burned: 0,
            founder_pool: balance::zero(),     // 85% pool
            dev_pool: balance::zero(),          // 15% pool
            level_10_burns: 0,
            burn_mechanisms_enabled: false,
            burn_records: table::new(ctx),
            evolution_auth: option::none(),
        };
        transfer::share_object(stats);
    }

    /// Create additional AdminCap (Admin only) - allows creating AdminCaps for multiple admins
    public entry fun create_admin_cap(
        _: &AdminCap,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let admin_cap = AdminCap {
            id: object::new(ctx)
        };
        transfer::transfer(admin_cap, recipient);
    }

    /// Mint new NFT (Admin only)
    public entry fun mint_artifact(
        _: &AdminCap,
        recipient: address,
        stats: &mut GlobalStats,
        ctx: &mut TxContext
    ) {
        assert!(stats.artifacts_minted < MAX_SUPPLY, E_MAX_SUPPLY_REACHED);
        
        let nft_number = stats.artifacts_minted + 1;
        
        // Create VecMap attributes for the new NFT
        let attributes = vec_map::empty();
        vec_map::insert(&mut attributes, string::utf8(b"Level"), string::utf8(b"0"));
        vec_map::insert(&mut attributes, string::utf8(b"Points"), string::utf8(b"2"));
        vec_map::insert(&mut attributes, string::utf8(b"Number"), u64_to_string(nft_number));
        vec_map::insert(&mut attributes, string::utf8(b"Path"), string::utf8(b"None"));
        
        let nft = SudozArtifact {
            id: object::new(ctx),
            name: string::utf8(b"SUDOZ ARTIFACT"),
            description: string::utf8(b"A mysterious artifact waiting to reveal its true form through upgrades"),
            image_url: url::new_unsafe(string::to_ascii(get_image_url(0, option::none()))),
            number: nft_number,
            level: 0,
            points: 2,
            path: option::none(),
            attributes
        };
        
        let object_id = object::id(&nft);
        stats.artifacts_minted = stats.artifacts_minted + 1;
        
        event::emit(ArtifactMinted {
            object_id,
            recipient,
            number: nft_number,
        });
        
        transfer::public_transfer(nft, recipient);
    }

    /// Batch mint NFTs (Admin only)
    public entry fun batch_mint_artifacts(
        admin: &AdminCap,
        recipient: address,
        count: u64,
        stats: &mut GlobalStats,
        ctx: &mut TxContext
    ) {
        assert!(count > 0 && count <= MAX_BATCH_SIZE, E_INVALID_BATCH_SIZE);
        
        let i = 0;
        while (i < count) {
            mint_artifact(admin, recipient, stats, ctx);
            i = i + 1;
        }
    }

    /// Upgrade NFT by one level - auto-splits payment
    public fun upgrade_level(
        artifact: &mut SudozArtifact,
        payment: Coin<SUI>,
        stats: &mut GlobalStats,
        random: &Random,
        ctx: &mut TxContext
    ) {
        assert!(artifact.level < 10, E_MAX_LEVEL_REACHED);
        assert!(coin::value(&payment) >= UPGRADE_COST_PER_LEVEL, E_INSUFFICIENT_PAYMENT);
        
        let old_level = artifact.level;
        
        // Auto-split the payment
        let payment_balance = coin::into_balance(payment);
        let total_amount = balance::value(&payment_balance);
        
        // Calculate splits (dev gets exactly 15%)
        let dev_amount = (total_amount * DEV_PERCENTAGE) / 100;
        let dev_balance = balance::split(&mut payment_balance, dev_amount);
        
        // Deposit to pools
        balance::join(&mut stats.dev_pool, dev_balance);
        balance::join(&mut stats.founder_pool, payment_balance); // Remainder (85%)
        
        // Handle path selection for level 0->1
        if (old_level == 0) {
            let generator = random::new_generator(random, ctx);
            let random_val = random::generate_u8_in_range(&mut generator, 0, 6);
            artifact.path = option::some(random_val);
            artifact.name = get_path_name(random_val);
            
            // Update Path attribute
            vec_map::remove(&mut artifact.attributes, &string::utf8(b"Path"));
            vec_map::insert(&mut artifact.attributes, string::utf8(b"Path"), get_path_name(random_val));
            
            event::emit(PathSelected {
                artifact_id: object::uid_to_inner(&artifact.id),
                path: random_val,
                path_name: get_path_name(random_val)
            });
        };
        
        event::emit(ArtifactUpgraded {
            artifact_id: object::uid_to_inner(&artifact.id),
            old_level,
            new_level: old_level + 1,
            path_selected: if (old_level == 0) { artifact.path } else { option::none() },
            upgrade_cost: UPGRADE_COST_PER_LEVEL,
        });
        
        // Upgrade level and points
        artifact.level = old_level + 1;
        artifact.points = artifact.points + 1;
        
        // Update attributes to reflect new values
        vec_map::remove(&mut artifact.attributes, &string::utf8(b"Level"));
        vec_map::insert(&mut artifact.attributes, string::utf8(b"Level"), u64_to_string(artifact.level));
        vec_map::remove(&mut artifact.attributes, &string::utf8(b"Points"));
        vec_map::insert(&mut artifact.attributes, string::utf8(b"Points"), u64_to_string(artifact.points));
        
        // Update image URL based on new level and path
        let new_image_url = get_image_url(artifact.level, artifact.path);
        artifact.image_url = url::new_unsafe(string::to_ascii(new_image_url));
        
        event::emit(RevenueSplit {
            total_payment: total_amount,
            to_dev_pool: dev_amount,
            to_founder_pool: total_amount - dev_amount,
        });
    }

    /// Upgrade NFT to a specific target level - auto-splits payment
    public fun upgrade_to_level(
        artifact: &mut SudozArtifact,
        target_level: u64,
        payment: Coin<SUI>,
        stats: &mut GlobalStats,
        random: &Random,
        ctx: &mut TxContext
    ) {
        let current_level = artifact.level;
        assert!(target_level > current_level, E_INVALID_LEVEL);
        assert!(target_level <= 10, E_INVALID_LEVEL);
        
        // Calculate upgrades needed and total cost
        let upgrades_needed = target_level - current_level;
        let total_cost = upgrades_needed * UPGRADE_COST_PER_LEVEL;
        
        // Check payment amount
        assert!(coin::value(&payment) >= total_cost, E_INSUFFICIENT_PAYMENT);
        
        // Auto-split the payment
        let payment_balance = coin::into_balance(payment);
        let total_amount = balance::value(&payment_balance);
        
        let dev_amount = (total_amount * DEV_PERCENTAGE) / 100;
        let dev_balance = balance::split(&mut payment_balance, dev_amount);
        
        // Deposit to pools
        balance::join(&mut stats.dev_pool, dev_balance);
        balance::join(&mut stats.founder_pool, payment_balance);
        
        // Handle path selection if upgrading from level 0
        if (current_level == 0) {
            let generator = random::new_generator(random, ctx);
            let random_val = random::generate_u8_in_range(&mut generator, 0, 6);
            artifact.path = option::some(random_val);
            artifact.name = get_path_name(random_val);
            
            // Update Path attribute
            vec_map::remove(&mut artifact.attributes, &string::utf8(b"Path"));
            vec_map::insert(&mut artifact.attributes, string::utf8(b"Path"), get_path_name(random_val));
            
            event::emit(PathSelected {
                artifact_id: object::uid_to_inner(&artifact.id),
                path: random_val,
                path_name: get_path_name(random_val)
            });
        };
        
        // Emit bulk upgrade event
        event::emit(ArtifactUpgraded {
            artifact_id: object::uid_to_inner(&artifact.id),
            old_level: current_level,
            new_level: target_level,
            path_selected: if (current_level == 0) { artifact.path } else { option::none() },
            upgrade_cost: total_cost
        });
        
        // Upgrade to target level and add points
        artifact.level = target_level;
        artifact.points = 2 + target_level; // Base 2 points + 1 per level
        
        // Update attributes to reflect new values
        vec_map::remove(&mut artifact.attributes, &string::utf8(b"Level"));
        vec_map::insert(&mut artifact.attributes, string::utf8(b"Level"), u64_to_string(artifact.level));
        vec_map::remove(&mut artifact.attributes, &string::utf8(b"Points"));
        vec_map::insert(&mut artifact.attributes, string::utf8(b"Points"), u64_to_string(artifact.points));
        
        // Update image URL to new level
        let new_image_url = get_image_url(target_level, artifact.path);
        artifact.image_url = url::new_unsafe(string::to_ascii(new_image_url));
        
        event::emit(RevenueSplit {
            total_payment: total_amount,
            to_dev_pool: dev_amount,
            to_founder_pool: total_amount - dev_amount,
        });
    }

    /// Convenience function to upgrade directly to level 10
    public fun upgrade_to_level_10(
        artifact: &mut SudozArtifact,
        payment: Coin<SUI>,
        stats: &mut GlobalStats,
        random: &Random,
        ctx: &mut TxContext
    ) {
        upgrade_to_level(artifact, 10, payment, stats, random, ctx);
    }

    /// Store evolution auth from evolved contract (Admin only)
    public entry fun store_evolution_auth(
        _admin: &AdminCap,
        stats: &mut GlobalStats,
        auth: evolved_sudoz::EvolutionAuth,
        _ctx: &mut TxContext
    ) {
        option::fill(&mut stats.evolution_auth, auth);
    }

    /// Entry wrappers for functions that take object by reference
    public entry fun entry_upgrade_level(
        artifact: &mut SudozArtifact,
        payment: Coin<SUI>,
        stats: &mut GlobalStats,
        random: &Random,
        ctx: &mut TxContext
    ) {
        upgrade_level(artifact, payment, stats, random, ctx);
    }

    public entry fun entry_upgrade_to_level(
        artifact: &mut SudozArtifact,
        target_level: u64,
        payment: Coin<SUI>,
        stats: &mut GlobalStats,
        random: &Random,
        ctx: &mut TxContext
    ) {
        upgrade_to_level(artifact, target_level, payment, stats, random, ctx);
    }

    /// Entry wrapper for evolve_artifact
    public entry fun entry_evolve_artifact(
        artifact: SudozArtifact,
        stats: &mut GlobalStats,
        evolved_stats: &mut evolved_sudoz::EvolvedStats,
        random: &Random,
        metadata_id: u64,
        background: String,
        skin: String,
        clothes: String,
        hats: String,
        eyewear: String,
        mouth: String,
        earrings: String,
        ctx: &mut TxContext
    ) {
        evolve_artifact(artifact, stats, evolved_stats, random, metadata_id, background, skin, clothes, hats, eyewear, mouth, earrings, ctx);
    }

    /// Upgrade level 10 artifact to evolved form
    public fun evolve_artifact(
        artifact: SudozArtifact,
        stats: &mut GlobalStats,
        evolved_stats: &mut evolved_sudoz::EvolvedStats,
        random: &Random,
        metadata_id: u64,
        background: String,
        skin: String,
        clothes: String,
        hats: String,
        eyewear: String,
        mouth: String,
        earrings: String,
        ctx: &mut TxContext
    ) {
        assert!(artifact.level == 10, E_NOT_LEVEL_10);
        
        let artifact_number = artifact.number;
        let artifact_path = *option::borrow(&artifact.path);
        let artifact_id = object::uid_to_inner(&artifact.id);
        
        // Burn the artifact
        let SudozArtifact { 
            id, 
            name: _, 
            description: _, 
            image_url: _, 
            number: _,
            level: _,
            points: _,
            path: _,
            attributes: _
        } = artifact;
        object::delete(id);
        
        stats.artifacts_burned = stats.artifacts_burned + 1;
        stats.level_10_burns = stats.level_10_burns + 1;
        
        // Get evolution auth from stats
        assert!(option::is_some(&stats.evolution_auth), E_BURN_NOT_ENABLED);
        let auth = option::borrow(&stats.evolution_auth);
        
        // Call evolved contract to mint evolved NFT
        let evolved = evolved_sudoz::mint_evolved_for_evolution(
            auth,
            artifact_number,
            artifact_path,
            evolved_stats,
            random,
            metadata_id,
            background,
            skin,
            clothes,
            hats,
            eyewear,
            mouth,
            earrings,
            ctx
        );
        
        let evolved_id = object::id(&evolved);
        let evolved_number = evolved_sudoz::get_evolved_number(&evolved);
        
        event::emit(ArtifactBurnedForEvolved {
            artifact_id,
            evolved_id,
            artifact_number,
            evolved_number
        });
        
        // Transfer evolved NFT to sender
        transfer::public_transfer(evolved, tx_context::sender(ctx));
    }

    /// Entry wrapper for evolve_artifact_with_policy (creates kiosk automatically)
    public entry fun entry_evolve_artifact_with_policy(
        artifact: SudozArtifact,
        policy: &TransferPolicy<evolved_sudoz::EvolvedSudoz>,
        stats: &mut GlobalStats,
        evolved_stats: &mut evolved_sudoz::EvolvedStats,
        random: &Random,
        metadata_id: u64,
        background: String,
        skin: String,
        clothes: String,
        hats: String,
        eyewear: String,
        mouth: String,
        earrings: String,
        ctx: &mut TxContext
    ) {
        evolve_artifact_with_policy(artifact, policy, stats, evolved_stats, random, metadata_id, background, skin, clothes, hats, eyewear, mouth, earrings, ctx);
    }

    /// Upgrade level 10 artifact to evolved form (with automatic kiosk lock)
    public fun evolve_artifact_with_policy(
        artifact: SudozArtifact,
        policy: &TransferPolicy<evolved_sudoz::EvolvedSudoz>,
        stats: &mut GlobalStats,
        evolved_stats: &mut evolved_sudoz::EvolvedStats,
        random: &Random,
        metadata_id: u64,
        background: String,
        skin: String,
        clothes: String,
        hats: String,
        eyewear: String,
        mouth: String,
        earrings: String,
        ctx: &mut TxContext
    ) {
        assert!(artifact.level == 10, E_NOT_LEVEL_10);
        
        let artifact_number = artifact.number;
        let artifact_path = *option::borrow(&artifact.path);
        let artifact_id = object::uid_to_inner(&artifact.id);
        
        // Check if burn mechanisms are enabled
        assert!(stats.burn_mechanisms_enabled, E_BURN_NOT_ENABLED);
        
        // Record the burn for level 10
        stats.level_10_burns = stats.level_10_burns + 1;
        
        // Delete the level 10 artifact
        let SudozArtifact { 
            id, 
            name: _, 
            description: _, 
            image_url: _, 
            number: _, 
            level: _, 
            points: _, 
            path: _, 
            attributes: _ 
        } = artifact;
        object::delete(id);
        stats.artifacts_burned = stats.artifacts_burned + 1;
        
        // Get evolution auth from stats
        assert!(option::is_some(&stats.evolution_auth), E_BURN_NOT_ENABLED);
        let auth = option::borrow(&stats.evolution_auth);
        
        // Call evolved contract to mint evolved NFT
        let evolved = evolved_sudoz::mint_evolved_for_evolution(
            auth,
            artifact_number,
            artifact_path,
            evolved_stats,
            random,
            metadata_id,
            background,
            skin,
            clothes,
            hats,
            eyewear,
            mouth,
            earrings,
            ctx
        );
        
        let evolved_id = object::id(&evolved);
        let evolved_number = evolved_sudoz::get_evolved_number(&evolved);
        
        // Create kiosk and lock the evolved NFT automatically
        let (kiosk, kiosk_cap) = kiosk::new(ctx);
        kiosk::lock(&mut kiosk, &kiosk_cap, policy, evolved);
        
        // Transfer kiosk ownership to sender
        transfer::public_share_object(kiosk);
        transfer::public_transfer(kiosk_cap, tx_context::sender(ctx));
        
        event::emit(ArtifactBurnedForEvolved {
            artifact_id,
            evolved_id,
            artifact_number,
            evolved_number
        });
    }

    /// Burn a level 10 artifact and lock evolved NFT in user's existing kiosk
    public entry fun evolve_artifact_to_kiosk(
        artifact: SudozArtifact,
        kiosk: &mut Kiosk,
        kiosk_cap: &KioskOwnerCap,
        policy: &TransferPolicy<evolved_sudoz::EvolvedSudoz>,
        stats: &mut GlobalStats,
        evolved_stats: &mut evolved_sudoz::EvolvedStats,
        random: &Random,
        metadata_id: u64,
        background: String,
        skin: String,
        clothes: String,
        hats: String,
        eyewear: String,
        mouth: String,
        earrings: String,
        ctx: &mut TxContext
    ) {
        assert!(stats.burn_mechanisms_enabled, E_BURN_NOT_ENABLED);
        assert!(artifact.level == 10, E_NOT_LEVEL_10);
        
        let artifact_id = object::id(&artifact);
        let artifact_number = artifact.number;
        let artifact_path = *option::borrow(&artifact.path);
        
        // Burn the artifact
        let SudozArtifact { 
            id, 
            name: _, 
            description: _, 
            image_url: _, 
            number: _, 
            level: _, 
            points: _, 
            path: _, 
            attributes: _ 
        } = artifact;
        object::delete(id);
        
        stats.artifacts_burned = stats.artifacts_burned + 1;
        stats.level_10_burns = stats.level_10_burns + 1;
        
        // Get evolution auth from stats
        assert!(option::is_some(&stats.evolution_auth), E_BURN_NOT_ENABLED);
        let auth = option::borrow(&stats.evolution_auth);
        
        // Call evolved contract to mint evolved NFT
        let evolved = evolved_sudoz::mint_evolved_for_evolution(
            auth,
            artifact_number,
            artifact_path,
            evolved_stats,
            random,
            metadata_id,
            background,
            skin,
            clothes,
            hats,
            eyewear,
            mouth,
            earrings,
            ctx
        );
        
        let evolved_id = object::id(&evolved);
        let evolved_number = evolved_sudoz::get_evolved_number(&evolved);
        
        // Lock evolved NFT permanently in user's existing kiosk
        kiosk::lock(kiosk, kiosk_cap, policy, evolved);
        
        event::emit(ArtifactBurnedForEvolved {
            artifact_id,
            evolved_id,
            artifact_number,
            evolved_number
        });
    }

    /// Withdraw dev pool (only dev can call)
    public entry fun withdraw_dev_pool(
        stats: &mut GlobalStats,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == DEV_ADDRESS, E_NOT_AUTHORIZED);
        
        let amount = balance::value(&stats.dev_pool);
        assert!(amount > 0, E_NO_BALANCE);
        
        let dev_balance = balance::withdraw_all(&mut stats.dev_pool);
        transfer::public_transfer(
            coin::from_balance(dev_balance, ctx),
            DEV_ADDRESS
        );
        
        event::emit(DevPoolWithdrawn { 
            amount,
            withdrawn_by: tx_context::sender(ctx),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    /// Withdraw founder pool (only founder address can call)
    public entry fun withdraw_founder_pool(
        stats: &mut GlobalStats,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == FOUNDER_ADDRESS, E_NOT_AUTHORIZED);
        
        let amount = balance::value(&stats.founder_pool);
        assert!(amount > 0, E_NO_BALANCE);
        
        let founder_balance = balance::withdraw_all(&mut stats.founder_pool);
        transfer::public_transfer(
            coin::from_balance(founder_balance, ctx),
            FOUNDER_ADDRESS
        );
        
        event::emit(FounderPoolWithdrawn { 
            amount,
            withdrawn_by: tx_context::sender(ctx),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    /// Enable burn mechanisms when evolved supply is complete
    public fun enable_burn_mechanisms(
        _: &AdminCap,
        stats: &mut GlobalStats,
        evolved_stats: &evolved_sudoz::EvolvedStats
    ) {
        assert!(evolved_sudoz::get_evolved_minted(evolved_stats) >= 5555, E_BURN_NOT_ENABLED);
        stats.burn_mechanisms_enabled = true;
    }

    /// Enable burn mechanisms for testing (Admin only - use for testnet)
    public entry fun enable_burn_for_testing(
        _: &AdminCap,
        stats: &mut GlobalStats,
        _ctx: &mut TxContext
    ) {
        stats.burn_mechanisms_enabled = true;
    }
    
    /// Burn for refund - returns 100% from FOUNDER POOL ONLY
    public fun burn_for_refund(
        artifact: SudozArtifact,
        stats: &mut GlobalStats,
        ctx: &mut TxContext
    ): Coin<SUI> {
        assert!(stats.burn_mechanisms_enabled, E_BURN_NOT_ENABLED);
        assert!(artifact.level >= MIN_LEVEL_FOR_REFUND, E_MINIMUM_LEVEL_FOR_REFUND);
        
        let sender = tx_context::sender(ctx);
        let nft_number = artifact.number;
        let level = artifact.level;
        let points = artifact.points;
        let path = artifact.path;
        
        // Calculate 100% refund
        let refund_amount = level * UPGRADE_COST_PER_LEVEL;
        
        // CHECK: Founder pool must have enough for refund
        assert!(
            balance::value(&stats.founder_pool) >= refund_amount, 
            E_INSUFFICIENT_FOUNDER_BALANCE
        );
        
        // Get or create burn record for this wallet
        if (!table::contains(&stats.burn_records, sender)) {
            table::add(&mut stats.burn_records, sender, BurnRecord {
                refund_burns: 0,
                refund_amount_claimed: 0,
                reward_burns: 0,
                total_points_accumulated: 0,
                burned_nfts: vector::empty(),
            });
        };
        
        let record = table::borrow_mut(&mut stats.burn_records, sender);
        
        // Update record
        record.refund_burns = record.refund_burns + 1;
        record.refund_amount_claimed = record.refund_amount_claimed + refund_amount;
        
        // Add detailed burn info
        vector::push_back(&mut record.burned_nfts, BurnedNFT {
            nft_number,
            level,
            points,
            path,
            burn_type: 0, // refund burn
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
        
        // Emit event
        event::emit(NFTBurnedForRefund {
            burner: sender,
            nft_number,
            level,
            refund_amount,
        });
        
        // Burn the NFT
        burn_artifact_internal(artifact, stats);
        
        // REFUND ONLY FROM FOUNDER POOL (Dev keeps their 15%)
        let refund_balance = balance::split(&mut stats.founder_pool, refund_amount);
        
        event::emit(RefundFromFounderPool {
            refund_amount,
            remaining_founder_balance: balance::value(&stats.founder_pool),
            dev_pool_untouched: balance::value(&stats.dev_pool),
        });
        
        coin::from_balance(refund_balance, ctx)
    }
    
    /// Burn for rewards - accumulates points (gamification feature)
    public fun burn_for_rewards(
        artifact: SudozArtifact,
        stats: &mut GlobalStats,
        ctx: &mut TxContext
    ) {
        assert!(stats.burn_mechanisms_enabled, E_BURN_NOT_ENABLED);
        assert!(artifact.level >= MIN_LEVEL_FOR_REWARDS, E_MINIMUM_LEVEL_FOR_REWARDS);
        
        let sender = tx_context::sender(ctx);
        let nft_number = artifact.number;
        let level = artifact.level;
        let points = artifact.points;
        let path = artifact.path;
        
        // Get or create burn record
        if (!table::contains(&stats.burn_records, sender)) {
            table::add(&mut stats.burn_records, sender, BurnRecord {
                refund_burns: 0,
                refund_amount_claimed: 0,
                reward_burns: 0,
                total_points_accumulated: 0,
                burned_nfts: vector::empty(),
            });
        };
        
        let record = table::borrow_mut(&mut stats.burn_records, sender);
        
        // Update record
        record.reward_burns = record.reward_burns + 1;
        record.total_points_accumulated = record.total_points_accumulated + points;
        
        // Add detailed burn info
        vector::push_back(&mut record.burned_nfts, BurnedNFT {
            nft_number,
            level,
            points,
            path,
            burn_type: 1, // reward burn
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
        
        // Emit event
        event::emit(NFTBurnedForRewards {
            burner: sender,
            nft_number,
            level,
            points,
        });
        
        // Burn the NFT
        burn_artifact_internal(artifact, stats);
    }
    
    /// Internal burn function
    fun burn_artifact_internal(artifact: SudozArtifact, stats: &mut GlobalStats) {
        let artifact_id = object::uid_to_inner(&artifact.id);
        let artifact_number = artifact.number;
        let level = artifact.level;
        
        // Destructure and delete
        let SudozArtifact { 
            id, 
            name: _, 
            description: _, 
            image_url: _, 
            number: _,
            level: _,
            points: _,
            path: _,
            attributes: _
        } = artifact;
        object::delete(id);
        
        stats.artifacts_burned = stats.artifacts_burned + 1;
        
        event::emit(ArtifactBurned {
            artifact_id,
            artifact_number,
            level,
        });
    }
    
    /// View burn records for a wallet
    public fun get_burn_record(stats: &GlobalStats, wallet: address): (u64, u64, u64, u64) {
        if (!table::contains(&stats.burn_records, wallet)) {
            return (0, 0, 0, 0)
        };
        
        let record = table::borrow(&stats.burn_records, wallet);
        (
            record.refund_burns,
            record.refund_amount_claimed,
            record.reward_burns,
            record.total_points_accumulated
        )
    }

    /// Get the path name based on path number
    fun get_path_name(path: u8): String {
        if (path == 0) {
            string::utf8(b"SUDO-A5 Frostbark")
        } else if (path == 1) {
            string::utf8(b"SUDO-E8 Toxinpup")
        } else if (path == 2) {
            string::utf8(b"SUDO-N0 Cryoblink")
        } else if (path == 3) {
            string::utf8(b"SUDO-V9 Emberfang")
        } else if (path == 4) {
            string::utf8(b"SUDO-X7 Glitchtail")
        } else if (path == 5) {
            string::utf8(b"SUDO-Z1 Aurapup")
        } else {
            string::utf8(b"SUDO-Z3 Voidpaw")
        }
    }

    /// Generate image URL based on level and path
    fun get_image_url(level: u64, path: Option<u8>): String {
        if (level == 0) {
            // All level 0 artifacts use the same image on Walrus
            string::utf8(b"https://walrus.tusky.io/tVHvHhsxTrqh4jMdJCkB8tlXy4IS0_I-onA7QKgIuH4")
        } else if (level >= 8) {
            // Levels 8, 9, 10 use shared metadata on IPFS
            if (level == 8) {
                string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/shared/level8.webp")
            } else if (level == 9) {
                string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/shared/level9.webp")
            } else {
                string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/shared/level10.webp")
            }
        } else {
            // Levels 1-7 use path-specific images on IPFS
            let path_val = *option::borrow(&path);
            
            if (path_val == 0) { // PATH_FROSTBARK
                if (level == 1) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/frostbark/level1.webp")
                else if (level == 2) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/frostbark/level2.webp")
                else if (level == 3) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/frostbark/level3.webp")
                else if (level == 4) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/frostbark/level4.webp")
                else if (level == 5) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/frostbark/level5.webp")
                else if (level == 6) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/frostbark/level6.webp")
                else string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/frostbark/level7.webp")
            } else if (path_val == 1) { // PATH_TOXINPUP
                if (level == 1) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/toxinpup/level1.webp")
                else if (level == 2) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/toxinpup/level2.webp")
                else if (level == 3) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/toxinpup/level3.webp")
                else if (level == 4) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/toxinpup/level4.webp")
                else if (level == 5) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/toxinpup/level5.webp")
                else if (level == 6) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/toxinpup/level6.webp")
                else string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/toxinpup/level7.webp")
            } else if (path_val == 2) { // PATH_CRYOBLINK
                if (level == 1) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/cryoblink/level1.webp")
                else if (level == 2) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/cryoblink/level2.webp")
                else if (level == 3) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/cryoblink/level3.webp")
                else if (level == 4) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/cryoblink/level4.webp")
                else if (level == 5) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/cryoblink/level5.webp")
                else if (level == 6) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/cryoblink/level6.webp")
                else string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/cryoblink/level7.webp")
            } else if (path_val == 3) { // PATH_EMBERFANG
                if (level == 1) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/emberfang/level1.webp")
                else if (level == 2) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/emberfang/level2.webp")
                else if (level == 3) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/emberfang/level3.webp")
                else if (level == 4) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/emberfang/level4.webp")
                else if (level == 5) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/emberfang/level5.webp")
                else if (level == 6) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/emberfang/level6.webp")
                else string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/emberfang/level7.webp")
            } else if (path_val == 4) { // PATH_GLITCHTAIL
                if (level == 1) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/glitchtail/level1.webp")
                else if (level == 2) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/glitchtail/level2.webp")
                else if (level == 3) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/glitchtail/level3.webp")
                else if (level == 4) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/glitchtail/level4.webp")
                else if (level == 5) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/glitchtail/level5.webp")
                else if (level == 6) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/glitchtail/level6.webp")
                else string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/glitchtail/level7.webp")
            } else if (path_val == 5) { // PATH_AURAPUP
                if (level == 1) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/aurapup/level1.webp")
                else if (level == 2) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/aurapup/level2.webp")
                else if (level == 3) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/aurapup/level3.webp")
                else if (level == 4) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/aurapup/level4.webp")
                else if (level == 5) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/aurapup/level5.webp")
                else if (level == 6) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/aurapup/level6.webp")
                else string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/aurapup/level7.webp")
            } else { // PATH_VOIDPAW (path_val == 6)
                if (level == 1) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/voidpaw/level1.webp")
                else if (level == 2) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/voidpaw/level2.webp")
                else if (level == 3) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/voidpaw/level3.webp")
                else if (level == 4) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/voidpaw/level4.webp")
                else if (level == 5) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/voidpaw/level5.webp")
                else if (level == 6) string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/voidpaw/level6.webp")
                else string::utf8(b"https://ipfs.io/ipfs/bafybeiefcgd7fd63zjlmagfrr5nmf64s3vjr2m7sc7ocfnsn4nplmjvnt4/voidpaw/level7.webp")
            }
        }
    }

    /// View functions for transparency
    public fun get_pool_balances(stats: &GlobalStats): (u64, u64) {
        (
            balance::value(&stats.dev_pool),
            balance::value(&stats.founder_pool)
        )
    }
    
    public fun get_dev_pool_balance(stats: &GlobalStats): u64 {
        balance::value(&stats.dev_pool)
    }
    
    public fun get_founder_pool_balance(stats: &GlobalStats): u64 {
        balance::value(&stats.founder_pool)
    }

    /// Getters for NFT attributes
    public fun get_level(nft: &SudozArtifact): u64 { nft.level }
    public fun get_points(nft: &SudozArtifact): u64 { nft.points }
    public fun get_name(nft: &SudozArtifact): String { nft.name }
    public fun get_path(nft: &SudozArtifact): Option<u8> { nft.path }
    public fun get_number(nft: &SudozArtifact): u64 { nft.number }

    /// Get stats
    public fun get_artifacts_minted(stats: &GlobalStats): u64 { stats.artifacts_minted }
    public fun get_artifacts_burned(stats: &GlobalStats): u64 { stats.artifacts_burned }
    public fun get_level_10_burns(stats: &GlobalStats): u64 { stats.level_10_burns }
    public fun is_burn_enabled(stats: &GlobalStats): bool { stats.burn_mechanisms_enabled }
    
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
    
    /// Enable evolution system (Admin only)
    /// This function allows admins to enable the evolution system for testing and production
    public entry fun enable_evolution_system(
        _: &AdminCap,
        stats: &mut GlobalStats,
        evolution_auth: evolved_sudoz::EvolutionAuth
    ) {
        stats.burn_mechanisms_enabled = true;
        option::fill(&mut stats.evolution_auth, evolution_auth);
    }

    /// Disable evolution system (Admin only)
    /// This function allows admins to disable the evolution system if needed
    public fun disable_evolution_system(
        _: &AdminCap,
        stats: &mut GlobalStats
    ): evolved_sudoz::EvolutionAuth {
        stats.burn_mechanisms_enabled = false;
        option::extract(&mut stats.evolution_auth)
    }
    
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(SUDOZ_ARTIFACTS_V2 {}, ctx);
    }
    
    #[test_only]
    public fun enable_burn_for_testing(stats: &mut GlobalStats) {
        stats.burn_mechanisms_enabled = true;
    }
}