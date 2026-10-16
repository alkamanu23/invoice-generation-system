import express from 'express';
import { AppError } from '../errors';
import { translateText } from '../services/translationService';
import { translateCreditNote } from '../services/translators/creditNoteTranslator';
import { findAdjustmentById } from './adjustmentNote';
import { translateDebitNote } from '../services/translators/debitNoteTranslator';
import { getInvoiceById } from './invoices';
import { translateInvoice } from '../services/translators/invoiceTranslator';
import { translateOrder } from '../services/translators/orderTranslator';
import { getOrderById } from './order';

const router = express.Router();

router.post('/translate', async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;

    if (!text || !targetLanguage) {
      return res.status(400).json({
        error: 'text and targetLanguage are required',
      });
    }

    const translatedText = await translateText(text, targetLanguage);

    return res.json({ translatedText });
  } catch (error) {
    console.error('Translation error:', error);
    return res.status(500).json({ error: 'Translation failed' });
  }
});

router.post('/api/creditNotes/:id/translate', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { targetLanguage } = req.body;

    if (isNaN(id) || id <= 0) {
      throw new AppError('INVALID_INPUT', 'Invalid credit note id.');
    }

    if (!targetLanguage) {
      throw new AppError('INVALID_INPUT', 'targetLanguage is required.');
    }

    const creditNote = await findAdjustmentById(id, 'credit');
    const translatedCreditNote = await translateCreditNote(creditNote, targetLanguage);

    return res.status(200).json(translatedCreditNote);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.code, message: err.message });
    }

    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
  }
});

router.post('/api/debitNotes/:id/translate', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { targetLanguage } = req.body;

    if (isNaN(id) || id <= 0) {
      throw new AppError('INVALID_INPUT', 'Invalid debit note id.');
    }

    if (!targetLanguage) {
      throw new AppError('INVALID_INPUT', 'targetLanguage is required.');
    }

    const debitNote = await findAdjustmentById(id, 'debit');
    const translatedDebitNote = await translateDebitNote(debitNote, targetLanguage);

    return res.status(200).json(translatedDebitNote);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.code, message: err.message });
    }

    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
  }
});

router.post('/api/invoices/:id/translate', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { targetLanguage } = req.body;

    if (isNaN(id) || id <= 0) {
      throw new AppError('INVALID_INPUT', 'Invalid invoice id.');
    }

    if (!targetLanguage) {
      throw new AppError('INVALID_INPUT', 'targetLanguage is required.');
    }

    const invoice = await getInvoiceById(id);
    const translatedInvoice = await translateInvoice(invoice, targetLanguage);

    return res.status(200).json(translatedInvoice);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.code, message: err.message });
    }

    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post('/api/orders/:id/translate', async (req, res) => {
  try {
    const id = req.params.id;
    const { targetLanguage } = req.body;

    if (!id) {
      throw new AppError('INVALID_INPUT', 'Invalid order id.');
    }

    if (!targetLanguage) {
      throw new AppError('INVALID_INPUT', 'targetLanguage is required.');
    }

    const order = await getOrderById(id);
    const translatedOrder = await translateOrder(order, targetLanguage);

    return res.status(200).json(translatedOrder);
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.code, message: err.message });
    }

    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
  }
});


export default router;