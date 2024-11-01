import {differenceInHours} from 'date-fns'

const getCurrentDateTme = () => {
    return new Date().toLocaleString('sv-SE') 
}

const getDifferenceInHours = (laterDate, earlierDate ) =>  {
    return differenceInHours(laterDate, earlierDate)
}

const getCurrentDate = () => {
    return new Intl.DateTimeFormat('en-CA').format(new Date())
}


export {getCurrentDateTme, differenceInHours, getCurrentDate}