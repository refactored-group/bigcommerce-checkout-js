const API_BASE = `https://${process.env.HOST}/store-front/api`;

export interface StoreConfig {
    announcement: string;
    multi_shipment: boolean;
    with_ammo_subscription: boolean;
    ffl_to_order_comments: boolean;
    bypass_option: boolean;
    bypass_text: string;
    merchant: {
        merchant_states: Array<{ enabled: boolean; state: string }>;
    };
}

/**
 * Fetches the store's FFL configuration from the AutoFFL API.
 */
export async function fetchStoreConfig(storeHash: string): Promise<StoreConfig> {
    const response = await fetch(`${API_BASE}/stores/${storeHash}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    return response.json();
}

/**
 * Logs a dealer selection event for analytics purposes.
 * Fire-and-forget — errors are logged but not thrown.
 */
export function logDealerSelection(storeHash: string, dealerId: string): void {
    fetch(`${API_BASE}/${storeHash}/dealers/${dealerId}/select`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    }).catch((error) => {
        console.log('Error logging dealer selection:', error);
    });
}
