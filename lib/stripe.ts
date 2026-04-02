import Stripe from "stripe";

// Check if Stripe API key matches standard test or live format
const apiKey = process.env.STRIPE_SECRET_KEY || "";
export const stripe = new Stripe(apiKey, {
  apiVersion: "2026-03-25.dahlia", // Use the latest compatible API version
});
