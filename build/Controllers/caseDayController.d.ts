import { Request, Response } from 'express';
declare const CaseDay: {
    index(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    totalCasesAndDeaths(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    lastSevenDays(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    movingAverageOfCases(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    addCaseDay(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
};
export default CaseDay;
