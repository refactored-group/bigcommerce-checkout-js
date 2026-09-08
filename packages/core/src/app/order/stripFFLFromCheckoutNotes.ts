// Match the generated format and known URL hosts, not arbitrary shopper text
// mentioning an FFL. Repeated failed-payment appends are removed in one pass.
const generatedFFLBlock =
  /\|FFL#[^|\s]+\|Expiration:[^|\s]+\|EZcheck:https:\/\/fflezcheck\.atf\.gov\/FFLEzCheck\/fflSearch\?licsRegn=[^&|\s]+&licsDis=[^&|\s]+&licsSeq=[\w-]+(?:\|Certificate:https:\/\/certificate\.automaticffl\.com\/[\w-]+)?/g;

export default function stripFFLFromCheckoutNotes(message = ''): string {
  return message.replace(generatedFFLBlock, '');
}
