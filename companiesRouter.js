import express from 'express'
import db from './dbconnection.js'
import createError from 'http-errors'
import 'dotenv/config'
import stripe from "./stripe.config.js"

const companiesRouter = express.Router();

companiesRouter.get("/get-company", (req, res, next) => {
    if (!req.isAuthenticated) return next(createError.Unauthorized());
    if (req.user && req.user.employee_type !== "super employee") return next(createError.Forbidden());

    const getCompanyQry = "SELECT * FROM companies INNER JOIN subscriptions \
    ON companies.id = subscriptions.company_id WHERE subscriptions.company_id = $1";

    db.query(getCompanyQry, [req.user.company_id], (err, result) => {
        if (err) return next(createError.BadRequest(err.message));

        return res.status(200).json({
            message: "data retrieved successfully",
            requestedData: result.rows,
        });
    });
});

companiesRouter.get("/employee-count", async (req, res, next) => {
    if (!req.isAuthenticated) return next(createError.Unauthorized());
    if (req.user && req.user.employee_type !== "super employee") return next(createError.Forbidden());

    try {
        const employeeCount = await db.query('SELECT COUNT(*) FROM employees WHERE company_id =$1', [req.user.company_id]);

        return res.status(200).json({
            message: "data retrieved successfully",
            employeeCount: employeeCount.rows[0].count
        });
    } catch (error) {
        console.error(error.message);
        return next(createError.InternalServerError(error.message));

    }

});

companiesRouter.post("/create-setup-intent", async (req, res, next) => {
    if(!req.isAuthenticated()) return next(createError.Unauthorized());
    
    if (req.user && req.user.employee_type !== "super employee") return next(createError.Forbidden());

    try {
        const customerId = (await db.query("SELECT stripe_customer_id FROM companies WHERE id = $1",
            [req.user.company_id]
        )).rows[0].stripe_customer_id;
    
        const setupIntent = await stripe.setupIntents.create({
            customer: customerId,
            payment_method_types: ['card']
        });

        return res.status(200).json({
            clientSecret: setupIntent.client_secret,
        });
    } catch (error) {
        console.error(error.message);
        return next(createError.InternalServerError("failed to create client secret"));
    }
  
});

companiesRouter.post("/save-subscription", async (req, res, next) => {
    const {paymentMethodId} = req.body;
    const updateSubscriptionQry = "UPDATE subscriptions SET status = $1, next_billing_date = $2 WHERE company_id = $3"

    try {

        const stripeSubscription = await db.query("SELECT * FROM subscriptions WHERE company_id = $1",
            [req.user.company_id]
        )
        const stripeSubscriptionId = stripeSubscription.rows[0].stripe_subscription_id;
        const stripeProductId = stripeSubscription.rows[0].stripe_product_id

        const existingSubscriptionStatus = stripeSubscription.rows[0].status;

        if (existingSubscriptionStatus !== "canceled"){

            // retrieve subscription existing subscription
            const existingSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    
            // update payment method for existing customer
            await stripe.paymentMethods.attach(paymentMethodId, {
                customer: existingSubscription.customer,
            });
    
            // update default payment method for the existing customer
            await stripe.customers.update(existingSubscription.customer, {
                invoice_settings: {
                    default_payment_method: paymentMethodId,
                }
            });
    
    
            // update the existing subscription
            const updatedSubscription = await stripe.subscriptions.update(stripeSubscriptionId, {
                billing_cycle_anchor: 'now',
            })
    
            // update the existing subscriptions in our DB
            db.query(
                updateSubscriptionQry, 
                [updatedSubscription.status, updatedSubscription.current_period_end, req.user.company_id],
                (err) => {
                    if (err) {
                        console.error(err);
                        return next(createError.BadRequest("failed to update subscription in DB"));
    
                    }
                    return res.status(200).json({
                        message: "subscription saved successfully",
                    });
    
                }
            );
        }
        else{
            
            const updateSubscriptionQry = 
            'UPDATE subscriptions SET company_id = $1, \
            stripe_subscription_id=$2, status=$3, trial_ends_at=$4, next_billing_date=$5 \
            WHERE company_id =$6';
            const employeeCount = (await db.query("SELECT COUNT(*) FROM employees WHERE company_id = $1", [req.user.company_id])).rows[0].count;

            const {stripe_customer_id, } = (await db.query("SELECT * FROM companies WHERE id = $1", [req.user.company_id])).rows[0];

            const baseCharge = 0; // Fixed charge
            const perEmployeeCharge = 10; // Charge per employee

            const totalAmount = (baseCharge + (employeeCount * perEmployeeCharge)) * 100;

            const newPrice = await stripe.prices.create({
                unit_amount: totalAmount, // Total amount in cents
                currency: 'cad',
                recurring: { interval: 'month' }, // Monthly subscription
                product: stripeProductId,
            });
            await stripe.paymentMethods.attach(paymentMethodId, {
                customer: stripe_customer_id,
            });

            await stripe.customers.update(stripe_customer_id, {
                invoice_settings: {
                    default_payment_method: paymentMethodId,
                }
            });

            const newSubscription = await stripe.subscriptions.create({
                customer: stripe_customer_id,
                items: [
                    {
                        price: newPrice.id, // Use the dynamically created price
                    },
                ],
                trial_end: 'now',
                // expand: ['latest_invoice.payment_intent'], // Include payment intent for immediate payment confirmation
            });

            await db.query(
                updateSubscriptionQry,
                [
                    req.user.company_id,
                    newSubscription.id,
                    newSubscription.status,
                    new Date(newSubscription.trial_end * 1000),
                    new Date(newSubscription.current_period_end * 1000),
                    req.user.company_id
                ]
            );

            res.status(200).json({
                message: "customer subscribed successfully",
                status: newSubscription.status,
            });

        }

    } catch (error) {
        console.error(error.message);
        return next(createError.InternalServerError("error saving subscription"));
    }
});

companiesRouter.get("/get-subscription-status/:id", async (req, res, next) => {
    if (!req.isAuthenticated()) return next(createError.Unauthorized());

    if (req.user && req.user.employee_type !== "super employee") return next(createError.Forbidden());

    const {id} = req.params;
    if (!id) return next(createError.NotFound("Missing params"))
    try{
        const subscriptionStatus = await db.query("SELECT status FROM subscriptions WHERE company_id = $1", [id]);
        const subscriptionIsActive = subscriptionStatus.rows[0].status === "trialing" || subscriptionStatus.rows[0].status === "active";

        return res.status(200).json({
            subscriptionIsActive
        })
    }
    catch(error) {
        console.error(error.message);
        return next(createError.InternalServerError("failed to fetch subscription status"));
    }
});

companiesRouter.delete("/cancel-subscription", async (req, res, next) => {
    if (!req.isAuthenticated()) return next(createError.Unauthorized());

    if (req.user && req.user.employee_type !== "super employee") return next(createError.Forbidden());

    try {
        
        const { stripe_subscription_id} = (await db.query("SELECT * FROM subscriptions WHERE company_id = $1", [req.user.company_id])).rows[0];
        
        const canceledSubscription = await stripe.subscriptions.cancel(stripe_subscription_id, {invoice_now: true, prorate: true});

        db.query(
            "UPDATE subscriptions SET status = $1 WHERE company_id = $2", 
            [canceledSubscription.status, req.user.company_id],
            (err) => {
                if (err) {
                    console.error(err.message);
                    return next(createError.BadRequest(err.message));  
                }

                return res.status(200).json({
                    message: "Subscription canceled successfully"
                })
            }
        );
    } catch (error) {
        console.error(error.message);
        return next(createError.InternalServerError("Failed to cancel subscription"));
        
    }

});

export default companiesRouter