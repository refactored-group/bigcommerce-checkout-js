import { PickupCoordinates } from './pickup';

export class InvalidPickupZipError extends Error {
  constructor() {
    super('Invalid pickup ZIP');
    Object.setPrototypeOf(this, InvalidPickupZipError.prototype);
  }
}

export default async function resolvePickupZip(
  storeHash: string,
  zip: string,
  signal?: AbortSignal,
): Promise<PickupCoordinates> {
  const response = await fetch(
    `https://${process.env.HOST}/store-front/api/stores/${encodeURIComponent(
      storeHash,
    )}/pickup/zip?zip=${encodeURIComponent(zip)}`,
    { signal },
  );
  const body = await response.json();

  if (response.status === 422 && body.error === 'invalid_zip') {
    throw new InvalidPickupZipError();
  }

  if (
    !response.ok ||
    typeof body.latitude !== 'number' ||
    typeof body.longitude !== 'number' ||
    !Number.isFinite(body.latitude) ||
    !Number.isFinite(body.longitude) ||
    Math.abs(body.latitude) > 90 ||
    Math.abs(body.longitude) > 180
  ) {
    throw new Error('Unable to resolve pickup ZIP');
  }

  return { latitude: body.latitude, longitude: body.longitude };
}
