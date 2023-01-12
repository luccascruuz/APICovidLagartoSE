import mongoose, { Schema } from 'mongoose'

const Vaccination = new Schema(
    {
        date: Date,
        state: String,
        city: String,
        ibgeID: Number,
        dose: Number,
        vaccine: String,
        sex: String,
        age: String,
        count: Number,
        pop2021: Number
    },
    { timestamps: true }
)

export default mongoose.model('Vaccination', Vaccination)