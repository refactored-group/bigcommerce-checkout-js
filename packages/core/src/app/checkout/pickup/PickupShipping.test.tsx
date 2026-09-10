import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { createLocaleContext, LocaleContext } from '@bigcommerce/checkout/locale';

import { getStoreConfig } from '../../config/config.mock';

import { PickupChoice } from './pickup';
import { initialPickupState } from './PickupController';
import PickupShipping, { FulfillmentChoice } from './PickupShipping';

const choice: PickupChoice = {
  id: 7,
  displayName: 'Curbside',
  distanceMiles: 1.24,
  collectionInstructions: 'Call when you arrive',
  location: {
    entityId: 2,
    label: 'Downtown',
    address: {
      address1: '123 Main Street',
      city: 'Austin',
      stateOrProvince: 'TX',
      postalCode: '78701',
      countryCode: 'US',
      latitude: 30,
      longitude: -97,
    },
  },
};

const setup = (choices = [choice]) => {
  const props = {
    pickup: {
      ...initialPickupState,
      intent: 'pickup' as const,
      status: 'ready' as const,
      choices,
      zip: '78701',
      searchedZip: '78701',
      draftMethodId: 7,
    },
    customerMessage: 'Keep this note',
    showOrderComments: true,
    onConfirm: jest.fn().mockResolvedValue(undefined),
    onShipping: jest.fn().mockResolvedValue(undefined),
    onSelect: jest.fn(),
    onRetry: jest.fn(),
    onZipChange: jest.fn(),
    onSearch: jest.fn(),
  };
  const view = render(
    <LocaleContext.Provider value={createLocaleContext(getStoreConfig())}>
      <PickupShipping {...props} />
    </LocaleContext.Provider>,
  );

  return { props, ...view };
};

it('accepts a pickup click without showing background availability text', () => {
  const onChange = jest.fn();
  render(
    <LocaleContext.Provider value={createLocaleContext(getStoreConfig())}>
      <FulfillmentChoice disabled={false} intent="shipping" onChange={onChange} />
    </LocaleContext.Provider>,
  );

  expect((screen.getByRole('radio', { name: 'Ship my order' }) as HTMLInputElement).disabled).toBe(
    false,
  );
  expect(screen.queryByText('Checking pickup availability…')).toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: 'Pick up in store' }));
  expect(onChange).toHaveBeenCalledWith('pickup');
});

it('shows pending availability after selecting pickup and blocks Continue until it finishes', () => {
  const { props, rerender } = setup();
  rerender(
    <LocaleContext.Provider value={createLocaleContext(getStoreConfig())}>
      <PickupShipping
        {...props}
        pickup={{ ...props.pickup, status: 'loading', choices: [], draftMethodId: undefined }}
      />
    </LocaleContext.Provider>,
  );

  expect(screen.getByText('Checking pickup availability…')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.click(screen.getByRole('radio', { name: 'Ship my order' }));
  expect(props.onShipping).toHaveBeenCalledWith('Keep this note');
});

it('shows accessible pickup cards, selected instructions, and destination-only directions', () => {
  setup([choice, { ...choice, id: 8, displayName: 'In-store' }]);
  expect(screen.getByRole('radio', { name: /Downtown — Curbside/ })).toBeChecked();
  expect(screen.getByRole('radio', { name: /Downtown — In-store/ })).not.toBeChecked();
  expect(screen.getAllByText('Call when you arrive')).toHaveLength(1);
  const directions = screen.getAllByRole('link', { name: /123 Main Street.*Austin, TX 78701/ });
  expect(directions).toHaveLength(2);
  expect(directions[0].textContent).toBe('123 Main Street, Austin, TX 78701');
  expect(directions[0].getAttribute('href')).toContain('destination=123%20Main');
  expect(directions[0].getAttribute('href')).not.toContain('origin=');
  expect(directions[0]).toHaveAttribute('target', '_blank');
  expect(screen.queryByText('Directions')).toBeNull();
});

it('opens the address independently while the rest of the pickup row selects the store', () => {
  const { props } = setup([
    choice,
    { ...choice, id: 8, displayName: 'In-store', collectionTimeDescription: 'Ready tomorrow' },
  ]);

  fireEvent.click(screen.getAllByRole('link', { name: /123 Main Street/ })[1]);
  expect(props.onSelect).not.toHaveBeenCalled();
  expect(screen.getByRole('radio', { name: /Downtown — Curbside/ })).toBeChecked();

  fireEvent.click(screen.getByText('Ready tomorrow'));
  expect(props.onSelect).toHaveBeenCalledWith(8);
});

it('only commits on Continue and preserves edited comments when switching to shipping', async () => {
  const { props } = setup([choice, { ...choice, id: 8, displayName: 'In-store' }]);
  fireEvent.click(screen.getByRole('radio', { name: /Downtown — In-store/ }));
  expect(props.onSelect).toHaveBeenCalledWith(8);
  expect(props.onConfirm).not.toHaveBeenCalled();
  fireEvent.change(screen.getByDisplayValue('Keep this note'), {
    target: { value: 'Call me first' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(props.onConfirm).toHaveBeenCalledWith('Call me first'));
  fireEvent.click(screen.getByRole('radio', { name: 'Ship my order' }));
  await waitFor(() => expect(props.onShipping).toHaveBeenCalledWith('Call me first'));
});

it('keeps the search blank on entry and uses Enter only for searching', () => {
  const { props, rerender } = setup();
  rerender(
    <LocaleContext.Provider value={createLocaleContext(getStoreConfig())}>
      <PickupShipping {...props} pickup={{ ...initialPickupState, intent: 'pickup' }} />
    </LocaleContext.Provider>,
  );
  const zip = screen.getByRole('textbox', { name: 'ZIP code' });
  expect(zip).toHaveValue('');
  expect(props.onSearch).not.toHaveBeenCalled();
  expect(screen.queryByText('Checking pickup availability…')).toBeNull();
  fireEvent.change(zip, { target: { value: '02108' } });
  expect(props.onZipChange).toHaveBeenCalledWith('02108');
  fireEvent.keyDown(zip, { key: 'Enter' });
  expect(props.onSearch).toHaveBeenCalledTimes(1);
  expect(props.onConfirm).not.toHaveBeenCalled();
});

it('keeps ZIP search and shipping available when no store can fulfill the order', () => {
  const { props } = setup([]);
  expect(screen.getByText(/No pickup locations within 200 miles/)).toBeTruthy();
  expect(screen.getByRole('textbox', { name: 'ZIP code' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Find pickup stores' }));
  expect(props.onSearch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('radio', { name: 'Ship my order' }));
  expect(props.onShipping).toHaveBeenCalled();
});

it('keeps distance compact, removes helper text, and avoids duplicate store names', () => {
  setup([{ ...choice, displayName: 'DOWNTOWN' }]);
  expect(screen.getByText('1.2 miles')).toBeTruthy();
  expect(screen.getByText('Downtown')).toBeTruthy();
  expect(screen.queryByText('DOWNTOWN')).toBeNull();
  expect(screen.queryByText(/straight-line distance/)).toBeNull();
  expect(screen.queryByText(/Find up to 5 pickup stores/)).toBeNull();
});
