export async function ensureKiosk(
  client: SuiClient,
  userAddress: string,
  tx: Transaction
): Promise<{ kioskId: any; kioskCap: any; isNew: boolean }> {
  try {
    const kiosks = await getUserKiosks(client, userAddress);
    
    if (kiosks.length > 0) {
      // Use first existing kiosk
      console.log('Using existing kiosk:', kiosks[0].kioskId);
      return {
        kioskId: tx.object(kiosks[0].kioskId),
        kioskCap: tx.object(kiosks[0].kioskCap),
        isNew: false
      };
    } else {
      // Create new kiosk in the same transaction
      console.log('Creating new kiosk in transaction');
      const [kiosk, kioskCap] = tx.moveCall({
        target: '0x2::kiosk::new',
        arguments: [],
      });
      
      // Share the kiosk - this must happen AFTER we use it
      // So we'll return the kiosk and cap, and let the caller handle sharing
      
      return {
        kioskId: kiosk,     // Return the transaction result directly
        kioskCap: kioskCap,  // Return the transaction result directly
        isNew: true
      };
    }
  } catch (error) {
    console.error('Error in ensureKiosk:', error);
    throw error;
  }
}