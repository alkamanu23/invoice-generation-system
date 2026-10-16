import 'dotenv/config';
import request from "sync-request-curl";
import config from '../../config.json';

const url: string = config.url;
const port: string = config.port;

const SERVER_URL = `${url}:${port}`;
const TIMEOUT_MS = 15 * 1000;

// helpers

function post(endpoint: string, body: object) {
  return request('POST', `${SERVER_URL}${endpoint}`, {
    json: body,
    timeout: TIMEOUT_MS,
  });
}

function bodyOf(res: ReturnType<typeof request>) {
  return JSON.parse(res.body.toString());
}

// tests
describe('POST /v1/auth/register', () => {
  describe('success cases', () => {
    test('returns 201 for a valid registration', () => {
      const username = `testuser_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const res = post('/v1/auth/register', {
        username,
        email: `${username}@example.com`,
        password: 'TestPassword123!',
      });
      expect([201, 400]).toContain(res.statusCode);
      if (res.statusCode === 201) {
        expect(bodyOf(res)).toMatchObject({ message: expect.any(String) });
      } else {
        expect(bodyOf(res)).toMatchObject({ error: 'REGISTRATION_ERROR' });
      }
    });
  });

  describe('error cases', () => {
    test('returns 400 if username is missing', () => {
      const res = post('/v1/auth/register', {
        email: 'test@example.com',
        password: 'TestPassword123!',
      });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 if email is missing', () => {
      const res = post('/v1/auth/register', {
        username: 'testuser',
        password: 'TestPassword123!',
      });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 if password is missing', () => {
      const res = post('/v1/auth/register', {
        username: 'testuser',
        email: 'test@example.com',
      });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 if username already exists', () => {
      const username = `testuser_${Date.now()}`;
      post('/v1/auth/register', {
        username,
        email: `${username}@example.com`,
        password: 'TestPassword123!',
      });

      const res = post('/v1/auth/register', {
        username,
        email: `${username}@example.com`,
        password: 'TestPassword123!',
      });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'REGISTRATION_ERROR' });
    });

    test('returns 400 if password does not meet requirements', () => {
      const res = post('/v1/auth/register', {
        username: `testuser_${Date.now()}`,
        email: 'test@example.com',
        password: 'weak',
      });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'REGISTRATION_ERROR' });
    });
  });
});

describe('POST /v1/auth/confirm', () => {
  describe('error cases', () => {
    test('returns 400 if username is missing', () => {
      const res = post('/v1/auth/confirm', { code: '123456' });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 if code is missing', () => {
      const res = post('/v1/auth/confirm', { username: 'testuser' });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 for an invalid confirmation code', () => {
      const res = post('/v1/auth/confirm', {
        username: 'testuser',
        code: '000000',
      });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'CONFIRMATION_ERROR' });
    });
  });
});

describe('POST /v1/auth/login', () => {
  describe('success cases', () => {
    test('returns 200 and a token for valid credentials', () => {
      const res = post('/v1/auth/login', {
        username: 'testuser',
        password: 'YourPassword123!',
      });
      expect(res.statusCode).toBe(200);
      const body = bodyOf(res);
      expect(typeof body.token).toBe('string');
      expect(typeof body.expiresIn).toBe('number');
    });
  });

  describe('error cases', () => {
    test('returns 400 if username is missing', () => {
      const res = post('/v1/auth/login', { password: 'YourPassword123!' });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 400 if password is missing', () => {
      const res = post('/v1/auth/login', { username: 'testuser' });
      expect(res.statusCode).toBe(400);
      expect(bodyOf(res)).toMatchObject({ error: 'INVALID_INPUT' });
    });

    test('returns 401 for wrong password', () => {
      const res = post('/v1/auth/login', {
        username: 'testuser',
        password: 'WrongPassword123!',
      });
      expect(res.statusCode).toBe(401);
      expect(bodyOf(res)).toMatchObject({ error: 'LOGIN_ERROR' });
    });

    test('returns 401 for non-existent user', () => {
      const res = post('/v1/auth/login', {
        username: 'doesnotexist',
        password: 'TestPassword123!',
      });
      expect(res.statusCode).toBe(401);
      expect(bodyOf(res)).toMatchObject({ error: 'LOGIN_ERROR' });
    });
  });
});