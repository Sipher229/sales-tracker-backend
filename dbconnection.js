import pg from 'pg'
import 'dotenv/config'

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: 5432
})

db.connect()

export default db