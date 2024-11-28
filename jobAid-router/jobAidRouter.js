import express from 'express'
import createError from 'http-errors'
import db from '../dbconnection.js'
import { getCurrentDate } from '../dateFns.js'

const jobAidRouter = express.Router() 

jobAidRouter.get('/getjobaids', async (req, res, next) => {
    if (!req.isAuthenticated() ) return next(createError.Unauthorized())


    const qry = 'SELECT * FROM job_aids'

    try{
        const response = await db.query(qry)
        res.status(200).json({
            message: 'Retrieved data successfully',
            requestedData: response.rows
        })
    }
    catch (error){
        return next(createError.InternalServerError())
    }


})

jobAidRouter.delete('/delete/:id', (req, res, next) => {
    if(!req.isAuthenticated()) return next(createError.Unauthorized())

    const qry = 'DELETE FROM job_aids WHERE id = $1'

    const {id} = req.params

    db.query(qry, [id], (err) => {
        if(err) return next(createError.BadRequest)

        return res.status(200).json({
            message: 'Data deleted successfully'
        })
    })

})

jobAidRouter.post('/addjobaid', (req, res, next) => {
    if(!req.isAuthenticated()) return next(createError.Unauthorized())

    const qry = 
    'INSERT INTO job_aids(id, name, doc_url, employee_id) values (DEFAULT, $1, $2, $3)'

    const {name, url} = req.body
    const employeeId = req.user.id

    db.query(qry, [name, url, employeeId], (err) => {
        if (err) return next(createError.BadRequest())
        
        return res.status(200).json({
            message: 'Data added successfully',
        })
        
    })
})

jobAidRouter.patch('/edit/:id', (req, res, next) => {
    if(!req.isAuthenticated()) next(createError.Unauthorized())

    const {name, url} = req.body
    const {id} = req.params

    const qry = 'UPDATE job_aids SET name = $1, doc_url= $2 WHERE id = $3'

    db.query(qry, [name, url, id], (err) => {
        if(err) return next(createError.Unauthorized())

        return res.status(200).json({
            message: 'Data updated successfully'
        })
    })
})


export default jobAidRouter