import 'dotenv/config';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  ConfirmSignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { AppError } from '../errors';

const cognito = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION ?? 'ap-southeast-2',
});

export async function register(username: string, email: string, password: string): Promise<{ message: string }> {
  if (!username) throw new AppError('INVALID_INPUT', 'username is required.');
  if (!email) throw new AppError('INVALID_INPUT', 'email is required.');
  if (!password) throw new AppError('INVALID_INPUT', 'password is required.');

  try {
    await cognito.send(new SignUpCommand({
      ClientId: process.env.COGNITO_APP_CLIENT_ID,
      Username: username,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: username },
      ],
    }));

    return { message: 'Registration successful. Please check your email to confirm your account.' };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('REGISTRATION_ERROR', err instanceof Error ? err.message : 'Registration failed.');
  }
}

export async function confirm(username: string, code: string): Promise<{ message: string }> {
  if (!username) throw new AppError('INVALID_INPUT', 'username is required.');
  if (!code) throw new AppError('INVALID_INPUT', 'confirmation code is required.');

  try {
    await cognito.send(new ConfirmSignUpCommand({
      ClientId: process.env.COGNITO_APP_CLIENT_ID,
      Username: username,
      ConfirmationCode: code,
    }));

    return { message: 'Account confirmed. You can now log in.' };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('CONFIRMATION_ERROR', err instanceof Error ? err.message : 'Confirmation failed.');
  }
}

export async function login(username: string, password: string): Promise<{ token: string; expiresIn: number }> {
  if (!username) throw new AppError('INVALID_INPUT', 'username is required.');
  if (!password) throw new AppError('INVALID_INPUT', 'password is required.');

  try {
    const response = await cognito.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.COGNITO_APP_CLIENT_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    }));

    const token = response.AuthenticationResult?.AccessToken;
    const expiresIn = response.AuthenticationResult?.ExpiresIn;

    if (!token || !expiresIn) {
      throw new AppError('LOGIN_ERROR', 'Authentication succeeded but no token was returned.');
    }

    return { token, expiresIn };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('LOGIN_ERROR', err instanceof Error ? err.message : 'Login failed.');
  }
}