import stripFFLFromCheckoutNotes from './stripFFLFromCheckoutNotes';

export const CHECKOUT_CUSTOMER_MESSAGE_MAX_LENGTH = 2000;

export interface FFLCheckoutDealer {
  fflID: string;
  uuid?: string;
}

const months: Record<string, string> = {
  A: '01',
  B: '02',
  C: '03',
  D: '04',
  E: '05',
  F: '06',
  G: '07',
  H: '08',
  J: '09',
  K: '10',
  L: '11',
  M: '12',
};

/**
 * Produces the single BigCommerce customerMessage value owned by checkout.
 * Customer text is preserved byte-for-byte except for generated Automatic FFL
 * blocks, which are replaced with the currently confirmed dealer when present.
 */
export default function composeFFLCheckoutNotes(
  message = '',
  selectedFFL?: FFLCheckoutDealer | null,
): string {
  const customerMessage = stripFFLFromCheckoutNotes(message);

  if (!selectedFFL) {
    return customerMessage;
  }

  const expiryMonth = months[selectedFFL.fflID.slice(13, 14)];
  const expiryYear = `202${selectedFFL.fflID.slice(12, 13)}`;
  const fflParts = selectedFFL.fflID.split('-');
  const licsRegn = fflParts[0];
  const licsDis = fflParts[1];
  const licsSeq = fflParts[5];
  const atfLink =
    `https://fflezcheck.atf.gov/FFLEzCheck/fflSearch?` +
    `licsRegn=${licsRegn}&licsDis=${licsDis}&licsSeq=${licsSeq}`;
  const certificateURL = selectedFFL.uuid
    ? `|Certificate:https://certificate.automaticffl.com/${selectedFFL.uuid}`
    : '';

  return (
    `${customerMessage}|FFL#${selectedFFL.fflID}` +
    `|Expiration:${expiryMonth}/01/${expiryYear}|EZcheck:${atfLink}${certificateURL}`
  );
}
