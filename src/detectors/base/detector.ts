import { Issue, IssueLocation } from '../../models/issue';

export interface DetectorConfig {
  enabled: boolean;
  severity?: string;
  thresholds?: Record<string, number>;
}

export interface ParsedFile {
  path: string;
  content: string;
  ast: any;
  linesOfCode: number;
}

export abstract class BaseDetector {
  protected config: DetectorConfig;
  protected detectorName: string;

  constructor(config: DetectorConfig = { enabled: true }) {
    this.config = config;
    this.detectorName = this.constructor.name;
  }

  abstract detect(file: ParsedFile): Issue[];

  protected isEnabled(): boolean {
    return this.config.enabled;
  }

  protected getThreshold(key: string, defaultValue: number): number {
    return this.config.thresholds?.[key] ?? defaultValue;
  }

  protected createLocation(file: ParsedFile, node: any): IssueLocation {
    return {
      file: file.path,
      line: node.loc?.start?.line ?? 1,
      column: node.loc?.start?.column ?? 0,
      endLine: node.loc?.end?.line,
      endColumn: node.loc?.end?.column
    };
  }

  protected extractCodeSnippet(file: ParsedFile, location: IssueLocation): string {
    const lines = file.content.split('\n');
    const startLine = Math.max(0, location.line - 2);
    const endLine = Math.min(lines.length, (location.endLine ?? location.line) + 1);
    
    return lines
      .slice(startLine, endLine)
      .map((line, index) => {
        const lineNumber = startLine + index + 1;
        const prefix = lineNumber === location.line ? '→ ' : '  ';
        return `${prefix}${lineNumber.toString().padStart(3)}: ${line}`;
      })
      .join('\n');
  }

  protected generateIssueId(): string {
    return `${this.detectorName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getName(): string {
    return this.detectorName;
  }

  getConfig(): DetectorConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<DetectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}