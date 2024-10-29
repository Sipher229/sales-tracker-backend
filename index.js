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

app.use('/sales', salesRoutes)
app.use('/goals', goalsRouter)
app.use('/campaigns', campaignsRouter)
app.use('/employees', employeeRouter)

app.post('/login', passport.authenticate('local', {
    successRedirect: '/employees/getemployee',
    failureRedirect: '/notauthorized'
}))


passport.use(new Strategy(function verify(username, password, done) {
    const qry = 'SELECT id, email, password, employee_role from employees where email = $1'
    
    db.query(qry, [username], (err, result) => {
        if(err){
            return done(err)
        }
        if(result.rows.length !== 0){

            bcrypt.compare(password, result.rows[0].password, (error, correct) =>{
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


app.get('/notauthorized', (req, res, next)=>{
    console.log('unauthorized')
    return next(createError.Unauthorized("Wrong email or password"))
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