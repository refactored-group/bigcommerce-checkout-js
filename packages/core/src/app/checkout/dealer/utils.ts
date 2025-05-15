import { DealerData, DealerSelectionData } from './types';
import formatPhoneNumber from './PhoneNumberFormatter';

interface FormatDealerOptions {
  shouldSaveAddress?: boolean;
}

/**
 * Formats dealer data consistently for selection across different components
 * @param dealer The dealer data object
 * @param options Optional configuration for dealer selection
 * @returns Formatted dealer selection data for checkout
 */
export const formatDealerForSelection = (
  dealer: DealerData,
  options: FormatDealerOptions = {},
): DealerSelectionData => {
  const { shouldSaveAddress = false } = options;
  const formattedPhoneNumber = formatPhoneNumber({ phoneNumber: dealer.phone_number });

  return {
    firstName: dealer.business_name,
    lastName: dealer.license,
    phone: formattedPhoneNumber,
    company: `${dealer.business_name} - ${dealer.license}`,
    address1: dealer.premise_street,
    address2: '',
    city: dealer.premise_city,
    stateOrProvinceCode: dealer.premise_state,
    stateOrProvince: dealer.premise_state,
    shouldSaveAddress,
    postalCode: dealer.premise_zip,
    country: 'United States',
    localizedCountry: 'United States',
    countryCode: 'US',
    fflID: dealer.license,
    dealerId: dealer.id,
    customFields: [],
  };
};
