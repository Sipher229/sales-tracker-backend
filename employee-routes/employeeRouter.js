import express from 'express'
import createError from 'http-errors'
import db from '../dbconnection.js'
import bcrypt from 'bcrypt'
import 'dotenv/config'
import { differenceInHours, getCurrentDate, getCurrentDateTme } from '../dateFns.js'
import sendEmail from '../sendEmail.js'
import stripe from '../stripe.config.js'


const employeeRouter = express.Router()
const saltRounds = 10

// ============================== helper functions =====================================

const verifyEmailExists = async (email) => {
    try {
        const result = await db.query(
            'SELECT * FROM employees where email = $1',
            [email]
        )
        return result.rows.length !== 0
    } catch (error) {
        console.log(error.message)
        return false
    }
    
}

const generateOtp = () => {
    const length = 6
    let otp = ''

    for(let i = 0; i <length; i++) {
        const randomNumber = Math.floor(Math.random() * 9)
        otp += randomNumber
    }
    return otp
}

const verifyOtpExists = async (id, tz) => {
    const qry = 
    'SELECT * FROM otps WHERE id = $1'
    const validFor = 30

    try{
        const response = await db.query(qry, [id])

        if (response.rows !== 0){
            const createdAt = response.rows[0].created_at
            const currentTime = getCurrentDateTme(tz)
            const timeDifference = differenceInHours(currentTime, createdAt)

            if (timeDifference > validFor) {
                
                return false
            }
            return true
        }
        else{
            return false
        }
    }
    catch(error){
        return false
    }
}

const updateLogsAfterEdit = async (employeeId, entryDate) => {
    const qry =
    'UPDATE daily_logs SET\
    sales_per_hour = ((SELECT COUNT(*) FROM sales WHERE sales.employee_id = $1 AND entry_date = $2)/ (SELECT daily_logs.shift_duration from daily_logs WHERE employee_id = $3 AND login_date = $4 LIMIT 1 )::float),\
    commission =  (SELECT SUM(sales.commission) FROM sales WHERE sales.employee_id = $5)\
    WHERE login_date = $6 AND employee_id = $7 RETURNING sales_per_hour'

    try {
        const response = await db.query(qry, [employeeId, entryDate, employeeId, entryDate, employeeId,  entryDate, employeeId])
        return response.rows[0].sales_per_hour
    } catch (error) {
        console.log(error.message)
        return -1
    }
    
}

const deleteLogsByEmployee = async (id) => {
    const qry = 'DELETE FROM daily_logs WHERE employee_id = $1'
    try{
        await db.query(qry, [id])
        return true
    }
    catch(err){
        return false
    }
}
const deleteCampaignsByEmployee = async (id) => {
    const qry = 'DELETE FROM campaigns WHERE employee_id = $1'
    try{
        await db.query(qry, [id])
        return true
    }
    catch(err){
        return false
    }
}
const deleteGoalsByEmployee = async (id) => {
    const qry = 'DELETE FROM goals WHERE employee_id = $1'
    try{
        await db.query(qry, [id])
        return true
    }
    catch(err){
        return false
    }
}


const deleteSalesByEmployee = async (id) => {
    const qry = 'DELETE FROM sales WHERE employee_id = $1'

    try{

        await db.query(qry, [id])
        return true
    }
    catch(err) {
        return false
    }
}
// ---------------------------------------------------------------------------------------

// ============================================ routes =======================================
employeeRouter.get("/is-logged-in", (req, res) => {
    return res.status(200).json({
        isLoggedIn: req.isAuthenticated()
    });
});

employeeRouter.post('/addemployee', async (req, res, next) => {

    if(!req.isAuthenticated()){
        return next(createError.Unauthorized())
    }

    if(req.user.employee_role !== 'manager'){
        return next(createError.Forbidden())
    }
    const {
        firstName,
        lastName, 
        employeeNumber,
        employeeType, 
        username, 
        password,
        employeeRole,
        campaignId
    } = req.body
    let empType = employeeType
    if(!employeeType) empType = 'employee';
    const managerId = req.user.id
    const registerQry = 
    'INSERT INTO employees(id, first_name, last_name, employee_number, email,\
    password, employee_role, manager_id, campaign_id, company_id, employee_type)\
    VALUES(DEFAULT, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id'

    const emailExists = await verifyEmailExists(username.toLowerCase())
    if(!emailExists){
        bcrypt.hash(password, saltRounds, (err, hash) => {
            if(err) {
                next(createError.InternalServerError())
            }
            db.query(registerQry, [firstName.trim(), lastName.trim(), employeeNumber, username.toLowerCase(), 
                hash, employeeRole, managerId, campaignId, req.user.company_id, empType],
                async (error, result)=>{
                    if (error) {
                        next(createError.BadRequest(error.message))
                    }
                    else{
                        const employeeCount = (await db.query("SELECT COUNT(*) FROM employees WHERE company_id = $1", [req.user.company_id])).rows[0].count;
                        const stripeSubscription = (await db.query("SELECT * FROM subscriptions WHERE company_id = $1",
                            [req.user.company_id]
                        ));
                        const stripeSubscriptionId = stripeSubscription.rows[0].stripe_subscription_id;
                        const stripeProductId = stripeSubscription.rows[0].stripe_product_id;

                        const baseCharge = 0; // Fixed charge
                        const perEmployeeCharge = 10; // Charge per employee
                        const totalAmount = (baseCharge + (employeeCount * perEmployeeCharge)) * 100;
                        const newPrice = await stripe.prices.create({
                            unit_amount: totalAmount, // Total amount in cents
                            currency: 'cad',
                            recurring: { interval: 'month' }, // Monthly subscription
                            product: stripeProductId,
                        });
                        await stripe.subscriptions.update(stripeSubscriptionId, {
                            items: [
                                {
                                    price: newPrice.id,
                                    quantity: 1, // Keep as 1 since price already includes per-employee calculation
                                },
                            ],
                        });
                        res.status(200).json({
                            message: "successfully registered the employee",
                            usename: result.rows[0].id
                        })
                    }
                }
            )
        })
        
    } else {
        next(createError.Conflict('email already exists'))
    }
    
})

employeeRouter.delete('/delete/:id', async (req, res, next) => {
    if (!req.isAuthenticated()) return next(createError.Unauthorized())

    if (req.user.employee_role !== 'manager') return next(createError.Forbidden())

    const {id} = req.params

    const deleteEmployee = async (id) => {
        const qry = 'DELETE FROM employees WHERE id = $1'
        const cDelete = deleteCampaignsByEmployee(id)
        const gDelete = deleteGoalsByEmployee(id)
        const lDelete = deleteLogsByEmployee(id)
        const sDelete = deleteSalesByEmployee(id)

        if (cDelete && gDelete && lDelete && sDelete) {

            await db.query(qry, [id])
            return true
        }
        else{
            return false
        }
        
    }

    try {
        const response = await deleteEmployee(id)
        if (response) {
            const employeeCount = (await db.query("SELECT COUNT(*) FROM employees WHERE company_id = $1", [req.user.company_id])).rows[0].count;
            const stripeSubscription = (await db.query("SELECT * FROM subscriptions WHERE company_id = $1",
                [req.user.company_id]
            ));
            const stripeSubscriptionId = stripeSubscription.rows[0].stripe_subscription_id;
            const stripeProductId = stripeSubscription.rows[0].stripe_product_id;

            const baseCharge = 0; // Fixed charge
            const perEmployeeCharge = 10; // Charge per employee
            const totalAmount = (baseCharge + (employeeCount * perEmployeeCharge)) * 100;
            const newPrice = await stripe.prices.create({
                unit_amount: totalAmount, // Total amount in cents
                currency: 'cad',
                recurring: { interval: 'month' }, // Monthly subscription
                product: stripeProductId,
            });
            await stripe.subscriptions.update(stripeSubscriptionId, {
                items: [
                    {
                        price: newPrice.id,
                        quantity: 1, // Keep as 1 since price already includes per-employee calculation
                    },
                ],
            });
            
            return res.status(200).json({
                message:'Employee deleted susccessfully'
            })
        }
        else{
            return next(createError.InternalServerError("failed to delete employee"))
        }
    } catch (error) {
        return next(createError.InternalServerError(error.message))
    }

})

employeeRouter.post('/addemployee/:pin', async (req, res, next) => {
    const receivedPin = req.params.pin
    const pin = process.env.PIN 
    if (receivedPin !== pin) return next(createError.Forbidden())

    const {
        firstName,
        lastName, 
        employeeNumber, 
        username, 
        password,
        employeeRole,
    } = req.body

    const registerQry = 
    'INSERT INTO employees(id, first_name, last_name, employee_number, email, password, employee_role)\
    VALUES(DEFAULT, $1, $2, $3, $4, $5, $6) RETURNING id'

    const emailExists = await verifyEmailExists(username)
    if(!emailExists){
        bcrypt.hash(password, saltRounds, (err, hash) => {
            if(err) {
                next(createError.InternalServerError())
            }
            db.query(registerQry, [firstName, lastName, employeeNumber, username, 
                hash, employeeRole],
                
                (error, result)=>{
                    if (error) {
                        next(createError.BadRequest(error.message))
                    }
                    else{
                        res.status(200).json({
                            message: "successfully registered the employee",
                            employeeId: result.rows[0].id
                        })
                    }
                }
            )
        })
        
    } else {
        next(createError.Conflict('email already exists'))
    }
})

employeeRouter.patch('/editemployee/:id', (req, res, next) => {
    if (!req.isAuthenticated()) return next(createError.Unauthorized())

    if (req.user.employee_role !== 'manager') return next(createError.Forbidden())

    const id = req.params.id
    const managerId = req.user.id
    const {
        firstName,
        lastName,
        username,
        employeeRole,
        employeeNumber,
        campaignId
    } = req.body

    const editQry = 
    'UPDATE employees SET first_name = $1 , last_name=$2, email=$3,\
    employee_role=$4, employee_number=$5, campaign_id =$6, manager_id = $7\
    WHERE id = $8'

    db.query(
        editQry, [firstName, lastName, username, employeeRole, employeeNumber, campaignId, managerId, id],
        async (err) => {
            if (err) {
                return next(createError.BadRequest(err.message))
            }
            const employeeCount = (await db.query("SELECT COUNT(*) FROM employees WHERE company_id = $1", [req.user.company_id])).rows[0].count;
            const stripeSubscription = (await db.query("SELECT * FROM subscriptions WHERE company_id = $1",
                [req.user.company_id]
            ));
            const stripeSubscriptionId = stripeSubscription.rows[0].stripe_subscription_id;
            const stripeProductId = stripeSubscription.rows[0].stripe_product_id;

            const baseCharge = 0; // Fixed charge
            const perEmployeeCharge = 10; // Charge per employee
            const totalAmount = (baseCharge + (employeeCount * perEmployeeCharge)) * 100;
            const newPrice = await stripe.prices.create({
                unit_amount: totalAmount, // Total amount in cents
                currency: 'cad',
                recurring: { interval: 'month' }, // Monthly subscription
                product: stripeProductId,
            });
            await stripe.subscriptions.update(stripeSubscriptionId, {
                items: [
                    {
                        price: newPrice.id,
                        quantity: 1, // Keep as 1 since price already includes per-employee calculation
                    },
                ],
            });

            res.status( 200 ).json({
                message: 'Changes saved successfully',
            })
        }
    )
})

employeeRouter.get('/getemployee', async  (req, res, next) => {

    if(!req.isAuthenticated()){
        return next(createError.Unauthorized())
    }

    else{
        const loginDate = getCurrentDate(req.user.timeZone)
        const empId = req.user.id

        const getEmployeeQry = 
        `SELECT employees.id as id, first_name , last_name, employee_number ,employee_type, email, employee_role, goals.name as goalName,\
        goals.hourly_decisions as hourlyDecisions, goals.hourly_sales as hourlySales, campaigns.id as emp_campaign_id,\
        campaigns.name as campaignName, shift_duration, employees.campaign_id as campaign_id, login_time as login_time, \
        sales_per_hour, daily_logs.commission as closingCommission, employees.company_id as company_id\
        FROM campaigns INNER JOIN goals ON goals.id = campaigns.goal_id RIGHT JOIN employees\
        ON campaigns.id = employees.campaign_id INNER JOIN daily_logs ON employees.id = daily_logs.employee_id\
        WHERE employees.id = $1 AND login_date = $2`
        
        db.query(getEmployeeQry, [empId, loginDate], async (err, result) => {
            if (err) return next(createError.BadRequest(err.message))
            
            const employee = result.rows;

            try {
                
                const subscriptionStatus= (await (db.query("SELECT status FROM subscriptions WHERE company_id = $1", [req.user.company_id]))).rows[0]?.status;

                const subscriptionIsActive = subscriptionStatus === "trialing" || subscriptionStatus === "active"

                return res.status(200).json({
                    requestedData: employee,
                    message: 'retrieved data successfully',
                    subscriptionIsActive,
                })

            } catch (error) {
                console.error(error.message)
                return next(createError.InternalServerError("failed to get subscription status"))
            }
            
        })

    }

})

employeeRouter.get('/getemployee/:id', async (req, res, next) => {
    if (!req.isAuthenticated()) return next(createError.Unauthorized())

    const loginDate = getCurrentDate(req.user.timeZone)
    const empId = req.params.id

    const getEmployeeQry = 
    `SELECT employees.id as id, first_name , last_name, employee_number , email, employee_role, goals.name as goalName,\
    goals.hourly_decisions as hourlyDecisions, goals.hourly_sales as hourlySales, \
    campaigns.name as campaignName, employees.campaign_id as campaign_id, shift_duration, login_time as login_time, sales_per_hour, daily_logs.commission as closingCommission\
    FROM campaigns INNER JOIN goals ON goals.id = campaigns.goal_id RIGHT JOIN employees\
    ON campaigns.id = employees.campaign_id RIGHT JOIN daily_logs ON employees.id = daily_logs.employee_id\
    WHERE employees.id = $1 AND login_date = $2 ORDER BY login_date DESC limit 5`
    
    db.query(getEmployeeQry, [empId, loginDate], (err, result) => {
        if (err) return next(createError.BadRequest(err.message))
        
        const employee = result.rows
    
        return res.status(200).json({
            requestedData: employee,
            message: 'retrieved data successfully'
        })
    })
    
    
})

// employeeRouter.get('/getmanagers', async (req, res, next) => {
//     if ( ! req.isAuthenticated() ) return next( createError.Unauthorized() )

//     const getManagersQry = 'SELECT * FROM employees WHERE employee_role = $1'

//     try{
//         const result = await db.query(getManagersQry, ['manager'])
//         return res.status(200).json({
//             message: "data retrieved successfully",
//             requestedData: result.rows
//         })
//     }
//     catch (error) {
//         return next ( createError.BadRequest(error.message) )
//     }
    
// })

employeeRouter.patch('/assign/managerId', (req, res, next) => {
    if ( !req.isAuthenticated() ) return next( createError.Unauthorized() )

    if ( req.user.role !==  'manager') return next ( createError.Forbidden() )
    
    const {employeeId, managerId} = req.body

    const updateManagerId = 'UPDATE employees SET manager_id = $1 WHERE id=$2'

    db.query(updateManagerId, [managerId, employeeId], (err, result) => {
        if ( err ) return next( createError.BadRequest(err.message) )
        
        return res.status( 200 ).json({
            message: 'updated info successfully'
        })

    })
    
})

employeeRouter.patch('/assign/role', (req, res, next) => {
    if ( !req.isAuthenticated() ) return next( createError.Unauthorized() )
    const {employeeId, employeeRole} = req.body
    
    db.query('UPDATE employees SET employee_role = $1 WHERE id = $2', 
        [employeeRole, employeeId],
        (err, result) => {
            if ( err ) return next( createError.BadRequest() )

            res.status( 200 ).json({
                message: 'role update successfully'
            })
        }

    )
})

employeeRouter.patch('/assign/campaign', (req, res, next) => {
    if ( req.isAuthenticated() ) return next( createError.Unauthorized() )

    const qry = 
    'UPDATE employees SET campaign_id = $1, alt_campaign_id = $2 WHERE id = $3'

    const {campaignId, altCampaignId, employeeId} = req.body

    db.query(
        qry, 
        [campaignId, altCampaignId, employeeId],
        (err, result) => {
            if ( err ) return next( createError.BadRequest() )

            res.status(200).json({
                message: "information updated successfully",
            })
        }
    )
})

employeeRouter.patch('/edit/shiftduration', (req, res, next) => {
    if( !req.isAuthenticated() ) return next.Unauthorized() 
    const {shiftDuration} = req.body
    const loginDate = getCurrentDate(req.user.timeZone)

    const qry = 
    'UPDATE daily_logs SET shift_duration = $1 WHERE employee_id = $2 AND login_date = $3 RETURNING shift_duration'

    db.query(qry, [shiftDuration, req.user.id, loginDate], (err, result) => {
        if ( err ) return next(createError.BadRequest())

        return res.status(200).json({
            message: "Information updated successfully",
            newDuration: result.rows[0].shift_duration
        })
    })
})

employeeRouter.patch('/edit/shiftduration/manager', (req, res, next) => {
    if ( !req.isAuthenticated() ) return next(createError.Unauthorized())

    if ( req.user.employee_role !== 'manager') return next( createError.Forbidden() )

    const {shiftDuration, loginDate, employeeId} = req.body

    const qry = 
    'UPDATE daily_logs SET shift_duration = $1 WHERE login_date = $2 AND employee_id = $3 RETURNING shift_duration'

    db.query(qry, [shiftDuration, loginDate, employeeId], async (err, result) => {
        if ( err ) return next(createError.BadRequest())

        const salesPerHour = await updateLogsAfterEdit(employeeId, loginDate)

        return res.status(200).json({
            message: "Information updated successfully",
            newDuration: result.rows[0].shift_duration,
            salesPerHour: salesPerHour
        })
    })
})

employeeRouter.patch('/edit/names', (req, res, next) => {
    if( !req.isAuthenticated() ) return next( createError.Unauthorized() )

    const {firstName, lastName, employeeId} = req.body

    const qry = 'UPDATE employees SET first_name = $1, last_name = $2 WHERE id = $3'

    db.query(qry, [firstName, lastName, employeeId], (err, result) => {
        if ( err ) return next( createError.BadRequest() )

        return res.status(200).json({
            message: "Information updated successfully",
        })
    })
})

employeeRouter.get('/getemployees/all', (req, res, next) => {
    if ( !req.isAuthenticated() ) return next( createError.Unauthorized() )

    if ( req.user.employee_role !== 'manager' ) return next ( createError.Forbidden() )


    const qry = 
    `SELECT first_name, last_name, email, employee_role,\
    employee_number, employees.id as id, campaigns.name as campaign_name,\
    goals.name as goal_name, manager_id, employees.campaign_id as campaign_id\
    FROM employees\
    FULL JOIN campaigns ON campaigns.id = employees.campaign_id\
    FULL JOIN goals ON goals.id = campaigns.goal_id WHERE first_name \
    IS NOT NULL  AND employees.company_id = $1 AND  employee_role != 'manager'`
    
    db.query(qry, [req.user.company_id], (err, result) => {
        if ( err ) return next( createError.BadRequest(err.message) )
        return res.status(200).json({
            message: 'data retrieved successfull',
            requestedData: result.rows
        })
    })


})

employeeRouter.get('/getsubordinates/:id', (req, res, next) => {
    if ( !req.isAuthenticated() ) return next( createError.Unauthorized() )

    if ( req.user.employee_role !== 'manager' ) return next ( createError.Forbidden() )

    const {id} = req.params

    const qry = 
    'SELECT first_name, last_name, email, employee_role,\
    employee_number, employees.id as id, campaigns.name as campaign_name,\
    goals.name as goal_name, manager_id, employees.campaign_id as campaign_id\
    FROM employees\
    INNER JOIN campaigns ON campaigns.id = employees.campaign_id\
    INNER JOIN goals ON goals.id = campaigns.goal_id\
    WHERE manager_id =$1'   
    
    db.query(qry, [id], (err, result) => {
        if ( err ) return next( createError.BadRequest(err.message) )
        return res.status(200).json({
            message: 'data retrieved successfull',
            requestedData: result.rows
        })
    })


})

employeeRouter.post('/confirmemail', async (req, res, next) => {
    const {username} = req.body
    const emailExists = await verifyEmailExists(username)
    if ( !emailExists ) return next(createError.Unauthorized())

    const otp = generateOtp()
    const createdAt = getCurrentDateTme(req.user.timeZone)
    const htmlEmail = `<p>Please use the following passcode to confirm your email\
    in the weedman sales tracker: <br> <b>${otp}</b> <br> Please note that the code is only\
    valid for 30 minutes <br> <br> Kind regards, <br> SalesVerse Support Team</p>`

    const qry = 
    'INSERT INTO otps(id, otp_value, created_at) VALUES(default, $1, $2) RETURNING id'

    db.query(qry, [otp, createdAt], async (err, result) => {
        if( err ) return next(createError.InternalServerError())
        
        // send otp via email
        const emailSent = await sendEmail(htmlEmail, username)

        if (!emailSent) return next(createError.InternalServerError())

        return res.status(200).json({
            message: 'OTP sent successfully',
            otpId: result.rows[0].id
        })
    })
})

employeeRouter.post('/verifyotp', (req, res, next) => {
    const {otp, id} = req.body
    const validFor = 30
    const qry = 
    'SELECT * FROM otps WHERE id = $1'

    db.query(qry, [id], async (err, result) => {
        if( err ) return next( createError.BadRequest() )
        if (result.rows.length !== 0){

            const validOtp = result.rows[0].otp_value
            const createdAt = result.rows[0].created_at
            const currentTime = getCurrentDateTme(req.user.timeZone)
            const timeDifference = differenceInHours(currentTime, createdAt)
            
            if (validOtp !== otp) {
                
                try{
                    await db.query('DELETE FROM otps WHERE id = $1', [id])
    
                    return next(createError.Conflict('Incorrect passcode'))
                }catch(error){
                    console.log(error.message)
                    return next(createError.InternalServerError())
                }
            }
            if (timeDifference > validFor) {
                
                try{
                    await db.query('DELETE FROM otps WHERE id = $1', [id])
    
                    return next ( createError.Conflict('Passcode expired') )
                }catch(error){
                    console.log(error.message)
                    return next(createError.InternalServerError())
                }
            }

            return res.status(200).json({
                message: 'Correct passcode',
                otpId: result.rows[0].id
            })
        }
        else{
            return next(createError.BadRequest())
        }

    })
})

employeeRouter.put('/resetpassword', async (req, res, next) => {
    const {newPassword, username, otpId} = req.body

    const otpExists = await verifyOtpExists(otpId, req.user.timezone)

    const qry = 
    'UPDATE employees SET password = $1 WHERE email = $2'
    if (otpExists){

        db.query('DELETE FROM otps WHERE id = $1', [otpId], err => {
            if ( err ) return next(createError.InternalServerError())
        })

        bcrypt.hash(newPassword, saltRounds, (err, hash) => {
            if ( err ) return next( createError.InternalServerError())
    
            db.query(qry, [hash, username], (err, result) => {
                if ( err ) return next ( createError.InternalServerError() )
    
                return res.status(200).json({
                    message: 'Password updated successfully'
                })
            })
        })
    }
    else{
        return next(createError.Forbidden())
    }

})

employeeRouter.get('/resendotp', async (req, res, next) => {
    const {username} = req.body

    const emailExists = await verifyEmailExists(username)

    if (emailExists) {
        const newOtp = generateOtp()
        res.status(200).json({
            message: 'Otp generated  successfully',
            otp: newOtp
        })
    }
    else
    {
        return next( createError.Forbidden() )
    }
})
export default employeeRouter
