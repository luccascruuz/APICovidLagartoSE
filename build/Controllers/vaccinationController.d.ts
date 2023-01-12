import { Request, Response } from "express";
declare const Vaccination: {
    index(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    totalDosesApplied(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    addVaccination(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
};
export default Vaccination;
