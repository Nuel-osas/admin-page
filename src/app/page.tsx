'use client';

import { WalletConnect } from '@/components/WalletConnect';
import { NFTList } from '@/components/NFTList';
import { EvolvedNFTList } from '@/components/EvolvedNFTList';
import { MintNFT } from '@/components/MintNFT';
import { AdminSection } from '@/components/AdminSection';
import { EvolvedStats } from '@/components/EvolvedStats';
import { KioskManager } from '@/components/KioskManager';
import ClaimPoolManager from '@/components/ClaimPoolManager';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                SUDOZ ARTIFACTS
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Evolve to THE SUDOZ - Limited supply available
              </p>
            </div>
            <WalletConnect />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminSection />
        
        <EvolvedStats />
        
        <KioskManager />
        
        <div className="mb-8">
          <ClaimPoolManager />
        </div>
        
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Test Controls</h2>
          <MintNFT />
        </div>

        <EvolvedNFTList />
        
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Your SUDOZ ARTIFACTS</h2>
          <NFTList />
        </div>

        <div className="bg-white rounded-lg p-6 mt-8">
          <h3 className="text-lg font-bold mb-2">How to Test</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-600">
            <li>Connect your wallet (make sure you're on Sui Testnet)</li>
            <li>If you're the admin, you can mint NFTs using the mint button</li>
            <li>Each NFT starts at level 0 with 2 points</li>
            <li>Click "Upgrade" to upgrade by 1 level (costs 1 SUI)</li>
            <li>Click "To Level 10" to upgrade directly to level 10 (costs remaining SUI)</li>
            <li>At level 10, you can evolve your NFT (burns it to create an Evolved SUDOZ)</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
