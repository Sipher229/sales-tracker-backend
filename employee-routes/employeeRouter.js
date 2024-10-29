import express from 'express'
import createError from 'http-errors'
import db from '../dbconnection.js'
import bcrypt from 'bcrypt'

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


employeeRouter.get('/getemployee', (req, res, next) => {
    if(!req.isAuthenticated()){
        return next(createError.Unauthorized())
    }
    else{
        // const getEmployeeQry = 
        // 'SELECT first_name , last_name, employee_number , email, employee_role as employeeRole, goals.name as goalName, campaigns.name as campaignName, employees.alt_campaign_id as altCampaign, shift_duration as shiftDuration \
        // FROM employees INNER JOIN goals ON employees.goal_id = goals.id INNER JOIN campaigns ON employees.campaign_id = campaigns.id WHERE employees.id = $1'
        // const empId = req.user.id
        // db.query(getEmployeeQry, [empId], (err, result) => {
        //     if (err) return next(createError.BadRequest(err.message))
            
        //     const employee = result.rows
        
        //     return res.status(200).json({
        //         requestedData: employee,
        //         message: 'retrieved data successfully'
        //     })
        // })

        const {email, id, employee_role} = req.user

        return res.status( 200 ).json({
            message: "authentication successful",
            requestedData: {email, id, employee_role}
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
    const {shiftDuration, employeeId} = req.body

    const qry = 
    'UPDATE employees SET shift_duration = $1 WHERE id = $2'

    db.query(qry, [shiftDuration, employeeId], (err, result) => {
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
    'SELECT first_name, last_name, email, shift_duration, employee_role, employee_number, id, campaign_id, manager_id, alt_campaign_id FROM employees WHERE manager_id =$1'
    
    db.query(qry, [id], (err, result) => {
        if ( err ) return next( createError.BadRequest(err.message) )

        return res.status(200).json({
            message: 'data retrieved successfull',
            requestedData: result.rows
        })
    })


})
export default employeeRouter