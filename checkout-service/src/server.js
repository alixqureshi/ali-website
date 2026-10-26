import Stripe from 'stripe';
import { readConfig } from './config.js';
import { openStore } from './store.js';
import { createApp } from './app.js';

const config = readConfig();
const stripe = new Stripe(config.secretKey, { maxNetworkRetries: 2, timeout: 10000 });
// Refuse to run against the wrong merchant, even if a valid key is supplied.
const account = await stripe.accounts.retrieve();
if (account.id !== config.accountId) throw new Error('Stripe merchant account does not match configuration');
const store = openStore(config.databasePath);
const server = createApp({ stripe, config, store }).listen(config.port, '0.0.0.0', () => {
  console.log(`Checkout confirmation service ready (${config.mode})`);
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  server.close(() => { store.close(); process.exit(0); });
});
