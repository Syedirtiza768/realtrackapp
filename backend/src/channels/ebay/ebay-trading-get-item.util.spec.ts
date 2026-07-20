import {
  parseTradingGetItemResponse,
  parseTradingItemCompatibility,
} from '../../channels/ebay/ebay-trading-get-item.util.js';

describe('ebay-trading-get-item.util', () => {
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Item>
    <PictureDetails>
      <PictureURL>https://i.ebayimg.com/images/g/a1/s-l1600.jpg</PictureURL>
      <PictureURL>https://i.ebayimg.com/images/g/a2/s-l1600.jpg</PictureURL>
    </PictureDetails>
    <ItemCompatibilityList>
      <Compatibility>
        <NameValueList><Name>Year</Name><Value>2015</Value></NameValueList>
        <NameValueList><Name>Make</Name><Value>Jeep</Value></NameValueList>
        <NameValueList><Name>Model</Name><Value>Cherokee</Value></NameValueList>
        <CompatibilityNotes>AWD only</CompatibilityNotes>
      </Compatibility>
      <Compatibility>
        <NameValueList><Name>Year</Name><Value>2016</Value></NameValueList>
        <NameValueList><Name>Make</Name><Value>Jeep</Value></NameValueList>
        <NameValueList><Name>Model</Name><Value>Cherokee</Value></NameValueList>
      </Compatibility>
    </ItemCompatibilityList>
    <Description><![CDATA[<p>Test part</p>]]></Description>
  </Item>
</GetItemResponse>`;

  it('parses all gallery image URLs', () => {
    const parsed = parseTradingGetItemResponse(sampleXml);
    expect(parsed.imageUrls).toEqual([
      'https://i.ebayimg.com/images/g/a1/s-l1600.jpg',
      'https://i.ebayimg.com/images/g/a2/s-l1600.jpg',
    ]);
  });

  it('falls back to GalleryURL when PictureURL is absent', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Item>
    <PictureDetails>
      <GalleryURL>https://i.ebayimg.com/images/g/thumb/s-l140.jpg</GalleryURL>
    </PictureDetails>
  </Item>
</GetItemResponse>`;
    const parsed = parseTradingGetItemResponse(xml);
    expect(parsed.imageUrls).toEqual([
      'https://i.ebayimg.com/images/g/thumb/s-l140.jpg',
    ]);
  });

  it('parses compatibility rows with notes', () => {
    const compat = parseTradingItemCompatibility(sampleXml);
    expect(compat?.compatibleProducts).toHaveLength(2);
    expect(compat?.compatibleProducts[0].compatibilityProperties).toEqual(
      expect.arrayContaining([
        { name: 'Year', value: '2015' },
        { name: 'Make', value: 'Jeep' },
        { name: 'Model', value: 'Cherokee' },
      ]),
    );
    expect(compat?.compatibleProducts[0].notes).toBe('AWD only');
  });

  it('returns empty compatibility when section is missing', () => {
    const compat = parseTradingItemCompatibility('<Item><Title>x</Title></Item>');
    expect(compat).toBeNull();
  });
});
