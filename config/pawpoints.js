// src/config/points.js

module.exports = {
    // Redemption: 1 point = 10p (£0.10)
    POINT_VALUE_PENCE: 10,
  
    // Minimum points required to redeem
    MIN_REDEMPTION_POINTS: 1,
  
    // Referral reward for the referrer (awarded at capture)
    REFERRAL_POINTS_REWARD: 200,
  
    // Discount given to new user who redeems a referral code
    REFERRAL_DISCOUNT_AMOUNT: 20.00,
  
    // Referral codes expire after this many days if unredeemed
    REFERRAL_CODE_EXPIRY_DAYS: 30,
  
    // Points per service — matches services.paw_points in DB
    // These are stored on the service record, this is for reference only
    SERVICE_POINTS: {
      'carpet-cleaning':  75,  // per room
      'deep-cleaning':    75,  // per room
      'full-home-bundle': 500, // per booking
      'gardening':        250, // per visit
      'clearance':        50,  // per booking
    },
  
    // Helper: convert points to pound value
    pointsToGBP: (points) => (points * 10) / 100,
  
    // Helper: convert pound amount to points cost
    gbpToPoints: (amount) => Math.ceil((amount * 100) / 10),
  };