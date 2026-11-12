import composeFFLCheckoutNotes, {
  CHECKOUT_CUSTOMER_MESSAGE_MAX_LENGTH,
} from './composeFFLCheckoutNotes';

const dealer = {
  fflID: '6-04-123-01-5F-03791',
};
const block =
  '|FFL#6-04-123-01-5F-03791|Expiration:06/01/2025|EZcheck:https://fflezcheck.atf.gov/FFLEzCheck/fflSearch?licsRegn=6&licsDis=04&licsSeq=03791';

describe('composeFFLCheckoutNotes', () => {
  it('appends the existing generated format with and without a certificate', () => {
    expect(composeFFLCheckoutNotes('Call first', dealer)).toBe(`Call first${block}`);
    expect(composeFFLCheckoutNotes('', { ...dealer, uuid: 'certificate-uuid' })).toBe(
      `${block}|Certificate:https://certificate.automaticffl.com/certificate-uuid`,
    );
  });

  it('replaces repeated old blocks and is idempotent', () => {
    const oldBlock =
      '|FFL#1-23-456-01-7A-00001|Expiration:01/01/2027|EZcheck:https://fflezcheck.atf.gov/FFLEzCheck/fflSearch?licsRegn=1&licsDis=23&licsSeq=00001';
    const composed = composeFFLCheckoutNotes(`Keep this${oldBlock}${oldBlock}`, dealer);

    expect(composed).toBe(`Keep this${block}`);
    expect(composeFFLCheckoutNotes(composed, dealer)).toBe(composed);
  });

  it('returns customer text alone when no dealer is applicable', () => {
    expect(composeFFLCheckoutNotes(`${block}|customer suffix`)).toBe('|customer suffix');
    expect(composeFFLCheckoutNotes()).toBe('');
  });

  it('preserves partial blocks and ordinary customer references exactly', () => {
    const note = '  Ask my FFL first |FFL#partial\n';

    expect(composeFFLCheckoutNotes(note, dealer)).toBe(`${note}${block}`);
  });

  it('exports the BigCommerce customer-message limit', () => {
    expect(CHECKOUT_CUSTOMER_MESSAGE_MAX_LENGTH).toBe(2000);
  });
});
