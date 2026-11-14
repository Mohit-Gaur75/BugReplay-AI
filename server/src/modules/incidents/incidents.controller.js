import { IncidentsService } from './incidents.service.js';
import { sseService } from './sse.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';

export class IncidentsController {
  static list(req, res, next) {
    try {
      const { projectId, status, search, page, limit } = req.query;
      const result = IncidentsService.listIncidents(req.user.id, {
        projectId,
        status,
        search,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });
      return successResponse(res, result, 'Incidents retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  static getById(req, res, next) {
    try {
      const incident = IncidentsService.getIncidentById(req.user.id, req.params.id);
      return successResponse(res, { incident }, 'Incident details retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  static updateStatus(req, res, next) {
    try {
      const { status } = req.body;
      const incident = IncidentsService.updateStatus(req.user.id, req.params.id, status);
      return successResponse(res, { incident }, 'Incident status updated successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  static regenerate(req, res, next) {
    try {
      const result = IncidentsService.regenerate(req.user.id, req.params.id);
      return successResponse(res, result, 'AI Playwright generation re-enqueued', 202);
    } catch (err) {
      next(err);
    }
  }

  static getTestFile(req, res, next) {
    try {
      const incident = IncidentsService.getIncidentById(req.user.id, req.params.id);
      const testContent = incident.generated_playwright_test || `// Test pending generation or unavailable\nconsole.log('No test generated yet');`;

      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="bug-replay-${incident.id.slice(0, 8)}.spec.js"`);
      return res.send(testContent);
    } catch (err) {
      next(err);
    }
  }

  static delete(req, res, next) {
    try {
      const result = IncidentsService.deleteIncident(req.user.id, req.params.id);
      return successResponse(res, result, 'Incident deleted successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  static async createPR(req, res, next) {
    try {
      const { repo, token, baseBranch } = req.body || {};
      const result = await IncidentsService.createGitHubPR(req.user.id, req.params.id, { repo, token, baseBranch });
      return successResponse(res, result, 'GitHub Pull Request created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  static async runTest(req, res, next) {
    try {
      const result = await IncidentsService.runTest(req.user.id, req.params.id, req.body || {});
      return successResponse(res, result, 'Playwright test executed successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  static getTestRuns(req, res, next) {
    try {
      const testRuns = IncidentsService.getTestRuns(req.user.id, req.params.id);
      return successResponse(res, { testRuns }, 'Incident test runs retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  static getLatestTestRun(req, res, next) {
    try {
      const testRun = IncidentsService.getLatestTestRun(req.user.id, req.params.id);
      return successResponse(res, { testRun }, 'Latest incident test run retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  static stream(req, res, next) {
    try {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      sseService.addClient(req.user.id, res);
    } catch (err) {
      next(err);
    }
  }
}
