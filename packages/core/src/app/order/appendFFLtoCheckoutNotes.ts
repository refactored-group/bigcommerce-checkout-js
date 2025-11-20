// @ts-nocheck
export default async function appendFFLtoCheckoutNotes(
  checkout,
  updateCheckout,
  selectedFFL
): Promise<CheckoutSelectors> {
  // Appends FFL information to the checkout order comments in the following format:
  // Format: <existing message>|FFL#<license>|Expiration:<date>|EZcheck:<url>
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
  const expiryYear = `202${selectedFFL.fflID.slice(12, 13)}`;

  // Parse FFL number components for ATF link
  // Split by dashes and get relevant parts
  const fflParts = selectedFFL.fflID.split('-');
  const licsRegn = fflParts[0]; // First part (6)
  const licsDis = fflParts[1]; // Second part (04)
  const licsSeq = fflParts[5]; // Last part (03791)
  const atfLink = `https://fflezcheck.atf.gov/FFLEzCheck/fflSearch?licsRegn=${licsRegn}&licsDis=${licsDis}&licsSeq=${licsSeq}`;
  const certificateURL = '';

  await fetch(`https://${process.env.HOST}/store-front/api/dealers/${selectedFFL.id}/certificate`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then(res => {
      if (res.status === 404) {
        return null;
      } else{
        return res.json();
      }
    })
    .then(data => {
      if (data === null) {
        console.log(`No FFL certificate found for ${selectedFFL.fflID}`)
      } else {
        certificateURL = `|Certificate:${data.url}`;
      }
    })
    .catch(err => {
      console.log('Certificate fetch failed:', err);
    });

  const message = `${checkout.customerMessage}|FFL#${selectedFFL.fflID}|Expiration:${expiryMonth}/01/${expiryYear}|EZcheck:${atfLink}${certificateURL}`;

  await updateCheckout({ customerMessage: message });
}
