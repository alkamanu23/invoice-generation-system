import request from "sync-request-curl";
import config from '../../config.json';
 
const url: string = config.url;
const port: string = config.port;
 
const SERVER_URL = `${url}:${port}`;
const TIMEOUT_MS = 5 * 1000;

describe("GET /v1/health", () => {
  test("returns service health status", () => {
    const res = request("GET", `${SERVER_URL}/v1/health`);
 
    expect(res.statusCode).toBe(200);
 
    const body = JSON.parse(res.body.toString());
 
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
    expect(typeof body.timestamp).toBe("string");
  });
});