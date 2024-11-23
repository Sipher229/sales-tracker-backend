import express from 'express'
import createError from 'http-errors'
import db from '../dbconnection.js'
import {getCurrentDate} from '../dateFns.js'

const goalsRouter = express.Router()

goalsRouter.post('/addgoal', (req, res, next) => {
    if( !req.isAuthenticated() ){
        return next(createError.Unauthorized() )
    }

    if( !req.user.employee_role ){
        return next(createError.Forbidden() )
    }

    const {
        name,
        hourlySales,
        hourlyDecisions,
    } = req.body
    const employeeId = req.user.id
    const entryDate = getCurrentDate()
    
    const addGoalQry =
    'INSERT INTO goals(name, hourly_sales,\
    hourly_decisions, employee_id, entry_date)\
    VALUES($1, $2, $3, $4, $5)'

    db.query(
        addGoalQry,
        [name, hourlySales, hourlyDecisions, employeeId, entryDate],
        (err, result)=> {
            if ( err ) return next(createError.BadRequest(err.message))

            return res.status(200).json({
                message: 'campaign added successfully'
            })
        }
    )
})

goalsRouter.delete('/delete/:id', (req, res, next) => {
    if( !req.isAuthenticated() ){
        return next( createError.Unauthorized() )
    }
    const {id} = req.params.id

    const deleteGoalQry = 'DELETE FROM goals WHERE id = $1'

    db.query(deleteGoalQry, [id], (err, result) =>{
        if(err) return next(createError.BadRequest('could not delete'))
        
        return res.status(200).json({
            message: 'Successfully deleted goal',
        })
    })
})

goalsRouter.patch('/editgoal/:id', (req, res, next) => {
    if( !req.isAuthenticated() ){
        return next(createError.Unauthorized() )
    }
    if ( req.user.employee_role !== 'manager') return next(createError.Forbidden())
    
    const id = req.params.id
    const {
        name,
        hourlySales,
        hourlyDecisions,
    } = req.body
    const employeeId = req.user.id

    const editQry = 'UPDATE goals SET name = $1, hourly_sales = $2,\
    hourly_decisions = $3, employee_id = $4 WHERE  id = $5'

    db.query(
        editQry,
        [name, hourlySales, hourlyDecisions, employeeId, id],
        (err, result)=> {
            if ( err ) {
                console.log(err.message)
                return next(createError.BadRequest('Unable to edit goal'))
            }

            return res.status(200).json({
                message: 'changes saved successfully'
            })
        }

    )
})

goalsRouter.get('/getgoals/all', (req, res, next) => {
    if(!req.isAuthenticated()){
        return next(createError.Unauthorized())
    }
    const getSalesQry = 
    'SELECT * FROM goals ORDER BY entry_date DESC'

    db.query(getSalesQry, (err, result) => {
        if ( err ) {
            return next(createError.BadRequest())
        }
        const goals = result.rows
        return res.status(200).json({
            message: 'retrieved data successfully',
            requestedData: goals,
        })
    })
})

export default goalsRouter