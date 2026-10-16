import { Request, Response, NextFunction } from "express";

export function requireGroup(group: string) {

  return (req: Request, res: Response, next: NextFunction): void => {

    const groups = req.user?.["cognito:groups"] ?? [];

    if (!groups.includes(group)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  };

}