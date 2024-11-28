import express from 'express'
import 'dotenv/config'
import cors from 'cors'
import createError from 'http-errors'
import bodyParser from 'body-parser'
import session from "express-session"
import db from './dbconnection.js'
import bcrypt from 'bcrypt'
import passport from 'passport'
import { Strategy } from 'passport-local'
import salesRoutes from './sale-routes/salesRoutes.js'
import goalsRouter from './goals-routes/goalsRoutes.js'
import campaignsRouter from './campaigns-router/campaignsRouter.js'
import employeeRouter from './employee-routes/employeeRouter.js'
import {getCurrentDate, getCurrentDateTme} from './dateFns.js'
import logsRouter from './log-router/logsRouter.js'
import jobAidRouter from './jobAid-router/jobAidRouter.js'


const app = express()
const port = process.env.port || 3000


app.use(bodyParser.urlencoded({extended: true}))

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
    optionSuccessStatus: '200',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}))
app.use(express.json())

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 8 * 3600 * 1000
    }
}))

app.use(passport.initialize())
app.use(passport.session())

app.use('/api/sales', salesRoutes)
app.use('/api/goals', goalsRouter)
app.use('/api/campaigns', campaignsRouter)
app.use('/api/employees', employeeRouter)
app.use('/api/logs', logsRouter)
app.use('/api/jobaids', jobAidRouter)

app.post('/api/login', passport.authenticate('local', {
    successRedirect: '/api/employees/getemployee',
    failureRedirect: '/api/notauthorized'
}))

const updateLoginTime =  async (loginDate, loginTimeAndDate, employeeId) => {
    const qry = 
    'INSERT INTO daily_logs(login_time, login_date, employee_id, shift_duration)\
    VALUES($1, $2, $3, 8)'
   

    try {
        const response = await db.query(qry, [loginTimeAndDate, loginDate , employeeId])
        return true
    } catch (error) {
        console.log(error.message)
        return false
    }
}
const verifyLoggedInToday = async (email, loginDate) => {
    const qry = 
    'SELECT * FROM employees INNER JOIN daily_logs\
    ON employees.id = daily_logs.employee_id WHERE email = $1 and login_date = $2'
    try {
        const response = await db.query(qry, [email, loginDate])
        if(response.rows.length === 0){
            return false
        }
        else{
            return true
        }

    } catch (error) {
        console.log(error.message)
        return false
    }
}

passport.use(new Strategy( async function verify(username, password, done) {
    const qry = 
    'SELECT id, email, password, employee_role from employees where email = $1'

    
    const loginDate = getCurrentDate()
    
    const timeAndDate = getCurrentDateTme()
    
    const loggedInToday = await verifyLoggedInToday(username, loginDate)
    
    db.query(qry, [username], (err, result) => {
        if(err){
            return done(err)
        }
        if(result.rows.length !== 0){

            bcrypt.compare(password, result.rows[0].password, async (error, correct) =>{
                if (error) {
                    return done(error)
                }
                else {
                    if(correct){
                        if ( !loggedInToday ){
                            await updateLoginTime(loginDate, timeAndDate, result.rows[0].id)
                        
                        }
                        return done(null, result.rows[0])
                        
                    }
                    else {
                        return done(null, false)
                    }
                }
            })
        } else{
            done(null, false)
        }
    })
}))

passport.serializeUser((user, done) => {
    done(null, user)
})
passport.deserializeUser((user, done) => {
    done(null, user)
})


app.get('/api/notauthorized', (req, res, next)=>{
    return next(createError.Unauthorized("Wrong email or password"))
}) 
    

app.delete("/api/logout", (req, res, next) => {
    if(req.isAuthenticated()){
        const currentDate = getCurrentDateTme()
        const qry = 'UPDATE daily_logs SET logout_time = $1 WHERE employee_id = $2'
        db.query(qry, [currentDate, req.user.id], err => {
            if ( err ) next(createError.InternalServerError())
        })
        return req.logOut((err)=>{
            if (err) {return next(createError.InternalServerError())}
            return res.status(200).json({
                message: "logged out successfully",
            })
        })
    }else{
        return next(createError.Unauthorized())
    }
    
})

app.use((req, res, next)=> {
    next(createError.NotFound())
})

app.use((err, req, res, next)=> {
    res.status(err.status || 404)
    res.json({
        message: err.message
    })
})



app.listen(port, () => console.log(`listening on port ${port}`) )