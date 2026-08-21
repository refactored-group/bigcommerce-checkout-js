import StatesDropdown from './StatesDropdown';

describe('StatesDropdown', () => {
  it('is controlled by the confirmed ammo state', () => {
    const validateSelectedState = jest.fn();
    const dropdown = new StatesDropdown({ selectedState: 'TX', validateSelectedState }).render();
    const select = dropdown.props.children.props.children[2];

    expect(select.props.value).toBe('TX');
    expect(select.props.onChange).toBe(validateSelectedState);
  });
});
