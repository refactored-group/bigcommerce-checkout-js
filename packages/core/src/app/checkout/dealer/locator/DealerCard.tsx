import React from 'react';

import Fees from './Fees';
import Schedules from './Schedules';

export default function DealerCard(props: any): any {
  const { dealer, index } = props;

  const formatPhoneNumber = (phoneNumber: any) => {
    const cleanedNumber = (`${  phoneNumber}`).replace(/\D/g, '');
    const setNumber = cleanedNumber.match(/^(\d{3})(\d{3})(\d{4})$/);

    if (setNumber) {
      return `(${setNumber[1]})-${setNumber[2]}-${setNumber[3]}`;
    }

    return null;
  };

  const formattedDealerPhoneNumber = formatPhoneNumber(dealer.phone_number);

  const handleSelect = () => props.selectDealer({
    
      firstName: dealer.business_name,
      lastName: dealer.license,
      phone: formattedDealerPhoneNumber,
      company: `${dealer.business_name} - ${dealer.license}`,
      address1: dealer.premise_street,
      address2: '',
      city: dealer.premise_city,
      stateOrProvinceCode: dealer.premise_state,
      shouldSaveAddress: false,
      postalCode: dealer.premise_zip,
      localizedCountry: 'United States',
      countryCode: 'US',
      fflID: dealer.license
  });

  const dealerType = dealer.preferred
    ? "locator-modal-dealer preferred"
    : "locator-modal-dealer"

  return (
    <div className={ dealerType }>
    <div className="locator-modal-dealer-index">{index +1}</div>
    <div className="locator-modal-dealer-content">
    <div>
      {
        dealer.preferred && <div title="Preferred Dealer" className="locator-modal-dealer-star"></div>
      }
      {dealer.business_name}
    </div>
      <div>{`${dealer.premise_street}, ${dealer.premise_city}, ${dealer.premise_state} ${dealer.premise_zip}`}</div>
      <a href={`tel:${ formattedDealerPhoneNumber }`}>{formattedDealerPhoneNumber}</a>
    </div>
    <Fees fees={dealer.fees} />
    <Schedules schedules={dealer.schedules} />
    <button
      className="locator-button dealer"
      onClick={ handleSelect }>select</button>
  </div>)
}
