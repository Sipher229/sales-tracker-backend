import pg from 'pg'
import 'dotenv/config'

const db = new pg.Client({
    user: "postgres",
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: 5432
})

db.connect().then(() => {
    console.log('Connected to DB successfully!')
}).catch((err) => {
    console.log('Unable to connect to DB :(. Message:' + err.message)
})

export default db