import express from 'express'
import db from '../dbconnection.js'
import createError from 'http-errors'
import {differenceInHours, getCurrentDateTme, getCurrentDate} from '../dateFns.js'

const salesRoutes = express.Router()

const updateSalesForLogs = async (hoursLoggedIn, employeeId, loginDate, shiftDuration) => {
    let hours = hoursLoggedIn
    if (hoursLoggedIn  < 1){
        hours = 1
    }
    if (hoursLoggedIn > (shiftDuration-1)){
        hours = shiftDuration
    }
    const qry = 
    'UPDATE daily_logs SET\
    sales_per_hour = ((SELECT COUNT(*) FROM sales WHERE sales.employee_id = $1 AND entry_date = $2)::float/$3),\
    commission =  (SELECT SUM(sales.commission) FROM sales WHERE sales.employee_id = $4 AND entry_date = $5)\
    WHERE login_date = $6 AND employee_id = $7 RETURNING sales_per_hour'

    try {
        const response = await db.query(qry, [employeeId, loginDate, hours, employeeId, loginDate, loginDate, employeeId])
        return response.rows[0].sales_per_hour
    } catch (error) {
        console.log(error.message)
        return false
    }
}

const updateLogsAfterEdit = async (employeeId, entryDate) => {
    const qry =
    'UPDATE daily_logs SET\
    sales_per_hour = ((SELECT COUNT(*) FROM sales WHERE sales.employee_id = $1 AND entry_date = $2)/ (SELECT daily_logs.shift_duration from daily_logs WHERE employee_id = $3 AND login_date = $4 LIMIT 1)::float),\
    commission =  (SELECT SUM(sales.commission) FROM sales WHERE sales.employee_id = $5)\
    WHERE login_date = $6 AND employee_id = $7'

    try {
        await db.query(qry, [employeeId, entryDate, employeeId, entryDate, employeeId, entryDate, employeeId])
        return true
    } catch (error) {
        console.log(error.message)
        return false
    }
    
}

const getLoginTime = async (id, loginDate)=> {
    const qry = "SELECT login_time as login_time, shift_duration\
    from daily_logs WHERE login_date = $1 and employee_id = $2"

    try {
        const response = await db.query(qry, [loginDate, id])
        return {
            loginTime: response.rows[0].login_time, 
            shiftDuration: response.rows[0].shift_duration}
    } catch (error) {
        console.log(error.message)
        return false
    }
}

salesRoutes.post('/addsale', async (req, res, next) => {
    if( !req.isAuthenticated() ){
        return next(createError.Unauthorized())
    }
    const {
        customerNumber,
        campaignId,
        name,
        price,
        discount,
        commission, 
        tax,
        employeeId,
        status,
        details,
    } = req.body

    if (!status) return next(createError.NotFound("missing params"));

    const loginDate = getCurrentDate(req.user.timeZone)
    const {loginTime, shiftDuration} = await getLoginTime(req.user.id, loginDate)

    if (!loginTime) return next(createError.InternalServerError())
        
    const currentTime = getCurrentDateTme(req.user.timeZone)
    const hoursLoggedIn = differenceInHours(currentTime, loginTime)
    // console.log(loginTime + " " + currentTime)
    // console.log(hoursLoggedIn)
    
    const addSaleQry = 
    'INSERT INTO sales(customer_number, campaign_id,\
    sale_name, price, discount, tax, commission, employee_id, entry_date, company_id, status, details)\
    VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)'

    db.query(
        addSaleQry,
        [customerNumber, campaignId, name, price, discount, tax, commission, employeeId, loginDate, req.user.company_id, status, details],
        async (err, result) => {
            
            if( err ) return next(createError.BadRequest(err.message));
            if (status.toLowerCase() === "closed"){

                const logsUpdated = await updateSalesForLogs(hoursLoggedIn, employeeId, loginDate, shiftDuration)
    
                if (!logsUpdated) console.log('failed to update logs')
            }
            
            return res.status(200).json({
                message: 'added sale successfully',
            })
        }
    )
})

salesRoutes.patch('/update/salesperhour', async (req, res, next) => {
    if (!req.isAuthenticated() ) return next(createError.Unauthorized());

    const loginDate = getCurrentDate(req.user.timeZone)
    const {loginTime, shiftDuration} = await getLoginTime(req.user.id, loginDate)
    if (!loginTime) {
        return res.status(200).json({
            message: 'Unable to update login time. Internal server error',
            success: false
        })
    }
    const currentTime = getCurrentDateTme(req.user.timeZone)
    const hoursLoggedIn = differenceInHours(currentTime, loginTime)
    

    const response = await updateSalesForLogs(hoursLoggedIn,req.user.id, loginDate, shiftDuration)

    if (response) {
        return res.status(200).json({
            message: 'Update successful',
            salesPerHour: response,
            success: true
        })
    }

    else{
        return res.status(200).json({
            message: 'Unable to update login time. Internal server error',
            succss: false
        })
    }
    
})

salesRoutes.delete('/delete/:id', (req, res, next) => {
    if ( !req.isAuthenticated() ) {
        return next(createError.Unauthorized())
    }
    const id = req.params.id
    const {entryDate} = req.body
    const deleteSaleQry = 'DELETE FROM sales WHERE id = $1'

    db.query(deleteSaleQry, [id], async (err, result) =>{
        if(err) return next(createError.BadRequest('could not delete'))

        const updated = await updateLogsAfterEdit(req.user.id, entryDate)
        if (!updated) console.log('failed to update sales after delete')
        
        return res.status(200).json({
            message: 'Successfully deleted sale',
        })
    })

})

salesRoutes.patch('/editsale/:id', (req, res, next)=> {
    if( !req.isAuthenticated() ) {
        return next(createError.Unauthorized())
    }
    const {
        customerNumber,
        campaignId,
        name,
        price,
        discount,
        commission, 
        tax,
        entryDate,
        status,
        details
    } = req.body
    const {id} = req.params
    const employeeId = req.user.id
    if (!status) return next(createError.NotFound("Missing parameters"));
    
    const editSaleQry = 'UPDATE sales SET customer_number = $1, campaign_id = $2,\
    sale_name = $3, price = $4, discount = $5, tax = $6, commission = $7, status = $8, details = $9\
    WHERE id = $10'

    db.query(
        editSaleQry,
        [customerNumber, campaignId, name, price, discount, tax, commission, status, details, id],
        async (err) => {
            if ( err ) {
                console.log(err.message)
                return next(createError.BadRequest(err.message))
            }

            if (status.toLowerCase() === "closed") {

                const logsUpdated = await updateLogsAfterEdit(employeeId, entryDate)
                
                if ( !logsUpdated ) console.log('failed to update logs after sale edit');
            }

            
            return res.status(200).json({
                message: 'succesfully updated the sale'
            })
        }
    )
})

salesRoutes.get('/get-commission', (req, res, next) => {

    if (!req.isAuthenticated()) return next(createError.Unauthorized());

    const {date, id} = req.query;

    if (!date || !id) return next(createError.NotFound("Missing parameters."));

    const qry = "SELECT commission FROM daily_logs WHERE employee_id = $1 AND login_date = $2";

    db.query(qry, [id, date], (err, result) => {
        if (err) return next(createError.InternalServerError(err.message));
        
        if (result.rows.length !== 0){
            return res.status(200).json({
                commission: result.rows[0]?.commission,
                message: "data successfully retrieved",
            })
        }
        else{
            return res.status(200).json({
                commission: null,
                message: "data successfully retrieved",
            })
        }
    })
})

salesRoutes.get('/get-commission/:id', (req, res, next) => {

    if (!req.isAuthenticated()) return next(createError.Unauthorized());

    const {id} = req.params;
    const date = getCurrentDate(req.user.timeZone)

    if (!date || !id) return next(createError.NotFound("Missing parameters."));

    const qry = "SELECT commission FROM daily_logs WHERE employee_id = $1 AND login_date = $2";

    db.query(qry, [id, date], (err, result) => {
        if (err) return next(createError.InternalServerError());
        
        if (result.rows.length !== 0){
            return res.status(200).json({
                commission: result.rows[0]?.commission,
                message: "data successfully retrieved",
            })
        }
        else{
            return res.status(200).json({
                commission: null,
                message: "data successfully retrieved",
            })
        }
    })
})

salesRoutes.get('/getsales/all', (req, res, next) => {
    if(!req.isAuthenticated()){
        return next(createError.Unauthorized())
    }
    const entryDate = getCurrentDate(req.user.timeZone)
    const getSalesQry = 
    'SELECT sale_name, sales.id as id, customer_number, sales.commission, sales.tax, sales.price, campaign_id, sales.discount, sales.entry_date, sales.status, sales.details, campaigns.name as name FROM SALES\
    INNER JOIN campaigns ON campaigns.id = sales.campaign_id  WHERE sales.employee_id = $1 AND sales.entry_date = $2\
    ORDER BY sales.entry_date DESC'
    const empId = req.user.id
    db.query(getSalesQry, [empId, entryDate], (err, result) => {
        if ( err ) {
            console.log(err.message)
            return next(createError.BadRequest(err.message))
        }
        const employeeSales = result.rows
        return res.status(200).json({
            message: 'retrieved data successfully',
            requestedData: employeeSales
        })
    })
})

salesRoutes.get('/getsales/:date', (req, res, next) => {
    if(!req.isAuthenticated()){
        return next(createError.Unauthorized())
    }
    const desiredDate = req.params.date
    const getSalesQry = 
    'SELECT sale_name, sales.id as id, customer_number, sales.commission, sales.tax, sales.price, campaign_id,\
    sales.discount, sales.entry_date, sales.status, sales.details, campaigns.name as name FROM SALES\
    INNER JOIN campaigns ON campaigns.id = sales.campaign_id WHERE sales.employee_id = $1 AND sales.entry_date = $2 ORDER BY sales.commission DESC'
    db.query(getSalesQry, [req.user.id, desiredDate], (err, result) => {
        if ( err ) return next(createError.BadRequest(err.message))
        
        const resultData = result.rows
        return res.status(200).json({
            message: 'retrieved data successfully',
            requestedData: resultData
        })
    } )
})


salesRoutes.get('/getsales/employee/:id', (req, res, next) => {
    if ( !req.isAuthenticated() ) return next( createError.Unauthorized() )
    const getSalesQry = 
    'SELECT sale_name, name, sales.commission, sales.tax,\
    customer_number, discount, sales.entry_date, sales.id as id,\
    sales.campaign_id as campaign_id, price FROM sales INNER JOIN campaigns ON\
    campaign.id = sales.campaign_id WHERE sales.employee_id = $1'

    const id = req.params.id
    
    db.query(getSalesQry, [id], (err, result) => {
        if ( err ) {
            console.log(err.message)
            return next( createError.BadRequest(err.message) )
        } 

        return res.status(200).json({
            message: 'data retrieved successfully',
            requestedData: result.rows
        })
    })
    
})

export default salesRoutes