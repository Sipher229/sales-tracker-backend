import express from 'express'
import 'dotenv/config'
import cors from 'cors'
import createError from 'http-errors'
import bodyParser from 'body-parser'
import session from "express-session"
import {createClient} from "redis"
import { RedisStore } from 'connect-redis'
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

// added for redis
const redisClient = createClient({ 
    url: process.env.REDIS_ENDPOINT || 'salestracker-cache-oi1dud.serverless.cac1.cache.amazonaws.com:6379',
    socket: {
        tls: true
    }
})
console.log(process.env.REDIS_ENDPOINT)
redisClient.on('connect', () => {
    console.log('connected to redis memcache successfully. URL:' + process.env.REDIS_ENDPOINT)
})

redisClient.on('error', () => {
    console.error("Unable to connent to redis. Error: " + err)
})

// -----------------------------------------------------------------
app.use(bodyParser.urlencoded({extended: true}))

app.use(cors({
    origin: ['http://localhost:5173', 'http://99.79.9.197'],
    credentials: true,
    optionSuccessStatus: '200',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}))
app.use(express.json())


app.use(session({
    store: new RedisStore({client: redisClient, ttl: 8 * 3600 * 1000}) , // added for redis
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 8 * 3600 * 1000
    }
}))

app.use(passport.initialize())
app.use(passport.session())

app.use((req, res, next) => {
    if (req.isAuthenticated() && req.session.userTimeZone) {
        req.user.timeZone = req.session.userTimeZone;
    }
    next();
});

app.use('/api/sales', salesRoutes)
app.use('/api/goals', goalsRouter)
app.use('/api/campaigns', campaignsRouter)
app.use('/api/employees', employeeRouter)
app.use('/api/logs', logsRouter)
app.use('/api/jobaids', jobAidRouter)

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

app.post('/api/login', (req, res, next) => {
    const {tz, username, password} = req.body
    passport.authenticate('local', (err, user) => {
        if(err) return next(createError.InternalServerError(err.message))

        if(!user) return res.redirect('/api/unauthorized')

        req.logIn(user, async (error) => {
            if (error) return next(createError.InternalServerError(error.message))

            req.user.timeZone = tz
            req.session.userTimeZone = tz
            const loginDate = getCurrentDate(tz)
    
            const timeAndDate = getCurrentDateTme(tz)
            
            const loggedInToday = await verifyLoggedInToday(username, loginDate)

            if ( !loggedInToday ){
                await updateLoginTime(loginDate, timeAndDate, req.user.id)
            
            }

            return res.redirect('/api/employees/getemployee')
        })
    })(req, res, next);
})


passport.use(new Strategy( async function verify(username, password, done) {
    const qry = 
    'SELECT id, email, password, employee_role from employees where email = $1'
    
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
        const currentDate = getCurrentDateTme(req.user.timeZone)
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