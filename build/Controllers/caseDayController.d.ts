import { Request, Response } from 'express';
declare const CaseDay: {
    index(req: Request, res: Response): Promise<Response>;
    addCaseDay(req: Request, res: Response): Promise<Response>;
};
export default CaseDay;
