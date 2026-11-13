import { IncidentsService } from './incidents.service.js';
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
}
