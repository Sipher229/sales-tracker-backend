import {differenceInHours, differenceInMinutes} from 'date-fns'

const getCurrentDateTme = () => {
    return new Date().toLocaleString('sv-SE') 
}


const getDifferenceInMinutes = (laterDate, earlierDate) => {
    return differenceInMinutes(laterDate, earlierDate)
}

const getCurrentDate = () => {
    return new Intl.DateTimeFormat('en-CA').format(new Date())
}
console.log(getCurrentDate())
console.log(getCurrentDateTme())

export {getCurrentDateTme, differenceInHours, getCurrentDate, getDifferenceInMinutes}