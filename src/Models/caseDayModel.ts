import mongoose, { Schema } from 'mongoose'

const CaseDay = new Schema(
    {
        week_number: Number,
        date: Date,
        uf_state: String,
        city: String,
        ibge_id: String,
        new_deaths: Number,
        deaths: Number,
        new_cases: Number,
        total_cases: Number,
        deaths_per_100k_inhabitants: Number,
        totalCases_per_100k_inhabitants: Number,
        deaths_by_totalCases: Number
    },
    { timestamps: true }
)

export default mongoose.model('CaseDay', CaseDay)