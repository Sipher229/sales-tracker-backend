import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth:{
        user: 'neriwest20@gmail.com',
        pass: 'dieb orac jwkt diqt'
    }
})

const sendEmail =  async (html, receiver) => {
    try {
        const result = await transporter.sendMail({
            from: 'salestracker@weedman.com <neriwest20@gmail.com',
            to: receiver,
            html: html,
            subject: 'One Time Passcode - Sales Tracker'
    
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
export default sendEmail

