import { Checkout, CheckoutSelectors, CheckoutRequestBody } from '@bigcommerce/checkout-sdk';
import { DealerSelectionData } from './types';

export default async function appendFFLtoCheckoutNotes(
  checkout: Checkout,
  updateCheckout: (payload: CheckoutRequestBody) => Promise<CheckoutSelectors>,
  selectedFFL: DealerSelectionData,
): Promise<void> {
  // Appends FFL information to the checkout order comments in the following format:
  // Format: <existing message>|FFL#<license>|Expiration:<date>|EZcheck:<url>|Certificate:<url>
  const months = {
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
  const expiryMonth = months[selectedFFL.fflID.slice(13, 14)];
  // FFL license encodes expiry year as a single digit at position 12.
  // This digit represents the last digit of the year (e.g., 5 = 2025, 0 = 2030).
  // Determine the correct decade based on the current year.
  const yearDigit = parseInt(selectedFFL.fflID.slice(12, 13), 10);
  const currentYear = new Date().getFullYear();
  const currentDecade = Math.floor(currentYear / 10) * 10;
  let expiryYear = currentDecade + yearDigit;
  // If the computed year is more than 5 years in the past, it's likely the next decade
  if (expiryYear < currentYear - 5) {
    expiryYear += 10;
  }

  // Parse FFL number components for ATF link
  // Split by dashes and get relevant parts
  const fflParts = selectedFFL.fflID.split('-');
  const licsRegn = fflParts[0]; // First part (6)
  const licsDis = fflParts[1]; // Second part (04)
  const licsSeq = fflParts[5]; // Last part (03791)
  const atfLink = `https://fflezcheck.atf.gov/FFLEzCheck/fflSearch?licsRegn=${licsRegn}&licsDis=${licsDis}&licsSeq=${licsSeq}`;

  // Build certificate URL from uuid if available
  const certificateURL = selectedFFL.uuid
    ? `|Certificate:https://certificate.automaticffl.com/${selectedFFL.uuid}`
    : '';

  const message = `${checkout.customerMessage}|FFL#${selectedFFL.fflID}|Expiration:${expiryMonth}/01/${expiryYear}|EZcheck:${atfLink}${certificateURL}`;

  await updateCheckout({ customerMessage: message });
}
