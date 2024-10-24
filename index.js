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


const app = express()
const port = process.env.port || 3000
const saltRounds = 10


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

const verifyEmailExists = async (email) => {
    try {
        const result = await db.query(
            'SELECT * FROM employees where email = $1',
            [email]
        )
        return result.rows.length !== 0
    } catch (error) {
        console.log(error.message)
        return false
    }
    
}
app.post('/addemployee', async (req, res, next) => {
    console.log('registering employee...')
    const {
        firstName,
        lastName, 
        employeeNumber, 
        username, 
        password, 
    } = req.body

    const registerQry = 
    'INSERT INTO employees(id, first_name, last_name, employee_number, email, password)\
    VALUES(DEFAULT, $1, $2, $3, $4, $5) RETURNING id'

    const emailExists = await verifyEmailExists(username)
    if(!emailExists){
        bcrypt.hash(password, saltRounds, (err, hash) => {
            if(err) {
                next(createError.InternalServerError())
            }
            db.query(registerQry, [firstName, lastName, employeeNumber, username, 
                hash],
                
                (error, result)=>{
                    if (error) {
                        next(createError.BadRequest(error.message))
                    }
                    else{
                        req.logIn(result.rows[0], (err) => {
                            if (err) return next(createError.InternalServerError()) 
                            res.redirect('/getemployee')
                        })
                    }
                }
            )
        })
        
    } else {
        next(createError.Conflict('email already exists'))
    }
    
})

app.post('/login', passport.authenticate('local', {
    successRedirect: '/getemployee',
    failureRedirect: '/notauthorized'
}))

passport.use(new Strategy(function verify(username, password, done) {
    const qry = 'SELECT id, email, password from employees where email = $1'
    
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

app.get('/getemployee', (req, res, next) => {
    if(!req.isAuthenticated()){
        return next(createError.Unauthorized())
    }
    else{
        const getEmployeeQry = 
        'SELECT first_name , last_name, employee_number , email, employee_role as employeeRole, goals.name as goalName, campaigns.name as campaignName, employees.alt_campaign_id as altCampaign, shift_duration as shiftDuration \
        FROM employees INNER JOIN goals ON employees.goal_id = goals.id INNER JOIN campaigns ON employees.campaign_id = campaigns.id WHERE employees.id = $1'
        const empId = req.user.id
        db.query(getEmployeeQry, [empId], (err, result) => {
            if (err) return next(createError.BadRequest(err.message))
            
            const employee = result.rows[0]
        
            return res.status(200).json({
                employeeData: employee,
                message: 'retrieved data successfully'
            })
        })
        
    }
})

app.get('/notauthorized', (req, res, next)=>{
    console.log('unauthorized')
    return next(createError.Unauthorized())
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