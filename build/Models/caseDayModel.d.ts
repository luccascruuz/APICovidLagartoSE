import mongoose from 'mongoose';
declare const _default: mongoose.Model<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    week_number?: number | undefined;
    date?: Date | undefined;
    uf_state?: string | undefined;
    city?: string | undefined;
    ibge_id?: string | undefined;
    new_deaths?: number | undefined;
    deaths?: number | undefined;
    new_cases?: number | undefined;
    total_cases?: number | undefined;
    deaths_per_100k_inhabitants?: number | undefined;
    totalCases_per_100k_inhabitants?: number | undefined;
    deaths_by_totalCases?: number | undefined;
}, {}, {}, {}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any>, {}, {}, {}, {}, mongoose.ResolveSchemaOptions<{
    timestamps: true;
}>, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    week_number?: number | undefined;
    date?: Date | undefined;
    uf_state?: string | undefined;
    city?: string | undefined;
    ibge_id?: string | undefined;
    new_deaths?: number | undefined;
    deaths?: number | undefined;
    new_cases?: number | undefined;
    total_cases?: number | undefined;
    deaths_per_100k_inhabitants?: number | undefined;
    totalCases_per_100k_inhabitants?: number | undefined;
    deaths_by_totalCases?: number | undefined;
}>>;
export default _default;
