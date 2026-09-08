import stripFFLFromCheckoutNotes from './stripFFLFromCheckoutNotes';

const block =
  '|FFL#6-04-123-01-5F-03791|Expiration:06/01/2025|EZcheck:https://fflezcheck.atf.gov/FFLEzCheck/fflSearch?licsRegn=6&licsDis=04&licsSeq=03791';
const certificate = '|Certificate:https://certificate.automaticffl.com/12345678-abcd';

it('removes repeated generated dealer blocks and preserves shopper text on both sides', () => {
  expect(stripFFLFromCheckoutNotes(`Call me${block}${certificate}${block}|Leave at desk`)).toBe(
    'Call me|Leave at desk',
  );
  expect(stripFFLFromCheckoutNotes(stripFFLFromCheckoutNotes(`Call me${block}`))).toBe('Call me');
});

it('does not remove ordinary FFL mentions, unknown URLs, or partial notes', () => {
  for (const text of [
    'Ask my FFL first',
    '|FFL#123',
    '|FFL#123|Expiration:soon|EZcheck:https://example.com',
  ]) {
    expect(stripFFLFromCheckoutNotes(text)).toBe(text);
  }
  expect(stripFFLFromCheckoutNotes()).toBe('');
});
