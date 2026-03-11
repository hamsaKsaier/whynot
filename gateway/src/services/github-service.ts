import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('github-service');

interface TreeItem {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
}

interface FileContent {
  path: string;
  content: string;
  sha: string;
  encoding: string;
}

export class GitHubService {
  private token: string;
  private owner: string;
  private repo: string;
  private baseUrl = 'https://api.github.com';

  constructor(token: string, owner: string, repo: string) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error ${response.status}: ${errorText}`);
    }

    // Handle 204 No Content
    if (response.status === 204) return null;

    return response.json();
  }

  /**
   * Get the full file tree of the repository
   */
  async getRepoTree(branch?: string): Promise<TreeItem[]> {
    const ref = branch || 'main';
    try {
      const data = await this.request(`/repos/${this.owner}/${this.repo}/git/trees/${ref}?recursive=1`);
      return (data.tree || []).filter((item: any) => item.type === 'blob');
    } catch (error: any) {
      // Try 'master' if 'main' fails
      if (!branch && error.message.includes('404')) {
        const data = await this.request(`/repos/${this.owner}/${this.repo}/git/trees/master?recursive=1`);
        return (data.tree || []).filter((item: any) => item.type === 'blob');
      }
      throw error;
    }
  }

  /**
   * Get the content of a file
   */
  async getFileContent(path: string, ref?: string): Promise<FileContent> {
    const params = ref ? `?ref=${ref}` : '';
    const data = await this.request(`/repos/${this.owner}/${this.repo}/contents/${path}${params}`);

    return {
      path: data.path,
      content: Buffer.from(data.content, 'base64').toString('utf-8'),
      sha: data.sha,
      encoding: data.encoding,
    };
  }

  /**
   * Find files relevant to a bug based on URL paths, component names, and error messages
   */
  async findRelevantFiles(
    tree: TreeItem[],
    bugContext: { pageUrl?: string; title?: string; description?: string; reproduction_steps?: any[] }
  ): Promise<string[]> {
    const relevantPaths: Map<string, number> = new Map();

    // Source file extensions to search
    const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte', '.py', '.rb', '.go', '.java', '.php'];

    const sourceFiles = tree.filter(item =>
      sourceExtensions.some(ext => item.path.endsWith(ext)) &&
      !item.path.includes('node_modules') &&
      !item.path.includes('.test.') &&
      !item.path.includes('.spec.') &&
      !item.path.includes('__tests__') &&
      (item.size || 0) < 100000 // Skip very large files
    );

    // Extract search terms from bug context
    const searchTerms: string[] = [];

    // Extract path segments from URL
    if (bugContext.pageUrl) {
      try {
        const url = new URL(bugContext.pageUrl);
        const pathSegments = url.pathname.split('/').filter(s => s && s.length > 2);
        searchTerms.push(...pathSegments);
      } catch {}
    }

    // Extract key words from title and description
    if (bugContext.title) {
      const words = bugContext.title
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3)
        .map(w => w.toLowerCase());
      searchTerms.push(...words);
    }

    if (bugContext.description) {
      // Look for component names (PascalCase or camelCase words)
      const componentNames = bugContext.description.match(/[A-Z][a-zA-Z]+/g) || [];
      searchTerms.push(...componentNames.map(n => n.toLowerCase()));
    }

    // Score each source file based on matching terms
    for (const file of sourceFiles) {
      const filePath = file.path.toLowerCase();
      let score = 0;

      for (const term of searchTerms) {
        if (filePath.includes(term.toLowerCase())) {
          score += 2;
        }
      }

      // Boost common patterns
      if (filePath.includes('page') || filePath.includes('route') || filePath.includes('view')) score += 1;
      if (filePath.includes('component') || filePath.includes('widget')) score += 1;
      if (filePath.includes('api') || filePath.includes('handler') || filePath.includes('controller')) score += 1;

      // Penalize config/test/build files
      if (filePath.includes('config') || filePath.includes('webpack') || filePath.includes('babel')) score -= 2;

      if (score > 0) {
        relevantPaths.set(file.path, score);
      }
    }

    // Sort by score and return top files
    return Array.from(relevantPaths.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5) // Max 5 files
      .map(([path]) => path);
  }

  /**
   * Get the SHA of a branch
   */
  async getBranchSha(branch: string): Promise<string> {
    const data = await this.request(`/repos/${this.owner}/${this.repo}/git/ref/heads/${branch}`);
    return data.object.sha;
  }

  /**
   * Create a new branch from a base branch
   */
  async createBranch(branchName: string, baseBranch: string): Promise<void> {
    const baseSha = await this.getBranchSha(baseBranch);
    await this.request(`/repos/${this.owner}/${this.repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      }),
    });
    logger.info('Branch created', { branch: branchName, baseSha });
  }

  /**
   * Update or create a file in the repo
   */
  async updateFile(
    path: string,
    content: string,
    message: string,
    branch: string,
    sha?: string
  ): Promise<void> {
    const body: any = {
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
    };

    if (sha) {
      body.sha = sha;
    }

    await this.request(`/repos/${this.owner}/${this.repo}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /**
   * Create a pull request
   */
  async createPullRequest(input: {
    title: string;
    body: string;
    head: string;
    base: string;
  }): Promise<{ number: number; html_url: string }> {
    const data = await this.request(`/repos/${this.owner}/${this.repo}/pulls`, {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        body: input.body,
        head: input.head,
        base: input.base,
      }),
    });

    return {
      number: data.number,
      html_url: data.html_url,
    };
  }

  /**
   * Test connection by fetching repo info
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const data = await this.request(`/repos/${this.owner}/${this.repo}`);
      return {
        success: true,
        message: `Connected to ${data.full_name} (${data.default_branch})`,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Get the default branch name
   */
  async getDefaultBranch(): Promise<string> {
    const data = await this.request(`/repos/${this.owner}/${this.repo}`);
    return data.default_branch || 'main';
  }
}
