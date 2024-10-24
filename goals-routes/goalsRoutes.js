import express from 'express'
import createError from 'http-errors'
import db from '../dbconnection.js'

const goalsRouter = express.Router()

goalsRouter.post('/addgoal', (req, res, next) => {
    if( !req.isAuthenticated() ){
        return next(createError.Unauthorized() )
    }
    const {
        name,
        hourlySales,
        hourlyDecisions,
        employeeId,
        entryDate
    } = req.body

    const addGoalQry =
    'INSERT INTO goals(name, hourly_sales,\
    hourly_decisions, employee_id entry_date)\
    VALUES($1, $2, $3, $4, $5)'

    db.query(
        addGoalQry,
        [name, hourlySales, hourlyDecisions, employeeId, entryDate],
        (err, result)=> {
            if ( err ) return next(createError.BadRequest('Unable to add goal'))

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

goalsRouter.put('/editgoal', (req, res, next) => {
    if( !req.isAuthenticated() ){
        return next(createError.Unauthorized() )
    }
    const {
        name,
        hourlySales,
        hourlyDecisions,
        employeeId,
        entryDate
    } = req.body

    const editSaleQry = 'UPDATE goals SET name = $1, hourly_sales = $2,\
    hourly_decisions = $3, employee_id = $4, entry_date = $5'

    db.query(
        addGoalQry,
        [name, hourlySales, hourlyDecisions, employeeId, entryDate],
        (err, result)=> {
            if ( err ) return next(createError.BadRequest('Unable to edit goal'))

            return res.status(200).json({
                message: 'changes saved successfully'
            })
        }

    )
})

goalsRouter.get('/getgoal/all', (req, res, next) => {
    if(!req,isAuthenticated()){
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
            goals,
        })
    })
})