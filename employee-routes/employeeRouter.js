import express from 'express'
import createError from 'http-errors'
import db from '../dbconnection.js'
import bcrypt from 'bcrypt'
import 'dotenv/config'
import { getCurrentDate } from '../dateFns.js'


const employeeRouter = express.Router()
const saltRounds = 10

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

employeeRouter.post('/confirmemail', (req, res, next) => {
    return next(createError.NotImplemented())
})

employeeRouter.post('/resetpassword', (req, res, next) => {
    return next(createError.NotImplemented())
})
export default employeeRouter

// update logs whenever a sale is edited or deleted