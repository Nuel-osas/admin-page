'use client';

import { useState } from 'react';
import ClaimPoolSection from './ClaimPoolSection';
import ClaimPoolDeposit from './ClaimPoolDeposit';
import ClaimPoolAdmin from './ClaimPoolAdmin';
import { Gift, Upload, Settings } from 'lucide-react';

export default function ClaimPoolManager() {
  const [activeTab, setActiveTab] = useState('claim');

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">NFT Claim Pool</h2>
        <p className="text-gray-600">
          Claim free SUDOZ ARTIFACT NFTs or contribute to the pool
        </p>
      </div>

      <div className="w-full">
        <div className="grid w-full grid-cols-3 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('claim')}
            className={`flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors ${
              activeTab === 'claim'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Gift className="h-4 w-4" />
            Claim NFTs
          </button>
          <button
            onClick={() => setActiveTab('deposit')}
            className={`flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors ${
              activeTab === 'deposit'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Upload className="h-4 w-4" />
            Deposit NFTs
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors ${
              activeTab === 'admin'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Settings className="h-4 w-4" />
            Admin Panel
          </button>
        </div>
        
        <div className="mt-6">
          {activeTab === 'claim' && <ClaimPoolSection />}
          {activeTab === 'deposit' && <ClaimPoolDeposit />}
          {activeTab === 'admin' && <ClaimPoolAdmin />}
        </div>
      </div>
    </div>
  );
}