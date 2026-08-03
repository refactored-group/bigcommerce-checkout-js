import React from 'react';

import ItemFFL from './ItemFFL';

describe('ItemFFL', () => {
    it('uses an Automatic FFL-owned title class instead of a checkout theme class', () => {
        const component = ItemFFL({
            item: { imageUrl: 'https://example.com/firearm.jpg', name: 'Test Firearm' },
            quantity: 2,
        });
        const [, body] = React.Children.toArray(component.props.children) as React.ReactElement[];
        const title = React.Children.only(body.props.children) as React.ReactElement;

        expect(title.type).toBe('h5');
        expect(title.props.className).toBe('automaticFfl-productTitle');
        expect(title.props.children).toBe('2 x Test Firearm');
    });
});
