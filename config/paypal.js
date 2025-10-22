const checkoutNodeJssdk = require("@paypal/checkout-server-sdk");

function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  // Use SandboxEnvironment for testing
  return new checkoutNodeJssdk.core.SandboxEnvironment(clientId, clientSecret);

  // For production, use:
  // return new checkoutNodeJssdk.core.LiveEnvironment(clientId, clientSecret);
}

function client() {
  return new checkoutNodeJssdk.core.PayPalHttpClient(environment());
}

// Store/Merchant Information
const storeInfo = {
  storeId: process.env.PAYPAL_STORE_ID || "BOOKSTORE_001",
  storeName: process.env.STORE_NAME || "BookStore",
  storeEmail: process.env.STORE_EMAIL || process.env.EMAIL_USER,
  currency: process.env.STORE_CURRENCY || "USD",
};

module.exports = { client, storeInfo };
