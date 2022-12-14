import express from 'express'
import router from './routes'
import connectDatabase from './database/database'
import dotenv from 'dotenv'

dotenv.config();

const app = express();
app.use(express.json());
app.use(router);

connectDatabase();

app.listen(3333);