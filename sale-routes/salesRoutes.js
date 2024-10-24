import express from 'express'
import db from '../dbconnection.js'
import createError from 'http-errors'

const salesRoutes = express.Router()

salesRoutes.post('/addsale', (req, res, next) => {
    if(!req.isAuthenticated() ){
        return next(createError.Unauthorized())
    }
    const {
        customerNumber,
        campaignId,
        saleName,
        price,
        discount,
        commission, 
        tax,
        employeeId,
        entryDate
    } = req.body

    const addSaleQry = 
    'INSERT INTO sales(customer_number, campaign_id,\
    sale_name, price, discount, tax, commission, employee_id, entry_date)\
    VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)'

    db.query(
        addSaleQry,
        [customerNumber, campaignId, saleName, price, discount, tax, commission, employeeId, entryDate],
        (err, result) => {
            if( err ) return next(createError.BadRequest('unable to save sale'))
            
            return res.status(200).json({
                message: 'added sale successfully',
            })
        }
    )
})

salesRoutes.delete('/deletesale/:id', (req, res, next) => {
    if ( !req.isAuthenticated() ) {
        return next(createError.Unauthorized())
    }
    const id = req.params.id
    const deleteSaleQry = 'DELETE FROM sales WHERE id = $1'

    db.query(deleteSaleQry, [id], (err, result) =>{
        if(err) return next(createError.BadRequest('could not delete'))
        
        return res.status(200).json({
            message: 'Successfully deleted sale',
        })
    })

})

salesRoutes.put('/editsale', (req, res, next)=> {
    if( !req.isAuthenticated() ) {
        return next(createError.Unauthorized())
    }
    const {
        customerNumber,
        campaignId,
        saleName,
        price,
        discount,
        commission, 
        tax,
        employeeId,
        id,
        entryDate
    } = req.body
    const editSaleQry = 'UPDATE sales SET customer_number = $1, campaign_id = $2,\
    sale_name = $3, price = $4, discount = $5, tax = $6, commission = $7, employee_id =$8, entry_date = $9\
    WHERE id = $10'

    db.query(
        editSaleQry,
        [customerNumber, campaignId, saleName, price, discount, tax, commission, employeeId, entryDate, id],
        (err) => {
            if ( err ) return next(createError.BadRequest('Unable to edit sale'))
            
            return res.status(200).json({
                message: 'succesfully updated the sale'
            })
        }
    )
})

salesRoutes.get('/getsales/all', (req, res, next) => {
    if(!req,isAuthenticated()){
        return next(createError.Unauthorized())
    }
    const getSalesQry = 
    'SELECT * FROM SALES WHERE employee_id = $1 ORDER BY commission DESC'
    const empId = req.user.id
    db.query(getSalesQry, [empId], (err, result) => {
        if ( err ) {
            return next(createError.BadRequest())
        }
        const employeeSales = result.rows
        return res.status(200).json({
            message: 'retrieved data successfully',
            sales: employeeSales
        })
    })
})

salesRoutes.get('/getsalesbydate/:date', (req, res, next) => {
    if(!req,isAuthenticated()){
        return next(createError.Unauthorized())
    }
    const desiredDate = req.params.date
    const getSalesQry = 
    'SELECT * FROM SALES WHERE employee_id = $1 AND entry_date = $2'
    db.query(getSalesQry, [req.user.id, desiredDate], (err, result) => {
        if ( err ) return next(createError.BadRequest())
        
        const resultData = result.rows
        return res.status(200).json({
            message: 'retrieved data successfully',
            sales: resultData
        })
    } )
})

export default salesRoutes