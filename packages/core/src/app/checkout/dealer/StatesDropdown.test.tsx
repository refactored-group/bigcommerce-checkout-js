import StatesDropdown from './StatesDropdown';

describe('StatesDropdown', () => {
  const subdivisions = [
    { code: 'DC', name: 'District of Columbia' },
    { code: 'PR', name: 'Puerto Rico' },
    { code: 'TX', name: 'Texas' },
  ];

  it('is controlled by the confirmed ammo state', () => {
    const validateSelectedState = jest.fn();
    const dropdown = new StatesDropdown({
      selectedState: 'TX',
      subdivisions,
      validateSelectedState,
    }).render();
    const select = dropdown.props.children.props.children[2];

    expect(select.props.value).toBe('TX');
    expect(select.props.onChange).toBe(validateSelectedState);
  });

  it('renders native subdivision codes, names, and order', () => {
    const dropdown = new StatesDropdown({
      selectedState: '',
      subdivisions,
      validateSelectedState: jest.fn(),
    }).render();
    const select = dropdown.props.children.props.children[2];
    const options = select.props.children[1];

    expect(options.map((option: any) => option.props.value)).toEqual(['DC', 'PR', 'TX']);
    expect(options.map((option: any) => option.props.children)).toEqual([
      'District of Columbia',
      'Puerto Rico',
      'Texas',
    ]);
    expect(select.props.disabled).toBe(false);
  });

  it('keeps the native selector empty and disabled until subdivisions arrive', () => {
    const dropdown = new StatesDropdown({
      selectedState: '',
      subdivisions: [],
      validateSelectedState: jest.fn(),
    }).render();
    const select = dropdown.props.children.props.children[2];

    expect(select.props.children[1]).toEqual([]);
    expect(select.props.disabled).toBe(true);
  });
});
