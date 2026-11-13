import { Router } from 'express';
import { IngestionController } from './ingestion.controller.js';
import { requireApiKey } from '../../middleware/apiKey.js';

const router = Router();

// Ingestion endpoint requires valid project API key
router.post('/', requireApiKey, IngestionController.ingest);

export default router;
