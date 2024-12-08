import express from 'express'
import createError from 'http-errors'
import db from '../dbconnection.js'
import { getCurrentDate } from '../dateFns.js'

const logsRouter = express.Router()

logsRouter.get('/getlogs', (req, res, next) => {
    if ( !req.isAuthenticated() ) return next(createError.Unauthorized())

    const qry = 
    "SELECT login_date, first_name, last_name, sales_per_hour,\
    campaigns.name as campaign_name from daily_logs\
    INNER JOIN employees ON daily_logs.employee_id = employees.id\
    INNER JOIN campaigns ON campaigns.id = employees.campaign_id\
    WHERE login_date = $1 AND employee_role = 'sales associate'\
    ORDER BY sales_per_hour DESC LIMit 5"

    const loginDate = getCurrentDate(req.user.timeZone)

    db.query(qry, [loginDate], (err, result) => {
        if (err) return next(createError.BadRequest(err.message))

        res.status(200).json({
            message: 'Data retrieved successfully!',
            requestedData: result.rows
        })

    })
})
logsRouter.get('/getlogs/:id', (req, res, next) => {
    if ( !req.isAuthenticated() ) return next(createError.Unauthorized())

    if (req.user.employee_role !== 'manager') return next(createError.Forbidden())

    const qry = 
    "SELECT * from daily_logs\
    WHERE login_date <= $1 AND employee_id = $2\
    ORDER BY sales_per_hour DESC LIMit 10"

    const {id} = req.params

    const loginDate = getCurrentDate(req.user.timeZone)

    db.query(qry, [loginDate, id], (err, result) => {
        if (err) return next(createError.BadRequest(err.message))

        res.status(200).json({
            message: 'Data retrieved successfully!',
            requestedData: result.rows
        })

    })
})
logsRouter.get('/getlogsbyid&date', (req, res, next) => {
    if ( !req.isAuthenticated() ) return next(createError.Unauthorized())

    if (req.user.employee_role !== 'manager') return next(createError.Forbidden())

    const qry = 
    "SELECT * from daily_logs\
    WHERE login_date <= $1 AND employee_id = $2\
    ORDER BY sales_per_hour DESC LIMit 10"

    const {id, date} = req.query

    const loginDate = date

    db.query(qry, [loginDate, id], (err, result) => {
        if (err) return next(createError.BadRequest(err.message))

        res.status(200).json({
            message: 'Data retrieved successfully!',
            requestedData: result.rows
        })

    })
})

logsRouter.get('/getlogsdaily/:date', (req, res, next) => {
    if ( !req.isAuthenticated() ) return next(createError.Unauthorized())

    const {date} = req.params

    const qry = 
    "SELECT login_date, first_name, last_name, sales_per_hour,\
    campaigns.name as campaign_name from daily_logs\
    INNER JOIN employees ON daily_logs.employee_id = employees.id\
    INNER JOIN campaigns ON campaigns.id = employees.campaign_id\
    WHERE login_date = $1 AND employee_role = 'sales associate'\
    ORDER BY sales_per_hour DESC LIMIT 5"


    db.query(qry, [date], (err, result) => {
        if (err) return next(createError.BadRequest(err.message))

        res.status(200).json({
            message: 'Data retrieved successfully!',
            requestedData: result.rows
        })

    })
})

logsRouter.get('/getchartdata', (req, res, next) => {
    if (!req.isAuthenticated()) return next(createError.Unauthorized())
    
    const currentDate = getCurrentDate(req.user.timeZone)
    

    const qry = 
    'SELECT login_date, sales_per_hour FROM daily_logs\
    WHERE employee_id = $1 AND login_date < $2 AND sales_per_hour IS NOT NULL ORDER BY login_date LIMIT 9'

    db.query(qry, [req.user.id, currentDate], (err, result) => {
        if ( err ) return next(createError.InternalServerError())


        return res.status(200).json({
            message: "Chart data retrieved successfully",
            requestedData: result.rows
        })
    })
})
logsRouter.get('/getchartdata/:id', (req, res, next) => {
    if (!req.isAuthenticated()) return next(createError.Unauthorized())
    
    if (req.user.employee_role !== 'manager') {
        return next(createError.Forbidden())
    }
    
    const currentDate = getCurrentDate(req.user.timeZone)
    const {id} = req.params
    
    const qry = 
    'SELECT login_date, sales_per_hour FROM daily_logs\
    WHERE employee_id = $1 AND login_date < $2 ORDER BY login_date LIMIT 9'

    db.query(qry, [id, currentDate], (err, result) => {
        if ( err ) return next(createError.InternalServerError())


        return res.status(200).json({
            message: "Chart data retrieved successfully",
            requestedData: result.rows
        })
    })
})

logsRouter.get('/gechartData/:date', (req, res, next) => {
    if (!req.isAuthenticated()) return next(createError.Unauthorized())
        
    const {date} = req.params
    const qry = 
    'SELECT login_date, sales_per_hour FROM daily_logs\
    WHERE employee_id = $1 AND login_date < $2 ORDER BY login_date LIMIT 9'

    db.query(qry, [req.user.id, date], (err, result) => {
        if ( err ) return next(createError.InternalServerError())


        return res.status(200).json({
            message: "Chart data retrieved successfully",
            requestedData: result.rows
        })
    })
})

export default logsRouter