import resolvePickupZip, { InvalidPickupZipError } from './resolvePickupZip';

const originalFetch = global.fetch;
let fetchMock: jest.Mock;
beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock;
});
afterEach(() => {
  global.fetch = originalFetch;
});

it('passes the entered ZIP including leading zeroes and abort signal to the store-scoped endpoint', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ latitude: 42.357, longitude: -71.064 }),
  });
  const signal = new AbortController().signal;
  expect(await resolvePickupZip('store-hash', '02108', signal)).toEqual({
    latitude: 42.357,
    longitude: -71.064,
  });
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/stores/store-hash/pickup/zip?zip=02108'),
    { signal },
  );
});

it('distinguishes a nonexistent ZIP from provider and authorization errors', async () => {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status: 422,
    json: async () => ({ error: 'invalid_zip' }),
  });
  await expect(resolvePickupZip('store', '00000')).rejects.toBeInstanceOf(InvalidPickupZipError);
  for (const status of [401, 403, 503]) {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status,
      json: async () => ({ error: 'unavailable' }),
    });
    await expect(resolvePickupZip('store', '02108')).rejects.toThrow(
      'Unable to resolve pickup ZIP',
    );
  }
});

it.each([
  {},
  { latitude: null, longitude: 0 },
  { latitude: 42, longitude: 'bad' },
  { latitude: 91, longitude: -71 },
  { latitude: 42, longitude: Infinity },
])('rejects malformed coordinates without defaulting to a location', async (body) => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => body });
  await expect(resolvePickupZip('store', '02108')).rejects.toThrow('Unable to resolve pickup ZIP');
});
