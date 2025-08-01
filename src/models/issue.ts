export enum IssueSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum IssueCategory {
  COMPLEXITY = 'complexity',
  NAMING = 'naming',
  SIZE = 'size',
  DUPLICATION = 'duplication',
  BEST_PRACTICES = 'best_practices'
}

export interface IssueLocation {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface Issue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  suggestion: string;
  location: IssueLocation;
  codeSnippet?: string;
  rule: string;
}

export class IssueBuilder {
  private issue: Partial<Issue> = {};

  static create(): IssueBuilder {
    return new IssueBuilder();
  }

  withId(id: string): IssueBuilder {
    this.issue.id = id;
    return this;
  }

  withCategory(category: IssueCategory): IssueBuilder {
    this.issue.category = category;
    return this;
  }

  withSeverity(severity: IssueSeverity): IssueBuilder {
    this.issue.severity = severity;
    return this;
  }

  withTitle(title: string): IssueBuilder {
    this.issue.title = title;
    return this;
  }

  withDescription(description: string): IssueBuilder {
    this.issue.description = description;
    return this;
  }

  withSuggestion(suggestion: string): IssueBuilder {
    this.issue.suggestion = suggestion;
    return this;
  }

  withLocation(location: IssueLocation): IssueBuilder {
    this.issue.location = location;
    return this;
  }

  withCodeSnippet(snippet: string): IssueBuilder {
    this.issue.codeSnippet = snippet;
    return this;
  }

  withRule(rule: string): IssueBuilder {
    this.issue.rule = rule;
    return this;
  }

  build(): Issue {
    if (!this.issue.id || !this.issue.category || !this.issue.severity || 
        !this.issue.title || !this.issue.description || !this.issue.suggestion || 
        !this.issue.location || !this.issue.rule) {
      throw new Error('Propriedades obrigatórias do problema estão faltando');
    }
    
    return this.issue as Issue;
  }
}