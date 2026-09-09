export default async function loadPickupSetting(
  storeHash: string,
  log: (error: Error) => void,
): Promise<boolean> {
  try {
    const response = await fetch(`https://${process.env.HOST}/store-front/api/stores/${storeHash}`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Store settings request failed with status ${response.status}`);
    }

    const settings = await response.json();

    return settings?.enable_in_store_pickup === true;
  } catch (error) {
    log(error instanceof Error ? error : new Error(String(error)));

    return false;
  }
}
