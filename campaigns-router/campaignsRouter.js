import express from 'express'
import db from '../dbconnection.js'
import createError from 'http-errors'

const campaignsRouter = express.Router()

campaignsRouter.post('/addcampaign', (req, res, next) => {
    if( !req.isAuthenticated() ){
        return next(createError.Unauthorized() )
    }
    const {
        name,
        commission,
        tax,
        goalId,
        employeeId,
        entryDate
    } = req.body

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

campaignsRouter.put('/editcampaign', (req, res, next) => {
    if( !req.isAuthenticated() ) {
        return next(createError.Unauthorized())
    }

    const {
        name,
        commission,
        tax,
        discount, 
        gaolId,
        employeeId,
        entryDate,
        id
    } = req.body

    const editCampaignQry = 'UPDATE sales SET name = $1, goal_id = $2,\
    discount = $3, tax = $4, commission = $5, employee_id =$6, entry_date = $7\
    WHERE id = $8'

    db.query(
        editSaleQry,
        [name, gaolId, discount, tax, commission, employeeId, entryDate, id],
        (err) => {
            if ( err ) return next(createError.BadRequest('Unable to edit campaign'))
            
            return res.status(200).json({
                message: 'changes saved successfully'
            })
        }
    )
})

campaignsRouter.get('/getcampaign/all', (req, res, next) => {
    if(!req.isAuthenticated()){
        return next(createError.Unauthorized())
    }
    const getSalesQry = 
    'SELECT * FROM campaigns ORDER BY entry_date DESC'

    db.query(getSalesQry, (err, result) => {
        if ( err ) {
            return next(createError.BadRequest())
        }
        const campaigns = result.rows
        return res.status(200).json({
            message: 'retrieved data successfully',
            requestedData: campaigns,
        })
    })
})

export default campaignsRouter