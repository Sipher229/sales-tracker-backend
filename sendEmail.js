import nodemailer from 'nodemailer'
import 'dotenv/config'

const transporter = nodemailer.createTransport({
    host: process.env.NODEMAILER_SMTP_HOST,
    port: 465,
    secure: true,
    auth:{
        user: process.env.NODEMAILER_USERNAME,
        pass: process.env.NODEMAILER_PASS
    }
})

const sendEmail =  async (html, receiver) => {
    try {
        const result = await transporter.sendMail({
            from: 'customer.support@salesverse.org',
            to: receiver,
            html: html,
            subject: 'One Time Passcode - SalesVerse',
            attachments: [{
                filename: 'logo-png.png',
                path: './image-resources/logo-png.png',
                cid: 'logo'
            }]
    
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
            subject: subject,
            attachments: [{
                filename: 'logo-png.png',
                path: './image-resources/logo-png.png',
                cid: 'logobanner'
            }]   
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
// const html = "<img src=cid:logo style='min-width: 300px; height: 70px; object-fit: cover;' />"
// sendEmail(html, "neriwest20@gmail.com");

export {sendEmailAdjustable}
export default sendEmail

