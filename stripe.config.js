
import Stripe from "stripe";
import "dotenv/config"

const stripe = Stripe(process.env.STRIPE_PROD_SECRET_KEY);

export default stripe
