const button = document.getElementById('checkout');
const status = document.getElementById('status');
// Same attempt survives retries/reloads in this tab. A fresh successful checkout
// can be started by reopening the launcher in a new tab.
let attempt;
try {
  attempt = sessionStorage.getItem('ali-test-checkout-attempt') || crypto.randomUUID();
  sessionStorage.setItem('ali-test-checkout-attempt', attempt);
} catch { attempt = crypto.randomUUID(); }
button.addEventListener('click', async () => {
  button.disabled = true;
  status.textContent = 'Opening Stripe test checkout…';
  try {
    const response = await fetch('/api/checkout', { method: 'POST', credentials: 'omit',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attempt_id: attempt }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    const url = new URL(result.url);
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Invalid checkout URL');
    window.location.assign(url.href);
  } catch (error) {
    status.textContent = error.message || 'Checkout is unavailable. Try again shortly.';
    button.disabled = false;
  }
});
