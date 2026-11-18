import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { EbayPlatformNotificationsController } from './ebay-platform-notifications.controller';
import { EbayPlatformNotificationsService } from '../services/ebay-platform-notifications.service';
import { EbayIntegrationPermissionsService } from '../services/ebay-integration-permissions.service';

describe('EbayPlatformNotificationsController (HTTP body parsing)', () => {
  let app: NestExpressApplication;
  const handleNotification = jest.fn((xml: string) =>
    Promise.resolve({ status: 'ignored', reason: `len ${xml.length}` }),
  );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EbayPlatformNotificationsController],
      providers: [
        {
          provide: EbayPlatformNotificationsService,
          useValue: { handleNotification },
        },
        { provide: EbayIntegrationPermissionsService, useValue: {} },
      ],
    }).compile();
    // Same parser setup as main.ts.
    app = moduleRef.createNestApplication<NestExpressApplication>({
      rawBody: true,
    });
    app.useBodyParser('text', {
      type: ['text/xml', 'application/xml', 'application/soap+xml'],
      limit: '2mb',
    });
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => handleNotification.mockClear());

  it('hands the exact SOAP bytes to the service', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><X>ü &amp; ok</X></soapenv:Body></soapenv:Envelope>';
    await request(app.getHttpServer() as App)
      .post('/api/integrations/ebay/platform-notifications')
      .set('Content-Type', 'text/xml; charset=utf-8')
      .set(
        'SOAPAction',
        '"http://developer.ebay.com/notification/FixedPriceTransaction"',
      )
      .send(xml)
      .expect(200);
    expect(handleNotification).toHaveBeenCalledWith(xml);
  });

  it('still reads the body when eBay sends application/soap+xml', async () => {
    await request(app.getHttpServer() as App)
      .post('/api/integrations/ebay/platform-notifications')
      .set('Content-Type', 'application/soap+xml')
      .send('<Envelope/>')
      .expect(200);
    expect(handleNotification).toHaveBeenCalledWith('<Envelope/>');
  });
});
