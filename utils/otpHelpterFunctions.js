export const generateOtp = () => {
    const length = 6
    let otp = ''

    for(let i = 0; i <length; i++) {
        const randomNumber = Math.floor(Math.random() * 9)
        otp += randomNumber
    }
    return otp
}

export const verifyOtpExists = async (id, tz) => {
    const qry = 
    'SELECT * FROM otps WHERE id = $1'
    const validFor = 30

    try{
        const response = await db.query(qry, [id])

        if (response.rows !== 0){
            const createdAt = response.rows[0].created_at
            const currentTime = getCurrentDateTme(tz)
            const timeDifference = differenceInHours(currentTime, createdAt)

            if (timeDifference > validFor) {
                
                return false
            }
            return true
        }
        else{
            return false
        }
    }
    catch(error){
        return false
    }
}
