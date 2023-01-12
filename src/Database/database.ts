import mongoose from 'mongoose'

const connectDatabase = () => {
    console.log("Wait connecting to the database...")
    const mongo_uri = process.env.MONGO_URI || ''
    mongoose.set('strictQuery', false)


    mongoose.connect(mongo_uri)
        .then(() => console.log('MongoDB Connected!'))
        .catch((err) => console.log(`Error connecting to MongoDB Atlas: ${err}`))
}

export default connectDatabase;