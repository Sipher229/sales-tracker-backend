import express from 'express'
import db from '../dbconnection.js'
import createError from 'http-errors'
import { getCurrentDate } from '../dateFns.js'

const campaignsRouter = express.Router()

campaignsRouter.post('/addcampaign', (req, res, next) => {
    if( !req.isAuthenticated() ){
        return next(createError.Unauthorized() )
    }

    if( req.user.employee_role !== 'manager' ) {
        return next(createError.Forbidden())
    }
    const {
        name,
        commission,
        tax,
        goalId,
    } = req.body
    const employeeId = req.user.id
    const entryDate = getCurrentDate()

    const addCampaignQry =
    'INSERT INTO campaigns(name, commission,\
    tax, goal_id, employee_id, entry_date)\
    VALUES($1, $2, $3, $4, $5, $6)'

    db.query(
        addCampaignQry,
        [name, commission, tax, goalId, employeeId, entryDate],
        (err, result)=> {
            if ( err ) return next(createError.BadRequest(err.message))

            return res.status(200).json({
                message: 'campaign added successfully'
            })
        }
    )
}) 

campaignsRouter.delete('/delete/:id', (req, res, next) => {
    if( !req.isAuthenticated() ){
        return next(createError.Unauthorized() )
    }
    const {id} = req.params.id

    const deleteCampaignQry = 'DELETE FROM campaigns WHERE id = $1'

    db.query(deleteCampaignQry, [id], (err, result) =>{
        if(err) return next(createError.BadRequest('could not delete'))
        
        return res.status(200).json({
            message: 'Successfully deleted campaign',
        })
    })
})

campaignsRouter.patch('/editcampaign/:id', (req, res, next) => {
    if( !req.isAuthenticated() ) {
        return next(createError.Unauthorized())
    }

    if ( req.user.employee_role !== 'manager') return next(createError.Forbidden())

    const {
        name,
        commission,
        tax,
        goalId,
    } = req.body
   
    const employeeId = req.user.id
    const id = req.params.id

    const editCampaignQry = 'UPDATE campaigns SET name = $1, goal_id = $2,\
    tax = $3, commission = $4, employee_id =$5\
    WHERE id = $6'

    db.query(
        editCampaignQry,
        [name, goalId, tax, commission, employeeId, id],
        (err) => {
            if ( err ) return next(createError.BadRequest(err.message))
            
            return res.status(200).json({
                message: 'changes saved successfully'
            })
        }
    )
})

campaignsRouter.get('/getcampaigns/all', (req, res, next) => {
    if(!req.isAuthenticated()){
        return next(createError.Unauthorized())
    }
    const getSalesQry = 
    'SELECT campaigns.id as campaign_id, campaigns.name as campaign_name, campaigns.entry_date as entry_date,\
    commission, tax, goals.name as goal_name, hourly_sales, hourly_decisions, campaigns.goal_id as goal_id\
    FROM campaigns\
    INNER JOIN goals ON goals.id = campaigns.goal_id  ORDER BY campaigns.entry_date DESC'

    db.query(getSalesQry, (err, result) => {
        if ( err ) {
            return next(createError.BadRequest(err.message))
        }
        const campaigns = result.rows
        return res.status(200).json({
            message: 'retrieved data successfully',
            requestedData: campaigns,
        })
    })
})

campaignsRouter.get('/getemployees/:id', (req, res, next) => {
    if (!req.isAuthenticated()) return next(createError.Unauthorized())

    if (req.user.employee_role !== 'manager') {
        return next(createError.Forbidden())
    }

    const qry = 'SELECT * FROM employees WHERE campaign_id = $1'

    const {id} = req.params

    db.query(qry, [id], (err, result) => {
        if (err) return next(createError.BadRequest())

        return res.status(200).json({
            message: 'Data retrieved successfully',
            requestedData: result.rows
        })
    })
})

export default campaignsRouter