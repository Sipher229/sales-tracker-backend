import express from 'express'
import db from '../dbconnection.js'
import createError from 'http-errors'
import 'dotenv/config'
import stripe from "../stripe.config.js"
import bcrypt from 'bcrypt'
import { getCurrentDate, getCurrentDateTme, getDifferenceInMinutes, getFormatedDate } from '../dateFns.js'
import sendEmail, {sendEmailAdjustable} from '../sendEmail.js'
import { generateOtp } from '../utils/otpHelpterFunctions.js'
import { readFile } from '../utils/readFile.js'

const registrationRouter = express.Router()

const updateLoginTime =  async (loginDate, loginTimeAndDate, employeeId) => {
    const qry = 
    'INSERT INTO daily_logs(login_time, login_date, employee_id, shift_duration)\
    VALUES($1, $2, $3, 8)'
   

    try {
        const response = await db.query(qry, [loginTimeAndDate, loginDate , employeeId])
        return true
    } catch (error) {
        console.log(error.message)
        return false
    }
}
const verifyLoggedInToday = async (email, loginDate) => {
    const qry = 
    'SELECT * FROM employees INNER JOIN daily_logs\
    ON employees.id = daily_logs.employee_id WHERE email = $1 and login_date = $2'
    try {
        const response = await db.query(qry, [email, loginDate])
        if(response.rows.length === 0){
            return false
        }
        else{
            return true
        }

    } catch (error) {
        console.log(error.message)
        return false
    }
}
const verifyEmailExists = async (email) => {
    try {
        const result = await db.query(
            'SELECT * FROM employees where email = $1',
            [email.toLowerCase()]
        )
        return result.rows.length !== 0
    } catch (error) {
        console.log(error.message)
        return false
    }
    
}

const sendVerificationEmail = async (email) => {
    const emailExists = await verifyEmailExists(email);
    if ( !emailExists ) throw new Error("Email does not exist");

    const otp = generateOtp();
    const createdAt = getCurrentDateTme();
    let htmlEmail = await readFile("./html-messages/verificationCodeEmail.txt");
    htmlEmail = htmlEmail.replace("[otp]", otp);

    const qry = 
    'INSERT INTO otps(id, otp_value, created_at) VALUES(default, $1, $2) RETURNING id';

    try{
        db.query(qry, [otp, createdAt]).then( (result) => {
            sendEmail(htmlEmail, email).catch((error) => {
                console.log(error.message);
                throw new Error("Failed to send verification email");
            });
            return;
        }).catch((error) => {
            console.log(error.message);
            throw new Error("Failed to save OTP");
        });
        return true;
    }
    catch(error){
        console.log(error.message);
        return false
    }

}

const handleSubscriptionCreated = async (recipient, firstName, companyName) => {
    const subject = "SalesVerse - Registered Successfully"
    let htmlMessage = await readFile('./html-messages/registrationConfirmation.txt')
    htmlMessage = htmlMessage.replace("[name]", firstName)
    htmlMessage = htmlMessage.replace("[company name]", companyName)
    const sender = "customer.support@salesverse.org";

    const emailSent = await sendEmailAdjustable(sender, htmlMessage, recipient, subject);

    if (emailSent) {
        return true
    }
    else{
        return false
    }

}
const handlePaymentSucceeded = async (recipient, firstName) => {
    const subject = "SalesVerse - Payment Received"
    const htmlMessage = `
    <p>
        Dear ${firstName}, <br /> <br />
        Thank you for your payment. <br /> 
        Kind Regards, <br /> 
        SalesVerse Customer Service Team <br />
        <img src=cid:logo style='min-width: 300px; height: 70px; object-fit: cover;' />
    </p>`
    const sender = "customer.support@salesverse.org";

    const emailSent = await sendEmailAdjustable(sender, htmlMessage, recipient, subject);

    if (emailSent) {
        return true
    }
    else{
        return false
    }
}
const handleTrialEnd = async (recipient, firstName) => {
    const subject = "SalesVerse - Trial End"
    const htmlMessage = `
    <p>
        Dear ${firstName}, <br /> <br />
        Please be advised that your trial period will be ending in three days from now. <br /> 
        Kind Regards, <br /> <br />
        SalesVerse Customer Service Team <br />
        <img src=cid:logo style='min-width: 300px; height: 70px; object-fit: cover;' />
    </p>`
    const sender = "customer.support@salesverse.org";

    const emailSent = await sendEmailAdjustable(sender, htmlMessage, recipient, subject);

    if (emailSent) {
        return true
    }
    else{
        return false
    }
}
const handlePaymentFailed = async (recipient, firstName) => {
    const subject = "SalesVerse - Payment Failed"
    const htmlMessage = `
    <p>
        Dear ${firstName}, <br /> <br />
        We would like to inform you that we attempted to make payment using the provided information, <br />
        but the payment failed. To update your card information please head over to the company profile page, <br />
        click update and follow the instructions. Please don't hesitate to reach out with any questions by replying <br />
        to this email. <br /> <br /> 
        Kind Regards, <br /> <br />
        SalesVerse Customer Service Team <br />
        <img src=cid:logo style='min-width: 300px; height: 70px; object-fit: cover;' />
    </p>`
    const sender = "customer.support@salesverse.org";

    const emailSent = await sendEmailAdjustable(sender, htmlMessage, recipient, subject);

    if (emailSent) {
        return true
    }
    else{
        return false
    }
}
const handleSubscriptionDeleted = async (recipient, firstName) => {
    const subject = "SalesVerse - Subscription Cancelled"
    const htmlMessage = `
    <p>
        Dear ${firstName}, <br /> <br />
        We are sorry to see you go. Please reply to this email and let us know what we can do <br />
        to improve our services <br /> <br /> 
        Kind Regards, <br /> <br />
        SalesVerse Customer Service Team <br />
        <img src=cid:logo style='min-width: 300px; height: 70px; object-fit: cover;' />
    </p>`
    const sender = "customer.support@salesverse.org";

    const emailSent = await sendEmailAdjustable(sender, htmlMessage, recipient, subject);

    if (emailSent) {
        return true
    }
    else{
        return false
    }
}

registrationRouter.get("/config", (req, res) => {

    res.status(200).json({
        publishableKey: process.env.STRIPE_PROD_PUBLISHABLE_KEY
    })
})


registrationRouter.post("/create-setup-intent", async (req, res, next) => {
    const {companyId, companyName, email} = req.body
    // let isError = false

    let customerId;

    try {

        const existingCustomer = await stripe.customers.search({
            query: `metadata['companyId']:'${companyId}'`,
        });

        if(existingCustomer.data.length > 0) {
            customerId = existingCustomer.data[0].id
        }
        else{
            const customer = await stripe.customers.create({
                name: companyName,
                metadata: { companyId, email },
            });
            customerId = customer.id
        }

        const setupIntent = await stripe.setupIntents.create({
            customer: customerId,
            payment_method_types: ['card'],
        });

        return res.status(200).json({
            clientSecret: setupIntent.client_secret,

        });
    }
    catch (err) {
        console.error(err.message)
        return next(createError.InternalServerError(err.message))
    }

});

registrationRouter.post("/save-subscription", async (req, res, next) => {
    const {paymentMethodId, companyId, companyName, email} = req.body;

    if (!paymentMethodId || !companyId || !companyName || !email) return next(createError.NotFound("Missing parameters"));
    const pricePerEmployee = 1000;
    const basePrice = 0;
    const totalAmount = (0 * pricePerEmployee) + (100 * basePrice);
    const addSubscriptionQry = 'INSERT INTO subscriptions (company_id, stripe_subscription_id, status, trial_ends_at, next_billing_date, stripe_product_id) VALUES ($1, $2, $3, $4, $5, $6)';
    const updateSuscriptionQry = 'UPDATE subscriptions SET company_id = $1, stripe_subscription_id=$2, status=$3, trial_ends_at=$4, next_billing_date=$5 WHERE company_id =$6';

    try {
        
        const customerId = (await db.query("SELECT stripe_customer_id FROM companies WHERE id = $1",
            [companyId]
        )).rows[0].stripe_customer_id;

        const product = await stripe.products.create({
            name: `${companyName} Subscription`,
            metadata: {companyId}
        });

        const price = await stripe.prices.create({
            unit_amount: totalAmount,
            currency: 'cad',
            recurring: {interval: 'month'},
            product: product.id
        });


        
        const existingSubscription = await db.query('SELECT * FROM subscriptions WHERE company_id = $1', [companyId])
        const subscriptionExists = existingSubscription.rows.length > 0;
        let subscription;

        // Fetch the latest invoice to get the Payment Intent client secret

        if (!subscriptionExists) {
            subscription = await stripe.subscriptions.create({
                customer: customerId,
                items: [{price: price.id}],
                trial_period_days: 7,
                metadata: { companyId },
            })

            await db.query(
                addSubscriptionQry,
                [
                    companyId,
                    subscription.id,
                    subscription.status,
                    new Date(subscription.trial_end * 1000),
                    new Date(subscription.current_period_end * 1000),
                    product.id
                ]
            );
        }
        else {
            subscription  = await stripe.subscriptions.update(
                existingSubscription.rows[0].stripe_subscription_id, 
                {
                    metadata: { companyId, email },
                }
            )
            await db.query(
                updateSuscriptionQry,
                [
                    companyId,
                    subscription.id,
                    subscription.status,
                    new Date(subscription.trial_end * 1000),
                    new Date(subscription.current_period_end * 1000),
                    companyId
                ]
            );
        }

        return res.status(200).json({
            subscriptionId: subscription.id,
            message: "Save subscription successfully"
        });

    } catch (error) {
        console.error(error.message);
        return next(createError.InternalServerError("Failed to add subscription"))
    }



})

registrationRouter.post("/save-subscription-no-card", async (req, res, next) => {
    const {companyId, companyName, email, planName} = req.body;
    if (!companyId || !companyName || !email || !planName) return next(createError.BadRequest("Missing parameters"));
    const emailExists = await verifyEmailExists(email);
    if (!emailExists) return next(createError.NotFound("Email does not exist"));
    const pricePerEmployee = 1000;
    const basePrice = 0;
    const trialPeriod = 10;
    const totalAmount = (0 * pricePerEmployee) + (100 * basePrice);
    const addSubscriptionQry = 'INSERT INTO subscriptions (company_id, stripe_subscription_id, status, trial_ends_at, next_billing_date, stripe_product_id) VALUES ($1, $2, $3, $4, $5, $6)';
    const updateSuscriptionQry = 'UPDATE subscriptions SET company_id = $1, stripe_subscription_id=$2, status=$3, trial_ends_at=$4, next_billing_date=$5 WHERE company_id =$6';
    try {
        
        const customerId = (await db.query("SELECT stripe_customer_id FROM companies WHERE id = $1",
            [companyId]
        )).rows[0].stripe_customer_id;

        const product = await stripe.products.create({
            name: `${companyName}-${planName} Subscription`,
            metadata: {companyId, planName}
        });

        const price = await stripe.prices.create({
            unit_amount: totalAmount,
            currency: 'cad',
            recurring: {interval: 'month'},
            product: product.id
        });
        const existingSubscription = await db.query('SELECT * FROM subscriptions WHERE company_id = $1', [companyId])
        const subscriptionExists = existingSubscription.rows.length > 0;
        let subscription;

        if (!subscriptionExists) {
            subscription = await stripe.subscriptions.create({
                customer: customerId,
                items: [{price: price.id}],
                trial_period_days: trialPeriod,
                payment_behavior: 'default_incomplete',
                expand: ['latest_invoice.payment_intent'],
                metadata: { companyId, email },
            })
            await db.query(
                addSubscriptionQry,
                [
                    companyId,
                    subscription.id,
                    subscription.status,
                    new Date(subscription.trial_end * 1000),
                    new Date(subscription.current_period_end * 1000),
                    product.id
                ]
            )
        }
        else {
            subscription  = await stripe.subscriptions.update(
                existingSubscription.rows[0].stripe_subscription_id, 
                {
                    metadata: { companyId, email },
                    payment_behavior: 'default_incomplete',
                    expand: ['latest_invoice.payment_intent'],
                }
            )
            await db.query(
                updateSuscriptionQry,
                [
                    companyId,
                    subscription.id,
                    subscription.status,
                    new Date(subscription.trial_end * 1000),
                    new Date(subscription.current_period_end * 1000),
                    companyId
                ]
            );
        }
        
        return res.status(200).json({
            subscriptionId: subscription.id,
            message: "Saved subscription successfully"
        });
    } catch (error) {
        console.error(error.message);
        return next(createError.InternalServerError("Failed to add subscription"))
    }

})

registrationRouter.post("/register-company", async (req, res, next) => {
    const {companyName, firstName, lastName, employeeCount, email, password} = req.body

    if (!companyName || !firstName || !lastName || !employeeCount || !email || !password) {
        return next(createError.BadRequest("missing required fields"))
    }

    const employeeType = "super employee"
    const employeeRole = "manager"
    const saltRounds = 10
    let companyId;
    let isError = false;
    let customerId;

    const registerEmployeeQry = 'INSERT INTO employees (id, first_name, last_name, email,\
    password, employee_role, employee_type, company_id) VALUES (DEFAULT, $1, $2, $3, $4, $5, $6, $7)'

    const registerCompanyQry = 'INSERT INTO companies (id, company_name, created_at,\
    stripe_customer_id, employee_count) VALUES(DEFAULT, $1, DEFAULT, $2, $3) RETURNING id'

    try {
    
        const companyExists = (await db.query("SELECT * FROM companies where company_name = $1", [companyName])).rows.length > 0;
    
        const employeeExists = (await db.query("SELECT * FROM employees where email = $1", [email.toLowerCase()])).rows.length > 0;

        // Todo: if both the company and the employee exist, check if the employee belongs to the company
        // if not, return an error message
        // if yes, return the company id and a message saying the employee already exists

        if (companyExists || employeeExists) {
            return next(createError.Conflict("company or employee already exists"));
        }
        const customer = await stripe.customers.create({
            name: companyName,
            email,
        });
        customerId = customer.id

        const response = await db.query(registerCompanyQry, [companyName, customerId, employeeCount]);
        companyId = response.rows[0].id;
     
        bcrypt.hash(password, saltRounds, (err, hash) => {
            if (err) return next(createError.InternalServerError("hashing error"));

            db.query(registerEmployeeQry, [firstName, lastName, email.toLowerCase(), hash, employeeRole, employeeType, companyId])
            .then( (result) => {
                return sendVerificationEmail(email);
            }).then ((emailSent) => {
                if (!emailSent) {
                    return next(createError.InternalServerError("Failed to send verification email"));
                }
                return res.status(200).json({
                    message: "registered successfully",
                    companyExists,
                    employeeExists,
                    companyId
                });
            }).catch( (error) => {
                console.error(error.message);
                isError = true;
                return next(createError.InternalServerError("Failed to register employee"));
            });

        });
    
    } catch (error) {
        console.error(error.message)
        return next(createError.InternalServerError(error.message))
    }

})

registrationRouter.post('/confirm-email', async (req, res, next) => {
    const {email} = req.body    
    const emailExists = await verifyEmailExists(email)
    if ( !emailExists ) return next(createError.Unauthorized())

    const otp = generateOtp()
    const createdAt = getCurrentDateTme()
    let htmlEmail = await readFile("./html-messages/verificationCodeEmail.txt")
    htmlEmail = htmlEmail.replace("[otp]", otp)

    const qry = 
    'INSERT INTO otps(id, otp_value, created_at) VALUES(default, $1, $2) RETURNING id'

    db.query(qry, [otp, createdAt], async (err, result) => {
        if( err ) return next(createError.InternalServerError())
        
        // send otp via email
        const emailSent = await sendEmail(htmlEmail, email)

        if (!emailSent) return next(createError.InternalServerError())

        return res.status(200).json({
            message: 'OTP sent successfully',
            otpId: result.rows[0].id
        })
    })
})

registrationRouter.post('/verify-otp', (req, res, next) => {
    const {otp} = req.body
    const validFor = 10
    const qry = 
    'SELECT * FROM otps WHERE otp_value = $1'

    if (!otp) return next(createError.BadRequest('missing required fields'));

    db.query(qry, [otp], async (err, result) => {
        if( err ) return next( createError.BadRequest() )
        if (result.rows.length !== 0){

            const validOtp = result.rows[0].otp_value
            let createdAt = getFormatedDate(result.rows[0].created_at);
            const currentTime = getCurrentDateTme()
            // console.log(createdAt, currentTime);
            const timeDifference = getDifferenceInMinutes(currentTime, createdAt)
            
            
            if (parseInt(validOtp) !== parseInt(otp)) {
                try{
                    await db.query('DELETE FROM otps WHERE otp_value = $1', [otp])
    
                    return next(createError.Conflict('Incorrect passcode'))
                }catch(error){
                    console.log(error.message)
                    return next(createError.InternalServerError())
                }
            }
            if (timeDifference > validFor) {
                console.log(otp, validOtp, "expired")
                try{
                    await db.query('DELETE FROM otps WHERE otp_value = $1', [otp])
    
                    return next ( createError.Conflict('Passcode expired') )
                }catch(error){
                    console.log(error.message)
                    return next(createError.InternalServerError())
                }
            }
            await db.query('DELETE FROM otps WHERE otp_value = $1', [otp])

            return res.status(200).json({
                message: 'Correct passcode',
                otpId: result.rows[0].id
            })
        }
        else{
            return next(createError.Forbidden("Otp is invalid or expired"));
        }

    })
})

registrationRouter.post('/resend-otp', async (req, res, next) => {
    const {email} = req.body
    const emailExists = await verifyEmailExists(email)
    if ( !emailExists ) return next(createError.Unauthorized())

    const otp = generateOtp()
    const createdAt = getCurrentDateTme()
    let htmlEmail = await readFile("./html-messages/verificationCodeEmail.txt")
    htmlEmail = htmlEmail.replace("[otp]", otp)

    const qry = 
    'INSERT INTO otps(id, otp_value, created_at) VALUES(default, $1, $2) RETURNING id'

    db.query(qry, [otp, createdAt], async (err, result) => {
        if( err ) return next(createError.InternalServerError())
        
        // send otp via email
        const emailSent = await sendEmail(htmlEmail, email)

        if (!emailSent) return next(createError.InternalServerError())

        return res.status(200).json({
            message: 'OTP sent successfully',
            otpId: result.rows[0].id
        })
    })
})

registrationRouter.post("/login-after-registration", async (req, res, next) => {
    const {email, tz} = req.body

    const getUser = "SELECT id, first_name, last_name, email, employee_type, employee_role, company_id FROM employees WHERE email = $1"
    try{

        const result = (await db.query(getUser, [email]))

        if (result.rows.length < 1) {
            return next(createError.NotFound("user not found"))
        }
        if (!result.rows[0].employee_type || !result.rows[0].company_id) return next(createError.InternalServerError("missing employee type and/or company id"))

        if (result.rows[0].employee_type !== "super employee") return next(createError.Forbidden())

        const existingSubcription = await db.query("SELECT * FROM subscriptions WHERE company_id = $1", [result.rows[0].company_id])

        if (existingSubcription.rows.length < 1) return next(createError.Forbidden("no subscription found"))
        
        const subscriptionIsActive = existingSubcription.rows[0].status == "trialing" || existingSubcription.rows[0].status == "active"

        if (!subscriptionIsActive) return next(createError.Forbidden("Not subscribed"))
        req.logIn(result.rows[0], async (err) => {
            if(err) return next(createError.InternalServerError(err.message))

            req.user.timeZone = tz
            req.session.userTimezone = tz
            const loginDate = getCurrentDate(tz)
    
            const timeAndDate = getCurrentDateTme(tz)
            
            const loggedInToday = await verifyLoggedInToday(email, loginDate)

            if ( !loggedInToday ){
                await updateLoginTime(loginDate, timeAndDate, req.user.id)
            
            }
            return res.status(200).json({message: "session created successfully", isLoggedIn: req.isAuthenticated(),})
        })
    }
    catch(err) {
        return next(createError.NotFound(err.message))
    }
})

registrationRouter.post("/webhook", express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_PROD_SIGNING_SECRET;
    const getUserQry = "SELECT first_name, email, company_name from companies INNER JOIN employees \
    ON companies.id = employees.company_id WHERE stripe_customer_id = $1 and employee_type = 'super employee'"

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        const customer = event.data.object.customer;
        const user = await db.query(getUserQry, [customer]);
        let first_name, email, companyName;

        if (user.rows.length > 0){
            first_name = user.rows[0].first_name;
            email = user.rows[0].email;
            companyName = user.rows[0].company_name;
        }
        else{
            return res.status(400).send('Webhook Error');
        }

        switch (event.type) {
            case 'customer.subscription.created':
                await handleSubscriptionCreated(email, first_name, companyName);
                break;
            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(email, first_name);
                break;
            case 'invoice.payment_failed':
                await handlePaymentFailed(email, first_name);
                break;
            case 'customer.subscription.updated':
                console.log(event.type, "envent handled");
                break;
            case 'customer.subscription.trial_will_end':
                await handleTrialEnd(email, first_name);
                break;
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(email, first_name);
                break;
            case 'payment_method.attached':
                break;
            case 'setup_intent.succeeded':
                break;
            default:
                console.log(`Unhandled event type ${event.type}`);
        }
        res.json({received: true});
    } catch (err) {
        console.error('Webhook signature verification failed.', err.message);
        return res.status(400).send('Webhook Error');
    }


})





export default registrationRouter