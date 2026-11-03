import { Country } from '@bigcommerce/checkout-sdk';
import React from 'react';

interface StatesDropdownProps {
  selectedState: string;
  subdivisions: Country['subdivisions'];
  validateSelectedState: any;
}

interface StatesDropdownState {}

export default class StatesDropdown extends React.PureComponent<
  StatesDropdownProps,
  StatesDropdownState
> {
  constructor(props: any) {
    super(props);
  }

  render() {
    return (
      <div className="dynamic-form-field" style={{ paddingBottom: '1rem' }}>
        <div className="form-field">
          <label className="form-label optimizedCheckout-form-label">State/Province</label>
          <div className="dropdown-chevron">
            <div className="icon">
              <svg height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"></path>
              </svg>
            </div>
          </div>
          <select
            className="form-select optimizedCheckout-form-select"
            onChange={this.props.validateSelectedState}
            id="provinceCodeInput"
            value={this.props.selectedState}
            disabled={this.props.subdivisions.length === 0}
          >
            <option value="">Select a state</option>
            {this.props.subdivisions.map(({ code, name }) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }
}
