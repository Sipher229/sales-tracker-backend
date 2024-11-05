import express from 'express'
import createError from 'http-errors'
import db from '../dbconnection.js'
import bcrypt from 'bcrypt'
import 'dotenv/config'
import { differenceInHours, getCurrentDate, getCurrentDateTme } from '../dateFns.js'
import sendEmail from '../sendEmail.js'


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

const verifyOtpExists = async (id) => {
    const qry = 
    'SELECT * FROM otps WHERE id = $1'
    const validFor = 30

    try{
        const response = await db.query(qry, [id])

        if (response.rows !== 0){
            const createdAt = response.rows[0].created_at
            const currentTime = getCurrentDateTme()
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
// ---------------------------------------------------------------------------------------

// ============================================ routes =======================================

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
        username, 
        password,
        employeeRole,
    } = req.body
    const managerId = req.user.id
    const registerQry = 
    'INSERT INTO employees(id, first_name, last_name, employee_number, email, password, employee_role, manager_id)\
    VALUES(DEFAULT, $1, $2, $3, $4, $5, $6, $7) RETURNING id'

    const emailExists = await verifyEmailExists(username)
    if(!emailExists){
        bcrypt.hash(password, saltRounds, (err, hash) => {
            if(err) {
                next(createError.InternalServerError())
            }
            db.query(registerQry, [firstName, lastName, employeeNumber, username, 
                hash, employeeRole, managerId],
                
                (error, response)=>{
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

employeeRouter.get('/getemployee', async  (req, res, next) => {
    if(!req.isAuthenticated()){
        return next(createError.Unauthorized())
    }
    else{
        const empId = req.user.id

        const getEmployeeQry = 
        'SELECT employees.id as employeeId, first_name , last_name, employee_number , email, employee_role, goals.name as goalName,\
        campaigns.name as campaignName, shift_duration, login_time, sales_per_hour, daily_logs.commission as closingCommission\
        FROM campaigns FULL JOIN goals ON goals.id = campaigns.goal_id FULL JOIN employees\
        ON campaigns.id = employees.campaign_id FULL JOIN daily_logs ON employees.id = daily_logs.employee_id\
        WHERE employees.id = $1'
        
        db.query(getEmployeeQry, [empId], (err, result) => {
            if (err) return next(createError.BadRequest(err.message))
            
            const employee = result.rows
        
            return res.status(200).json({
                requestedData: employee,
                message: 'retrieved data successfully'
            })
        })

    }

})

employeeRouter.get('/getmanagers', async (req, res, next) => {
    if ( ! req.isAuthenticated() ) return next( createError.Unauthorized() )

    const getManagersQry = 'SELECT * FROM employees WHERE employee_role = $1'

    try{
        const result = await db.query(getManagersQry, ['manager'])
        return res.status(200).json({
            message: "data retrieved successfully",
            requestedData: result.rows
        })
    }
    catch (error) {
        return next ( createError.BadRequest(error.message) )
    }
    
})

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
    const {shiftDuration} = req.body
    const loginDate = getCurrentDate()

    const qry = 
    'UPDATE daily_logs SET shift_duration = $1 WHERE login_date = $2'

    db.query(qry, [shiftDuration, loginDate], (err, result) => {
        if ( err ) return next(createError.BadRequest())

        return res.status(200).json({
            message: "Information updated successfully",
        })
    })
})

employeeRouter.patch('/edit/shiftduration/manager', (req, res, next) => {
    if ( !req.isAuthenticated() ) return next(createError.Unauthorized())

    if ( req.user.employee_role !== 'manager') return next( createError.Forbidden() )

    const {shiftDuration, loginDate} = req.body

    const qry = 
    'UPDATE daily_logs SET shift_duration = $1 WHERE login_date = $2'

    db.query(qry, [shiftDuration, loginDate], (err, result) => {
        if ( err ) return next(createError.BadRequest())

        return res.status(200).json({
            message: "Information updated successfully",
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

employeeRouter.get('/getsubordinates/:id', (req, res, next) => {
    if ( !req.isAuthenticated() ) return next( createError.Unauthorized() )

    if ( req.user.employee_role !== 'manager' ) return next ( createError.Forbidden() )

    const {id} = req.params

    const qry = 
    'SELECT first_name, last_name, email, shift_duration, employee_role,\
    employee_number, employees.id as id, campaign_id, manager_id, alt_campaign_id, login_time\
    FROM employees INNER JOIN daily_logs ON employees.id = daily_logs.employee_id\
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
    const createdAt = getCurrentDateTme()
    const htmlEmail = `<p>Please use the following passcode to confirm your email\
    in the weedman sales tracker: <br> <b>${otp}</b> <br> Please note that the code is only\
    valid for 30 minutes <br> <br> Kind regards, <br> Weedman Sales Tracker Team</p>`

    const qry = 
    'INSERT INTO otps(id, otp_value, created_at) VALUES(default, $1, $2) RETURNING id'

    db.query(qry, [otp, createdAt], async (err, result) => {
        if( err ) return next(createError.InternalServerError())
        
        // send otp via email
        const emailSent = await sendEmail(htmlEmail, username)

        if (!emailSent) return next(createError.InternalServerError())

        return res.status(200).json({
            message: 'OTP sent successfully',
            requestedData: result.rows
        })
    })
})

employeeRouter.post('/verifyotp', (req, res, next) => {
    const {userOtp, id} = req.body
    const otp = userOtp.toString()
    const validFor = 30
    const qry = 
    'SELECT * FROM otps WHERE id = $1'

    db.query(qry, [id], async (err, result) => {
        if( err ) return next( createError.BadRequest() )
        
        const validOtp = result.rows[0].otp_value
        const createdAt = result.rows[0].created_at
        const currentTime = getCurrentDateTme()
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

    })
})

employeeRouter.post('/resetpassword', async (req, res, next) => {
    const {newPassword, employeeId, otpId} = req.body

    const otpExists = await verifyOtpExists(otpId)

    const qry = 
    'UPDATE employees SET password = $1 WHERE id = $2'
    if (otpExists){

        db.query('DELETE FROM otps WHERE id = $1', [otpId], err => {
            if ( err ) return next(createError.InternalServerError())
        })

        bcrypt.hash(newPassword, saltRounds, (err, hash) => {
            if ( err ) return next( createError.InternalServerError())
    
            db.query(qry, [hash, employeeId], (err, result) => {
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
    const {otpId} = req.body

    const otpExits = await verifyOtpExists(otpId)

    if (otpExits) {
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

// update logs whenever a sale is edited or deleted