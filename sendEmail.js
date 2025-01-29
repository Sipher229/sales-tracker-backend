import nodemailer from 'nodemailer'
import 'dotenv/config'

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth:{
        user: 'neriwest20@gmail.com',
        pass: process.env.NODEMAILER_PASS
    }
})

const sendEmail =  async (html, receiver) => {
    try {
        const result = await transporter.sendMail({
            from: 'supportteam@salesverse.com <neriwest20@gmail.com',
            to: receiver,
            html: html,
            subject: 'One Time Passcode - SalesVerse'
    
        })
        return result
        
    } catch (error) {
        console.log(error.message)
        return false
    }

}
const sendEmailAdjustable = async (sender, html, receiver, subject) => {
    try {
        const result = await transporter.sendMail({
            from: sender,
            to: receiver,
            html: html,
            subject: subject
    
        })
        return result
        
    } catch (error) {
        console.log(error.message)
        return false
    }
}

transporter.verify((err, success) => {
    if ( err ){
        console.log(err.message)
    }
    else
    {
        console.log('connected to smtp server successfully')
    }
})
export {sendEmailAdjustable}
export default sendEmail

