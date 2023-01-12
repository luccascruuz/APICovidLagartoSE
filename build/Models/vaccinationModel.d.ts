import mongoose from 'mongoose';
declare const _default: mongoose.Model<{
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    date?: Date | undefined;
    city?: string | undefined;
    count?: number | undefined;
    state?: string | undefined;
    ibgeID?: number | undefined;
    dose?: number | undefined;
    vaccine?: string | undefined;
    sex?: string | undefined;
    age?: string | undefined;
    pop2021?: number | undefined;
}, {}, {}, {}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any>, {}, {}, {}, {}, mongoose.ResolveSchemaOptions<{
    timestamps: true;
}>, {
    createdAt: NativeDate;
    updatedAt: NativeDate;
} & {
    date?: Date | undefined;
    city?: string | undefined;
    count?: number | undefined;
    state?: string | undefined;
    ibgeID?: number | undefined;
    dose?: number | undefined;
    vaccine?: string | undefined;
    sex?: string | undefined;
    age?: string | undefined;
    pop2021?: number | undefined;
}>>;
export default _default;
