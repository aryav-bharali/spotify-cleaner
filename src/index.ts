import * as dotenv from 'dotenv'
import express from 'express'
dotenv.config()

const app = express()

app.listen(8888, () => console.log('Go To http://localhost:8888/login'))
