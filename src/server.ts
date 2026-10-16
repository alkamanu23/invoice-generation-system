import 'dotenv/config';
// server imports
import express, { json, Request, Response } from 'express';
import cors from 'cors';
import YAML from 'yaml';
import config from './config.json';
import fs from 'fs';
import sui from 'swagger-ui-express';
import path from 'path';
import { cognitoAuth } from "./middleware/cognito";
import { requireGroup } from "./middleware/requireGroup";
import translationRouter from './routes/translation';

// auth imports
import { register, confirm, login } from './middleware/auth';

// database imports
import pool from './db/db';
import { initDb, clearTables } from './db/setup';

// invoices
import { deleteInvoice, generateInvoice, getInvoiceById, getInvoices } from './routes/invoices'
import { invoiceToPdf } from './utils/invoicePdf'

// application response
import { generateAppResponse, getAppResponses, getAppResponseById } from './routes/appResponse'

// conversions
import { jsonToXml, xmlToJson } from './routes/convert';

// adjustment note
import { createAdjustmentNote, findAdjustments, findAdjustmentById } from "./routes/adjustmentNote";

// filter
import { filterInvoices } from './routes/invoiceFilter';
import { filterAppResponses } from './routes/appResponseFilter';
import { filterAdjustmentNotes } from './routes/adjustmentNoteFilter';

//search
import { searchInvoices } from './routes/invoiceSearch';
import { searchAdjustmentNotes } from './routes/adjustmentNoteSearch';
import { searchAppResponses } from './routes/appResponseSearch';

//peppol
import { generatePeppolInvoice } from './peppol/invoiceWrapper';

// errors
import { AppError } from './errors';

if (process.env.GOOGLE_CREDENTIALS_BASE64) {
  const fs = require('fs');
  const credPath = '/tmp/credentials.json';
  fs.writeFileSync(credPath, Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64'));
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
}

// setup web app
export const app = express();

// middleware
app.use(cors());
app.use(express.json());
app.use("/v1/api", cognitoAuth);
app.use("/v2/api", cognitoAuth);
app.use("/v3/api", cognitoAuth);

app.get("/api/admin", requireGroup("admins"), (req, res) => {
  res.json({ message: "Admin access granted" });
});

// swagger generation
const file = fs.readFileSync(path.join(process.cwd(), 'swagger.yaml'), 'utf8');
app.get('/', (req: Request, res: Response) => res.redirect('/docs'));
app.use(
  '/docs',
  sui.serve,
  sui.setup(YAML.parse(file),
    { swaggerOptions: { docExpansion: config.expandDocs ? 'full' : 'list' } }
  ));


const PORT: number = parseInt(process.env.PORT || config.port);
const HOST: string = process.env.HOST || '0.0.0.0';

// ===================================================================
// TEMP INTERFACES
// ===================================================================

// ===================================================================
// ROUTES
//====================================================================

// example request
app.get("/hello", (req: Request, res: Response) => {
  res.json({ message: "hello world" });
});

// auth
app.post('/v1/auth/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;
    const result = await register(username, email, password);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(400).json({ error: err.code, message: err.message });
    } else {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
    }
  }
});

app.post('/v1/auth/confirm', async (req: Request, res: Response) => {
  try {
    const { username, code } = req.body;
    const result = await confirm(username, code);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(400).json({ error: err.code, message: err.message });
    } else {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
    }
  }
});

app.post('/v1/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const result = await login(username, password);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'INVALID_INPUT' ? 400 : 401;
      res.status(status).json({ error: err.code, message: err.message });
    } else {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
    }
  }
});

// conversions
app.post("/v1/convert/xml-to-json", (req: Request, res: Response) => {
  try {
    const result = xmlToJson(req.body?.xml);
    res.status(200).json(result);
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'error' in err) {
      res.status(400).json(err);
    } else {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected internal error occurred.' });
    }
  }
});

app.post('/v1/convert/json-to-xml', (req: Request, res: Response) => {
  try {
    const result = jsonToXml(req.body?.json);
    res.status(200).type('application/xml').send(result);
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'error' in err) {
      res.status(400).json(err);
    } else {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected internal error occurred.' });
    }
  }
});

// invoice routes
app.post('/v1/api/invoices', async (req: Request, res: Response) => {
  try {
    const createdBy = (req as any).user?.username;
    const invoice = await generateInvoice(req.body, createdBy);
    return res.status(200).json(invoice);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      res.status(status).json({ error: err.code, message: err.message });
    } else {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
    }
  }
});

app.get('/v1/api/invoices', async (req: Request, res: Response) => {
  try {
    const createdBy = (req as any).user?.username;
    const invoices = await getInvoices(createdBy);
    return res.status(200).json(invoices);
  } catch (err) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
  }
});

app.get('/v1/api/invoices/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid invoice id' });
    }
    const invoice = await getInvoiceById(id);
    return res.status(200).json(invoice);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      res.status(status).json({ error: err.code, message: err.message });
    } else {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
    }
  }
});

app.get('/v1/api/invoices/:id/pdf', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid invoice id' });
    }
    const invoice = await getInvoiceById(id);
    const pdf = await invoiceToPdf(invoice);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`);
    return res.send(pdf);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.code, message: err.message });
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
  }
});

app.delete('/v3/api/invoices/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid invoice id' });
    }
    const createdBy = (req as any).user?.username;
    await deleteInvoice(id, createdBy);
    return res.status(200).json({ message: 'Invoice deleted successfully' });
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 400;
      return res.status(status).json({ error: err.code, message: err.message });
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
  }
});

// app response routes
app.post('/v1/api/appResponses', async (req: Request, res: Response) => {
  try {
    const createdBy = (req as any).user?.username;
    const result = await generateAppResponse(req.body, createdBy);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      res.status(status).json({ error: err.code, message: err.message });
    } else {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
    }
  }
});

app.get('/v1/api/appResponses', async (req: Request, res: Response) => {
  try {
    const createdBy = (req as any).user?.username;
    const result = await getAppResponses(createdBy);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      res.status(status).json({ error: err.code, message: err.message });
    } else {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
    }
  }
});

app.get('/v1/api/appResponses/:responseId', async (req: Request, res: Response) => {
  try {
    const { responseId } = req.params;
    if (typeof responseId !== 'string') {
      return res.status(400).json({ error: 'Invalid responseId' });
    }
    const result = await getAppResponseById(responseId);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      res.status(status).json({ error: err.code, message: err.message });
    } else {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
    }
  }
});

// adjustment notes
app.post("/v1/api/adjNotes", async (req: Request, res: Response) => {
  try {
    const createdBy = (req as any).user?.username;
    const result = await createAdjustmentNote(req.body, createdBy);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      res.status(status).json({ error: err.code, message: err.message });
    } else {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
    }
  }
});

app.get("/v1/api/adjNotes", async (req: Request, res: Response) => {
  try {
    const createdBy = (req as any).user?.username;
    const data = await findAdjustments(createdBy);
    res.status(200).json(data);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      res.status(status).json({ error: err.code, message: err.message });
    } else {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
    }
  }
});

app.get("/v1/api/adjNotes/:adjNoteId", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.adjNoteId as string, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid adjustment note ID.' });
    }

    const type = req.query.type as 'credit' | 'debit';
    if (!type || !['credit', 'debit'].includes(type)) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: "Type must be 'credit' or 'debit'." });
    }

    const data = await findAdjustmentById(id, type);
    res.status(200).json(data);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      res.status(status).json({ error: err.code, message: err.message });
    } else {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
    }
  }
});

// health check
// could add database connection status verification
app.get("/v1/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// filter
app.get('/v2/api/invoices/filter', async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.invoiceID) filters.invoiceID = req.query.invoiceID as string;
    if (req.query.supplierId) filters.supplierId = req.query.supplierId as string;
    if (req.query.customerId) filters.customerId = req.query.customerId as string;
    if (req.query.fromDate) filters.fromDate = req.query.fromDate as string;
    if (req.query.toDate) filters.toDate = req.query.toDate as string;

    const createdBy = (req as any).user?.username;
    const result = await filterInvoices(filters, createdBy);

    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.code, message: err.message });
    }
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.'
    });
  }
});

app.get('/v2/api/appResponses/filter', async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.responseCode) filters.responseCode = req.query.responseCode as string;
    if (req.query.invoiceId) filters.invoiceId = req.query.invoiceId as string;
    if (req.query.senderId) filters.senderId = req.query.senderId as string;
    if (req.query.receiverId) filters.receiverId = req.query.receiverId as string;
    if (req.query.fromDate) filters.fromDate = req.query.fromDate as string;
    if (req.query.toDate) filters.toDate = req.query.toDate as string;

    const createdBy = (req as any).user?.username;
    const result = await filterAppResponses(filters, createdBy);

    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.code, message: err.message });
    }
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.'
    });
  }
});

app.get('/v2/api/adjNotes/filter', async (req: Request, res: Response) => {
  try {
    const params: any = {};
    if (req.query.type) params.type = req.query.type as string;
    if (req.query.fromDate) params.fromDate = req.query.fromDate as string;
    if (req.query.toDate) params.toDate = req.query.toDate as string;

    const createdBy = (req as any).user?.username;
    const result = await filterAdjustmentNotes(params, createdBy);

    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.code, message: err.message });
    } else {
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.'
      });
    }
  }
});

//search
app.get('/v2/api/invoices/search', async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.query !== undefined) {
      filters.query = req.query.query as string;
    }

    const createdBy = (req as any).user?.username;
    const result = await searchInvoices(filters, createdBy);

    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(400).json({
        error: err.code,
        message: err.message,
      });
    }

    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
  }
});

app.get('/v2/api/adjNotes/search', async (req: Request, res: Response) => {
  try {
    const params: any = {};
    if (req.query.query !== undefined) params.query = req.query.query as string;

    const createdBy = (req as any).user?.username;
    const result = await searchAdjustmentNotes(params, createdBy);

    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.code, message: err.message });
    } else {
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.'
      });
    }
  }
});

app.get('/v2/api/appResponses/search', async (req: Request, res: Response) => {
  try {
    const params: any = {};
    if (req.query.query !== undefined) params.query = req.query.query as string;
    const createdBy = (req as any).user?.username;
    const result = await searchAppResponses(params, createdBy);

    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.code, message: err.message });
    } else {
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.'
      });
    }
  }
});

// peppol converter (invoice)
app.post('/v2/api/invoices', async (req: Request, res: Response) => {
  try {
    const result = await generatePeppolInvoice(req.body);
    res.set('Content-Type', 'application/xml');
    return res.status(200).send(result.output);

  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'PEPPOL_VALIDATION_FAILED' ? 422 : 400;
      return res.status(status).json({
        error: err.code,
        message: err.message
      });
    } else {
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.'
      });
    }
  }
});

//translation
app.use('/v2', translationRouter);

app.get('/v3/api/stats', async (req: Request, res: Response) => {
  try {
    const createdBy = (req as any).user?.username;

    const [invoiceCount, creditCount, debitCount, appResponseCount] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM invoices WHERE created_by = $1`, [createdBy]),
      pool.query(`SELECT COUNT(*) FROM credit_note WHERE created_by = $1`, [createdBy]),
      pool.query(`SELECT COUNT(*) FROM debit_note WHERE created_by = $1`, [createdBy]),
      pool.query(`SELECT COUNT(*) FROM application_responses WHERE created_by = $1`, [createdBy]),
    ]);

    return res.status(200).json({
      invoices: parseInt(invoiceCount.rows[0].count),
      creditNotes: parseInt(creditCount.rows[0].count),
      debitNotes: parseInt(debitCount.rows[0].count),
      appResponses: parseInt(appResponseCount.rows[0].count),
      adjustmentNotes: parseInt(creditCount.rows[0].count) + parseInt(debitCount.rows[0].count),
    });
  } catch (err) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
  }
});
// ===================================================================
// ROUTES ABOVE THIS LINE
// ===================================================================

app.use((req: Request, res: Response) => {
  const message = `
    Route not found - This could be because:
      0. You have defined routes below (not above) this middleware in server.ts
      1. You have not implemented the route ${req.method} ${req.path}
      2. There is a typo in either your test or server, e.g. /posts/list in one
         and, incorrectly, /post/list in the other
      3. You are using 'npm start' (instead of 'npm run dev') to start your server and
         have forgotten to manually restart to load the new changes
      4. You've forgotten a leading slash (/), e.g. you have posts/list instead
         of /posts/list in your server.ts or test file
  `;

  res.status(404).json({ error: 'ROUTE_NOT_FOUND', message });
});

async function start() {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully.');

    // await clearTables();
    // console.log('⚠️ Database tables cleared (Fresh Start).');

    await initDb();
    console.log('✅ Database tables initialized.');

    const server = app.listen(PORT, HOST, () => {
      console.log(`⚡️ Server started on port ${PORT} at ${HOST}`);
      console.log(`🔗 Local URL: http://${HOST}:${PORT}`);
    });

    let isShuttingDown = false;

    process.on('SIGINT', async () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      await pool.end();
      server.close(() => {
        console.log('Shutting down server gracefully.');
        process.exit(0);
      });
    });

  } catch (err) {
    console.error('❌ Failed to start server:');
    if (err instanceof AppError) {
      console.error(`[${err.code}] ${err.message}`);
    } else if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}
