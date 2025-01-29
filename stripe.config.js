
import Stripe from "stripe";
import "dotenv/config"

const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

export default stripe
