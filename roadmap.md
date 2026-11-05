# Annual billing
- [x] Offer annual PIX in the blocking payment dialog at the existing 20% discount.
- [x] Prevent monthly charges and billing blocks during a confirmed paid annual period.
- [x] Verify billing tests, real annual PIX, and the authenticated admin payment screen; actual payment confirmation awaits payment and was not simulated in live data.
- [x] Add a small discreet option to pay only the R$ 200,00 monthly charge, next to the annual offer in both the payment dialog and the billing screen.

# Checkout video failure
- [x] Reproduce checkout failure with the cart and staff session shown in the video, without retaining test changes.
- [x] Start storefront orders as drafts for all sessions and send only remaining active pieces in the WhatsApp summary.
- [x] Verify draft finalization and stock accounting with rolled-back live-data tests; verify the checkout button reaches WhatsApp with intercepted writes. Production deployment was not verified.