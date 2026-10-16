import { cognitoAuth, CognitoJwtPayload } from "../../middleware/cognito";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

jest.mock("jwks-rsa", () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    getSigningKey: jest.fn(),
  }),
}));

jest.mock("jsonwebtoken");

describe("cognitoAuth middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    process.env.COGNITO_APP_CLIENT_ID = 'test-client-id';
  });

  describe('success cases', () => {
    test('calls next and attaches user to req when token is valid', () => {
      req.headers = { authorization: 'Bearer validtoken' };

      const payload: CognitoJwtPayload = {
        client_id: 'test-client-id',
        email: 'user@example.com',
        'cognito:username': 'testuser',
        'cognito:groups': ['admins'],
      };

      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _options, callback) => {
        callback(null, payload);
      });

      cognitoAuth(req as Request, res as Response, next);

      expect(req.user).toEqual(payload);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('error cases', () => {
    test('returns 401 if Authorization header is missing', () => {
      cognitoAuth(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing Authorization header' });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 if Authorization header has no Bearer prefix', () => {
      req.headers = { authorization: 'validtoken' };

      cognitoAuth(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 if token verification fails', () => {
      req.headers = { authorization: 'Bearer faketoken' };

      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _options, callback) => {
        callback(new Error('Invalid token'), null);
      });

      cognitoAuth(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'UNAUTHORIZED' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 if client_id does not match', () => {
      req.headers = { authorization: 'Bearer validtoken' };

      const payload: CognitoJwtPayload = {
        client_id: 'wrong-client-id',
      };

      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _options, callback) => {
        callback(null, payload);
      });

      cognitoAuth(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'UNAUTHORIZED' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 if token is missing after Bearer prefix', () => {
      req.headers = { authorization: 'Bearer ' };

      cognitoAuth(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});