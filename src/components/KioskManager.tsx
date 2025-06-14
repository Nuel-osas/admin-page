'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { getUserKiosks, KioskInfo } from '@/utils/kioskUtils';

export function KioskManager() {
  const [kiosks, setKiosks] = useState<KioskInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const account = useCurrentAccount();
  const client = useSuiClient();

  useEffect(() => {
    if (account?.address) {
      loadKiosks();
    }
  }, [account?.address]);

  const loadKiosks = async () => {
    if (!account?.address) return;
    
    setLoading(true);
    try {
      const userKiosks = await getUserKiosks(client, account.address);
      setKiosks(userKiosks);
    } catch (error) {
      console.error('Failed to load kiosks:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!account) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <h2 className="text-2xl font-bold mb-4">Your Kiosks</h2>
      
      {loading ? (
        <p className="text-gray-500">Loading kiosks...</p>
      ) : kiosks.length === 0 ? (
        <p className="text-gray-500">No kiosks found. Kiosks will be created when you evolve NFTs.</p>
      ) : (
        <div className="space-y-4">
          {kiosks.map((kiosk, index) => (
            <div key={kiosk.kioskId} className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">Kiosk {index + 1}</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>ID: {kiosk.kioskId}</p>
                <p>Items: {kiosk.items}</p>
                <p>Cap: {kiosk.kioskCap.slice(0, 16)}...</p>
              </div>
              <a
                href={`https://suivision.xyz/object/${kiosk.kioskId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-blue-500 hover:text-blue-600 text-sm"
              >
                View on Explorer →
              </a>
            </div>
          ))}
        </div>
      )}
      
      <button
        onClick={loadKiosks}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        disabled={loading}
      >
        Refresh Kiosks
      </button>
    </div>
  );
}