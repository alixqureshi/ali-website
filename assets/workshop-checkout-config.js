/* Booking stays closed until Stripe, the workshop date and delivery are ready.
 * Public configuration only. Never put API keys or webhook secrets here. */
window.aiWithAliCheckout = Object.freeze({
  statusEndpoint: "",
  mode: "test"
});
