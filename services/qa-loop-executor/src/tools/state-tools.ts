import { createLogger } from '../../../shared/logger/logger';
import { QALoopRepository } from '../repositories/qa-loop-repository';
import { ToolResult } from '../tool-executor';
import { emitToSession } from '../api/websocket';

const logger = createLogger('state-tools');

export class StateTools {
  private sessionId: string;
  private repository: QALoopRepository;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.repository = new QALoopRepository();
  }

  async getSessionState(): Promise<ToolResult> {
    try {
      const session = await this.repository.getSession(this.sessionId);
      if (!session) {
        return { error: 'Session not found' };
      }

      const [exploredPages, unexploredPages, testCases, bugs] = await Promise.all([
        this.repository.getExploredPages(this.sessionId),
        this.repository.getUnexploredPages(this.sessionId),
        this.repository.getTestCases(this.sessionId),
        this.repository.getBugs(this.sessionId)
      ]);

      return {
        data: {
          session: {
            id: session.id,
            targetUrl: session.target_url,
            mode: session.mode,
            status: session.status,
            iterationCount: session.iteration_count,
            qualityScore: session.quality_score,
            qualityThreshold: session.quality_threshold
          },
          progress: {
            pagesExplored: exploredPages.length,
            pagesToExplore: unexploredPages.length,
            totalPagesDiscovered: exploredPages.length + unexploredPages.length,
            testsGenerated: testCases.length,
            bugsFound: bugs.length
          },
          summary: {
            exploredUrls: exploredPages.slice(0, 10).map(p => p.url),
            pendingUrls: unexploredPages.slice(0, 10).map(p => p.url),
            recentTests: testCases.slice(0, 5).map(t => t.name),
            openBugs: bugs.filter(b => b.status === 'open').length
          },
          existingTestCases: testCases.map(t => ({
            name: t.name,
            category: t.category,
            sourcePageUrl: t.source_page_url,
            status: t.last_run_status
          })),
          deduplicationWarning: testCases.length > 0
            ? `TEST CASES ALREADY GENERATED IN THIS SESSION (${testCases.length} total):\n` +
              testCases.map(t => `- "${t.name}" (${t.category}) — page: ${t.source_page_url || 'unknown'}`).join('\n') +
              '\n\nDO NOT generate duplicate test cases for pages/features already covered above. Focus on UNTESTED pages and features.'
            : undefined
        }
      };
    } catch (error: any) {
      logger.error('Failed to get session state', {
        sessionId: this.sessionId,
        error: error.message
      });
      return { error: `Failed to get session state: ${error.message}` };
    }
  }

  async getExploredPages(): Promise<ToolResult> {
    try {
      const pages = await this.repository.getExploredPages(this.sessionId);

      return {
        data: {
          count: pages.length,
          pages: pages.map(p => ({
            url: p.url,
            title: p.title,
            pageType: p.page_type,
            description: p.description,
            exploredAt: p.explored_at
          }))
        }
      };
    } catch (error: any) {
      logger.error('Failed to get explored pages', {
        sessionId: this.sessionId,
        error: error.message
      });
      return { error: `Failed to get explored pages: ${error.message}` };
    }
  }

  async getUnexploredPages(): Promise<ToolResult> {
    try {
      const pages = await this.repository.getUnexploredPages(this.sessionId);

      return {
        data: {
          count: pages.length,
          pages: pages.map(p => ({
            url: p.url,
            priority: p.priority,
            discoveredAt: p.created_at
          }))
        }
      };
    } catch (error: any) {
      logger.error('Failed to get unexplored pages', {
        sessionId: this.sessionId,
        error: error.message
      });
      return { error: `Failed to get unexplored pages: ${error.message}` };
    }
  }

  async getNotes(category?: string): Promise<ToolResult> {
    try {
      const notes = await this.repository.getNotes(this.sessionId, {
        category,
        resolved: false
      });

      return {
        data: {
          count: notes.length,
          notes: notes.map(n => ({
            note: n.note,
            category: n.category,
            pageUrl: n.page_url,
            iteration: n.iteration_number,
            createdAt: n.created_at
          }))
        }
      };
    } catch (error: any) {
      logger.error('Failed to get notes', {
        sessionId: this.sessionId,
        error: error.message
      });
      return { error: `Failed to get notes: ${error.message}` };
    }
  }

  async addNote(note: string, category?: string, pageUrl?: string): Promise<ToolResult> {
    try {
      const session = await this.repository.getSession(this.sessionId);

      const savedNote = await this.repository.addNote(this.sessionId, {
        note,
        category: category || 'general',
        iterationNumber: session?.iteration_count,
        pageUrl
      });

      logger.info('Note added', {
        sessionId: this.sessionId,
        noteId: savedNote.id,
        category
      });

      return {
        data: {
          success: true,
          noteId: savedNote.id,
          message: 'Note saved for future iterations'
        }
      };
    } catch (error: any) {
      logger.error('Failed to add note', {
        sessionId: this.sessionId,
        error: error.message
      });
      return { error: `Failed to add note: ${error.message}` };
    }
  }

  async addDiscoveredPage(url: string, priority?: number): Promise<ToolResult> {
    try {
      // Check if page already exists
      const existingPages = await this.repository.getPages(this.sessionId);
      const exists = existingPages.some(p => p.url === url);

      if (exists) {
        return {
          data: {
            success: true,
            alreadyExists: true,
            message: 'Page already in exploration queue'
          }
        };
      }

      const page = await this.repository.addPage(this.sessionId, {
        url,
        priority: priority || 50
      });

      // Emit event for UI update
      emitToSession(this.sessionId, {
        type: 'page_discovered',
        data: { url, priority }
      });

      logger.info('Page discovered', {
        sessionId: this.sessionId,
        url,
        priority
      });

      // Update session progress
      const session = await this.repository.getSession(this.sessionId);
      if (session) {
        const allPages = await this.repository.getPages(this.sessionId);
        await this.repository.updateSessionProgress(this.sessionId, {
          pagesExplored: allPages.filter(p => p.is_explored).length
        });
      }

      return {
        data: {
          success: true,
          pageId: page.id,
          message: `Page added to exploration queue with priority ${priority || 50}`
        }
      };
    } catch (error: any) {
      logger.error('Failed to add discovered page', {
        sessionId: this.sessionId,
        url,
        error: error.message
      });
      return { error: `Failed to add discovered page: ${error.message}` };
    }
  }

  async markPageExplored(
    url: string,
    description?: string,
    pageType?: string,
    loadTimeMs?: number
  ): Promise<ToolResult> {
    try {
      // Ensure page exists
      await this.repository.addPage(this.sessionId, { url });

      // Store real load time in discovered_elements so the Guardian can use it for performance scoring
      const discoveredElements = loadTimeMs !== undefined ? { loadTimeMs } : undefined;

      // Mark as explored
      await this.repository.markPageExplored(this.sessionId, url, {
        description,
        pageType,
        discoveredElements
      });

      // Emit event for UI update
      emitToSession(this.sessionId, {
        type: 'page_explored',
        data: { url, description, pageType }
      });

      // Update session progress
      const exploredPages = await this.repository.getExploredPages(this.sessionId);
      await this.repository.updateSessionProgress(this.sessionId, {
        pagesExplored: exploredPages.length
      });

      logger.info('Page marked as explored', {
        sessionId: this.sessionId,
        url
      });

      return {
        data: {
          success: true,
          message: `Page ${url} marked as explored`
        },
        metrics: {
          pageExplored: true
        }
      };
    } catch (error: any) {
      logger.error('Failed to mark page explored', {
        sessionId: this.sessionId,
        url,
        error: error.message
      });
      return { error: `Failed to mark page explored: ${error.message}` };
    }
  }
}
