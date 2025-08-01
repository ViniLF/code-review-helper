import { Issue, IssueSeverity, IssueCategory } from './issue';

export interface FileAnalysis {
  path: string;
  linesOfCode: number;
  issues: Issue[];
  score: number;
}

export interface CategorySummary {
  category: IssueCategory;
  count: number;
  severity: {
    [IssueSeverity.LOW]: number;
    [IssueSeverity.MEDIUM]: number;
    [IssueSeverity.HIGH]: number;
    [IssueSeverity.CRITICAL]: number;
  };
}

export interface AnalysisOptions {
  language: string;
  includePatterns: string[];
  excludePatterns: string[];
}

export interface Report {
  summary: {
    totalFiles: number;
    totalIssues: number;
    totalLinesOfCode: number;
    overallScore: number;
    analysisDate: Date;
    options: AnalysisOptions;
  };
  files: FileAnalysis[];
  categories: CategorySummary[];
  topIssues: Issue[];
}

export class ReportBuilder {
  private report: Partial<Report> = {
    summary: {
      totalFiles: 0,
      totalIssues: 0,
      totalLinesOfCode: 0,
      overallScore: 0,
      analysisDate: new Date(),
      options: { language: '', includePatterns: [], excludePatterns: [] }
    },
    files: [],
    categories: [],
    topIssues: []
  };

  static create(): ReportBuilder {
    return new ReportBuilder();
  }

  withOptions(options: AnalysisOptions): ReportBuilder {
    this.report.summary!.options = options;
    return this;
  }

  addFile(fileAnalysis: FileAnalysis): ReportBuilder {
    this.report.files!.push(fileAnalysis);
    this.updateSummary();
    return this;
  }

  private updateSummary(): void {
    const files = this.report.files!;
    const allIssues = files.flatMap(f => f.issues);
    
    this.report.summary!.totalFiles = files.length;
    this.report.summary!.totalIssues = allIssues.length;
    this.report.summary!.totalLinesOfCode = files.reduce((sum, f) => sum + f.linesOfCode, 0);
    this.report.summary!.overallScore = this.calculateOverallScore(files);
    
    this.updateCategories(allIssues);
    this.updateTopIssues(allIssues);
  }

  private calculateOverallScore(files: FileAnalysis[]): number {
    if (files.length === 0) return 100;
    
    const avgScore = files.reduce((sum, f) => sum + f.score, 0) / files.length;
    return Math.round(avgScore * 100) / 100;
  }

  private updateCategories(issues: Issue[]): void {
    const categoryMap = new Map<IssueCategory, CategorySummary>();
    
    Object.values(IssueCategory).forEach(category => {
      categoryMap.set(category, {
        category,
        count: 0,
        severity: {
          [IssueSeverity.LOW]: 0,
          [IssueSeverity.MEDIUM]: 0,
          [IssueSeverity.HIGH]: 0,
          [IssueSeverity.CRITICAL]: 0
        }
      });
    });

    issues.forEach(issue => {
      const summary = categoryMap.get(issue.category)!;
      summary.count++;
      summary.severity[issue.severity]++;
    });

    this.report.categories = Array.from(categoryMap.values())
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  private updateTopIssues(issues: Issue[]): void {
    const severityWeight = {
      [IssueSeverity.CRITICAL]: 4,
      [IssueSeverity.HIGH]: 3,
      [IssueSeverity.MEDIUM]: 2,
      [IssueSeverity.LOW]: 1
    };

    this.report.topIssues = issues
      .sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity])
      .slice(0, 10);
  }

  build(): Report {
    return this.report as Report;
  }
}