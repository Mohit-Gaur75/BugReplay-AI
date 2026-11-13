import { ProjectsService } from './projects.service.js';
import { createProjectSchema, updateProjectSchema } from './projects.validation.js';
import { successResponse } from '../../utils/response.js';

export class ProjectsController {
  static create(req, res, next) {
    try {
      const validatedData = createProjectSchema.parse(req.body);
      const project = ProjectsService.createProject(req.user.id, req.user.plan_tier, validatedData);
      return successResponse(res, { project }, 'Project created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  static list(req, res, next) {
    try {
      const projects = ProjectsService.listProjects(req.user.id);
      return successResponse(res, { projects }, 'Projects retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  static getById(req, res, next) {
    try {
      const project = ProjectsService.getProjectById(req.user.id, req.params.id);
      return successResponse(res, { project }, 'Project retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  static update(req, res, next) {
    try {
      const validatedData = updateProjectSchema.parse(req.body);
      const project = ProjectsService.updateProject(req.user.id, req.params.id, validatedData);
      return successResponse(res, { project }, 'Project updated successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  static rotateKey(req, res, next) {
    try {
      const result = ProjectsService.rotateApiKey(req.user.id, req.params.id);
      return successResponse(res, result, 'API key rotated successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  static delete(req, res, next) {
    try {
      const result = ProjectsService.deleteProject(req.user.id, req.params.id);
      return successResponse(res, result, 'Project deleted successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  static async testWebhook(req, res, next) {
    try {
      const result = await ProjectsService.testWebhook(req.user.id, req.params.id);
      return successResponse(res, result, 'Test webhook dispatched', 200);
    } catch (err) {
      next(err);
    }
  }
}
