import {differenceInHours, differenceInMinutes} from 'date-fns'
import {format, toZonedTime} from 'date-fns-tz'

const getCurrentDateTme = (timeZone) => {
    // return new Date().toLocaleString('sv-SE') 
    const now = new Date();
    const zonedDate = toZonedTime(now, timeZone);
    return format(zonedDate, 'yyyy-MM-dd HH:mm:ss', { timeZone });

}


const getDifferenceInMinutes = (laterDate, earlierDate) => {
    return differenceInMinutes(laterDate, earlierDate)
}

const getCurrentDate = (timeZone) => {
    // return new Intl.DateTimeFormat('en-CA').format(new Date())
    const now = new Date();
    const zonedDate = toZonedTime(now, timeZone);
    return format(zonedDate, 'yyyy-MM-dd', { timeZone });

}
console.log(getCurrentDate('America/Toronto'))
console.log(getCurrentDateTme('America/Toronto'))

export {getCurrentDateTme, differenceInHours, getCurrentDate, getDifferenceInMinutes}