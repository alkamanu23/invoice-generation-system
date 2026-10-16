// verifies auth
import { Request, Response, NextFunction } from "express";
import jwt, { JwtHeader, SigningKeyCallback, JwtPayload } from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true
});

function getKey(header: JwtHeader, callback: SigningKeyCallback): void {
  client.getSigningKey(header.kid!, (err: Error | null, key: jwksClient.SigningKey | undefined) => {
    if (err) return callback(err);
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export interface CognitoJwtPayload extends JwtPayload {
  email?: string;
  "cognito:groups"?: string[];
  "cognito:username"?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: CognitoJwtPayload;
    }
  }
}

export function cognitoAuth(req: Request, res: Response, next: NextFunction): void {

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header.' });
    return;
  }

  jwt.verify(
    token,
    getKey,
    {
      algorithms: ["RS256"],
      issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
    },
    (err: jwt.VerifyErrors | null, decoded: jwt.JwtPayload | string | undefined) => {

      if (err) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: err.message });
        return;
      }

      const payload = decoded as CognitoJwtPayload;

      if (payload.client_id !== process.env.COGNITO_APP_CLIENT_ID) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token client_id mismatch.' });
        return;
      }

      req.user = payload;

      next();
    }
  );
}