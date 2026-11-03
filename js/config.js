/* Settings you can change without touching the app code. */
window.KAKVO_CONFIG = {
  VERSION: '0.1.9',
  CONTACT: 'github.com/DiomedEast/kakvo',
  PRICE_LABEL: '19,99 € на година',
  /* Paste the Stripe Payment Link here when BonbelleGroup's Stripe account is ready.
     Empty = the support button says "payments start soon". */
  SUPPORT_URL: '',
  /* Photo checks: lower BLUR_THRESHOLD accepts blurrier photos; words under UNSURE_CONFIDENCE get the orange underline. */
  BLUR_THRESHOLD: 60,
  UNSURE_CONFIDENCE: 70,
  TESSERACT_URL: 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js'
};
