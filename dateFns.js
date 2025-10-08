import {differenceInHours, differenceInMinutes, parse} from 'date-fns'
import {format, toZonedTime} from 'date-fns-tz'

const getCurrentDateTme = (timeZone='America/Toronto') => {
    // return new Date().toLocaleString('sv-SE') 
    const now = new Date();
    const zonedDate = toZonedTime(now, timeZone);
    return format(zonedDate, 'yyyy-MM-dd HH:mm:ss', { timeZone });

}

const getFormatedDate = (date) => {
    const formatString = 'yyyy-MM-dd HH:mm:ss';
    return format(date, formatString);
}
const getDifferenceInHours = (laterDate, earlierDate) => {
    const formatString = 'yyyy-MM-dd HH:mm:ss';
    const later = parse(laterDate, formatString, new Date());
    const earlier = parse(earlierDate, formatString, new Date());
    return differenceInHours(later, earlier);
}

const getDifferenceInMinutes = (laterDate, earlierDate) => {
    const formatString = 'yyyy-MM-dd HH:mm:ss';
    const later = parse(laterDate, formatString, new Date());
    const earlier = parse(earlierDate, formatString, new Date());
    return differenceInMinutes(later, earlier);
}

const getCurrentDate = (timeZone='America/Toronto') => {
    // return new Intl.DateTimeFormat('en-CA').format(new Date())
    const now = new Date();
    const zonedDate = toZonedTime(now, timeZone);
    return format(zonedDate, 'yyyy-MM-dd', { timeZone });

}
// console.log(getCurrentDate('America/Toronto'))
// console.log(getCurrentDateTme('America/Toronto'))

export {getCurrentDateTme, getDifferenceInHours, getCurrentDate, getDifferenceInMinutes, getFormatedDate}