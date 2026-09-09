import loadPickupSetting from './loadPickupSetting';

describe('pickup store setting', () => {
  const originalFetch = global.fetch;
  const log = jest.fn();

  beforeEach(() => {
    global.fetch = jest.fn();
    log.mockClear();
  });

  afterEach(() => { global.fetch = originalFetch; });

  it.each([true, false, undefined, null, 'true', 1])(
    'requires an explicit true setting (received %s)',
    async (value) => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true, json: async () => ({ enable_in_store_pickup: value }),
      });

      expect(await loadPickupSetting('store-hash', log)).toBe(value === true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/store-front/api/stores/store-hash'), expect.any(Object),
      );
    },
  );

  it.each(['network', 'status', 'json'])('keeps pickup off on a %s failure', async (failure) => {
    if (failure === 'network') {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));
    } else {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: failure !== 'status', status: 503,
        json: async () => { throw new Error('Invalid JSON'); },
      });
    }

    expect(await loadPickupSetting('store-hash', log)).toBe(false);
    expect(log).toHaveBeenCalledTimes(1);
  });
});
