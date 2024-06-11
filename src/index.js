import { app } from "./app.js";
import connectDB from './db/dbConnect.js'
import dotenv from 'dotenv'

const port = 4000 || process.env.PORT;

dotenv.config({
    path: './.env'
})

connectDB()
.then(() => {
    app.listen(port,()=>{
        console.log(`server is listening on http://localhost:${port}`)
    })
})
.catch((err) => {
    console.log("MONGO db connection failed !!! ", err);
})