// status (read-only) or subscribe eBay sale notifications for active native accounts,
// using the app's own EbayPlatformNotificationsService wired by hand.
require('reflect-metadata');
const mode = process.argv[2] || 'status';
const only = process.argv[3] ? process.argv[3].split(',') : null;
(async () => {
  const ds = require('/app/dist/src/data-source.js').default;
  await ds.initialize();
  const { ConfigService } = require('@nestjs/config');
  const config = new ConfigService();
  const { TokenEncryptionService } = require('/app/dist/src/channels/token-encryption.service.js');
  const { EbayAuthService } = require('/app/dist/src/channels/ebay/ebay-auth.service.js');
  const { Store } = require('/app/dist/src/channels/entities/store.entity.js');
  const { ChannelConnection } = require('/app/dist/src/channels/entities/channel-connection.entity.js');
  const { ConnectedEbayAccount } = require('/app/dist/src/integrations/ebay/entities/connected-ebay-account.entity.js');
  const { EbayPlatformNotificationsService } = require('/app/dist/src/integrations/ebay/services/ebay-platform-notifications.service.js');
  const noSp = { ensureFreshAccessToken: async () => { throw new Error('sellerpundit not wired'); } };
  const auth = new EbayAuthService(config, new TokenEncryptionService(config), noSp,
    ds.getRepository(ChannelConnection), ds.getRepository(Store), ds.getRepository(ConnectedEbayAccount));
  const deny = new Proxy({}, { get: () => () => { throw new Error('queue not available here'); } });
  const svc = new EbayPlatformNotificationsService(config, auth, ds.getRepository(ConnectedEbayAccount), ds.getRepository(Store), deny);
  const accounts = await ds.getRepository(ConnectedEbayAccount).find({ where: { connectionStatus: 'active' } });
  for (const a of accounts) {
    if (only && !only.includes(a.id.slice(0, 8))) continue;
    const label = `${a.id.slice(0, 8)} ${a.ebayUsername || a.ebayUserId}`;
    try {
      const st = mode === 'subscribe'
        ? await svc.subscribe(a.id, a.organizationId, { replaceApplicationUrl: false, actorUserId: null })
        : await svc.getStatus(a.id, a.organizationId);
      console.log(label, JSON.stringify({ user: st.ebayUsername, app: st.applicationUrl, appOn: st.applicationEnabled, events: st.events, subscribed: st.subscribed }));
    } catch (e) { console.log(label, 'ERROR', String(e.message).slice(0, 300)); }
  }
  await ds.destroy();
})().catch((e) => { console.error('FAILED', e.stack); process.exit(1); });
