import express from 'express'
import createError from 'http-errors'
import db from '../dbconnection.js'
import { getCurrentDate } from '../dateFns.js'

const logsRouter = express.Router()

logsRouter.get('/getlogs', (req, res, next) => {
    if ( !req.isAuthenticated() ) return next(createError.Unauthorized)

    const qry = 
    "SELECT login_date, first_name, last_name, sales_per_hour,\
    campaigns.name as campaign_name from daily_logs\
    INNER JOIN employees ON daily_logs.employee_id = employees.id\
    INNER JOIN campaigns ON campaigns.id = employees.campaign_id\
    WHERE login_date = $1 AND employee_role = 'sales associate'\
    ORDER BY sales_per_hour DESC\ "

    const loginDate = getCurrentDate()

    db.query(qry, [loginDate], (err, result) => {
        if (err) return next(createError.BadRequest(err.message))

        res.status(200).json({
            message: 'Data retrieved successfully!',
            requestedData: result.rows
        })

    })
})

export default logsRouter