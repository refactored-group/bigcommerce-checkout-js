import React from 'react';

import formatPhoneNumber from '../PhoneNumberFormatter';
import { formatDealerForSelection } from '../utils';
import { DealerData } from '../types';
import Fees from './Fees';
import Schedules from './Schedules';

interface DealerCardProps {
  dealer: DealerData;
  index: number;
  selectDealer: (dealer: any) => void;
}

export default function DealerCard(props: DealerCardProps): JSX.Element {
  const { dealer, index } = props;

  const formattedDealerPhoneNumber = formatPhoneNumber({ phoneNumber: dealer.phone_number });

  const handleSelect = () => props.selectDealer(formatDealerForSelection(dealer));

  const dealerType = dealer.preferred ? 'locator-modal-dealer preferred' : 'locator-modal-dealer';

  return (
    <div className={dealerType}>
      <div className="locator-modal-dealer-index">{index + 1}</div>
      <div className="locator-modal-dealer-content">
        <div>
          {dealer.preferred && (
            <div title="Preferred Dealer" className="locator-modal-dealer-star"></div>
          )}
          {dealer.business_name}
        </div>
        <div>{`${dealer.premise_street}, ${dealer.premise_city}, ${dealer.premise_state} ${dealer.premise_zip}`}</div>
        <a href={`tel:${dealer.phone_number}`}>{formattedDealerPhoneNumber}</a>
      </div>
      <Fees fees={dealer.fees} />
      <Schedules schedules={dealer.schedules} />
      <button className="locator-button dealer" onClick={handleSelect}>
        select
      </button>
    </div>
  );
}
