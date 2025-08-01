import { Report, FileAnalysis } from '../models/report';
import { Issue, IssueSeverity, IssueCategory } from '../models/issue';
import { createLogger } from '../utils/logger';

export interface ReporterOptions {
  showCodeSnippets?: boolean;
  maxIssuesPerFile?: number;
  sortBy?: 'severity' | 'category' | 'file';
  includeScore?: boolean;
  verbose?: boolean;
  colorOutput?: boolean;
  outputPath?: string;
}

export type ReporterFormat = 'console' | 'json' | 'html';

export abstract class BaseReporter {
  protected options: Required<ReporterOptions>;
  protected reporterLogger = createLogger('Reporter');

  constructor(options: Partial<ReporterOptions> = {}) {
    this.options = {
      showCodeSnippets: true,
      maxIssuesPerFile: 10,
      sortBy: 'severity',
      includeScore: true,
      verbose: false,
      colorOutput: true,
      outputPath: '',
      ...options
    } as Required<ReporterOptions>;
  }

  abstract generate(report: Report): void;

  protected getSeverityColor(severity: IssueSeverity): string {
    if (!this.options.colorOutput) return '';
    
    switch (severity) {
      case IssueSeverity.CRITICAL: return '\x1b[41m';
      case IssueSeverity.HIGH: return '\x1b[31m';
      case IssueSeverity.MEDIUM: return '\x1b[33m';
      case IssueSeverity.LOW: return '\x1b[36m';
      default: return '\x1b[37m';
    }
  }

  protected getSeverityIcon(severity: IssueSeverity): string {
    switch (severity) {
      case IssueSeverity.CRITICAL: return '🔴';
      case IssueSeverity.HIGH: return '🟠';
      case IssueSeverity.MEDIUM: return '🟡';
      case IssueSeverity.LOW: return '🔵';
      default: return '⚪';
    }
  }

  protected getCategoryIcon(category: IssueCategory): string {
    switch (category) {
      case IssueCategory.COMPLEXITY: return '🔄';
      case IssueCategory.NAMING: return '🏷️';
      case IssueCategory.SIZE: return '📏';
      case IssueCategory.DUPLICATION: return '📋';
      case IssueCategory.BEST_PRACTICES: return '✨';
      default: return '📝';
    }
  }

  protected getCategoryName(category: IssueCategory): string {
    switch (category) {
      case IssueCategory.COMPLEXITY: return 'COMPLEXIDADE';
      case IssueCategory.NAMING: return 'NOMENCLATURA';
      case IssueCategory.SIZE: return 'TAMANHO';
      case IssueCategory.DUPLICATION: return 'DUPLICAÇÃO';
      case IssueCategory.BEST_PRACTICES: return 'BOAS PRÁTICAS';
      default: return 'OUTROS';
    }
  }

  protected getSeverityName(severity: IssueSeverity): string {
    switch (severity) {
      case IssueSeverity.CRITICAL: return 'CRÍTICO';
      case IssueSeverity.HIGH: return 'ALTO';
      case IssueSeverity.MEDIUM: return 'MÉDIO';
      case IssueSeverity.LOW: return 'BAIXO';
      default: return 'DESCONHECIDO';
    }
  }

  protected getScoreColor(score: number): string {
    if (!this.options.colorOutput) return '';
    
    if (score >= 90) return '\x1b[32m';
    if (score >= 75) return '\x1b[33m';
    if (score >= 50) return '\x1b[35m';
    return '\x1b[31m';
  }

  protected reset(): string {
    return this.options.colorOutput ? '\x1b[0m' : '';
  }
}

export class ConsoleReporter extends BaseReporter {
  generate(report: Report): void {
    this.reporterLogger.info('Gerando relatório para console');
    
    console.log('\n' + '='.repeat(70));
    console.log('🔍 REVISOR DE CÓDIGO - RELATÓRIO DE ANÁLISE');
    console.log('='.repeat(70));

    this.printSummary(report);
    this.printCategorySummary(report);
    
    if (report.files.length > 0) {
      this.printFileAnalysis(report);
    }
    
    if (report.topIssues.length > 0) {
      this.printTopIssues(report);
    }

    this.printFooter(report);
    
    this.reporterLogger.debug('Relatório gerado com sucesso', {
      totalFiles: report.summary.totalFiles,
      totalIssues: report.summary.totalIssues
    });
  }

  private printSummary(report: Report): void {
    const { summary } = report;
    const scoreColor = this.getScoreColor(summary.overallScore);
    
    console.log('\n📊 RESUMO');
    console.log('-'.repeat(50));
    console.log(`📁 Arquivos analisados: ${summary.totalFiles}`);
    console.log(`📝 Linhas de código: ${summary.totalLinesOfCode.toLocaleString()}`);
    console.log(`⚠️  Total de problemas: ${summary.totalIssues}`);
    console.log(`${scoreColor}🏆 Pontuação Geral: ${summary.overallScore}/100${this.reset()}`);
    console.log(`🗓️  Data da análise: ${summary.analysisDate.toLocaleString('pt-BR')}`);
  }

  private printCategorySummary(report: Report): void {
    if (report.categories.length === 0) {
      console.log('\n✅ Nenhum problema encontrado! Excelente trabalho!');
      return;
    }

    console.log('\n📋 PROBLEMAS POR CATEGORIA');
    console.log('-'.repeat(50));
    
    report.categories.forEach(category => {
      const icon = this.getCategoryIcon(category.category);
      const categoryName = this.getCategoryName(category.category);
      const total = category.count;
      const severityData = category.severity;
      
      console.log(`${icon} ${categoryName}: ${total} problema${total > 1 ? 's' : ''}`);
      
      const severityEntries = [
        { key: IssueSeverity.CRITICAL, icon: '🔴', label: 'Crítico' },
        { key: IssueSeverity.HIGH, icon: '🟠', label: 'Alto' },
        { key: IssueSeverity.MEDIUM, icon: '🟡', label: 'Médio' },
        { key: IssueSeverity.LOW, icon: '🔵', label: 'Baixo' }
      ];

      severityEntries.forEach(({ key, icon, label }) => {
        const count = severityData[key];
        if (count > 0) {
          const iconRepeat = icon.repeat(Math.min(count, 10));
          console.log(`  ${iconRepeat} ${label}: ${count}`);
        }
      });
      console.log('');
    });
  }

  private printFileAnalysis(report: Report): void {
    const sortedFiles = this.sortFilesByIssues(report.files);
    const filesToShow = sortedFiles.slice(0, 5);
    
    if (filesToShow.some(f => f.issues.length > 0)) {
      console.log('\n🗂️  ARQUIVOS COM MAIS PROBLEMAS');
      console.log('-'.repeat(50));
      
      filesToShow.forEach(file => {
        if (file.issues.length === 0) return;
        
        const scoreColor = this.getScoreColor(file.score);
        console.log(`\n📄 ${file.path}`);
        console.log(`   ${scoreColor}Pontuação: ${file.score}/100${this.reset()} | Problemas: ${file.issues.length} | Linhas: ${file.linesOfCode}`);
        
        const issuesToShow = file.issues
          .slice(0, this.options.maxIssuesPerFile)
          .sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity));
        
        issuesToShow.forEach(issue => {
          this.printIssue(issue, '   ');
        });
        
        if (file.issues.length > this.options.maxIssuesPerFile) {
          console.log(`   💭 ... e mais ${file.issues.length - this.options.maxIssuesPerFile} problema${file.issues.length - this.options.maxIssuesPerFile > 1 ? 's' : ''}`);
        }
      });
    }
  }

  private printTopIssues(report: Report): void {
    console.log('\n🚨 PROBLEMAS PRIORITÁRIOS');
    console.log('-'.repeat(50));
    
    const topIssues = report.topIssues.slice(0, 5);
    topIssues.forEach((issue, index) => {
      console.log(`\n${index + 1}. ${this.getSeverityIcon(issue.severity)} ${issue.title}`);
      console.log(`   📍 ${issue.location.file}:${issue.location.line}:${issue.location.column}`);
      console.log(`   💡 ${issue.suggestion}`);
      
      if (this.options.showCodeSnippets && issue.codeSnippet) {
        console.log('\n   📝 Código:');
        console.log(this.indentCode(issue.codeSnippet, '   '));
      }
    });
  }

  private printIssue(issue: Issue, indent: string = ''): void {
    const severityColor = this.getSeverityColor(issue.severity);
    const icon = this.getSeverityIcon(issue.severity);
    const severityName = this.getSeverityName(issue.severity);
    
    console.log(`${indent}${icon} ${severityColor}${severityName}${this.reset()}: ${issue.title}`);
    console.log(`${indent}   📍 Linha ${issue.location.line}:${issue.location.column}`);
    
    if (this.options.verbose) {
      console.log(`${indent}   📝 ${issue.description}`);
      console.log(`${indent}   💡 ${issue.suggestion}`);
    }
  }

  private printFooter(report: Report): void {
    console.log('\n' + '='.repeat(70));
    
    if (report.summary.totalIssues === 0) {
      console.log('🎉 Excelente! Nenhum problema encontrado no seu código.');
    } else {
      console.log('💡 Foque nos problemas críticos e de alta severidade primeiro.');
      console.log('📚 Cada problema inclui sugestões para melhoria.');
      
      if (report.summary.overallScore < 70) {
        console.log('⚠️  Considere refatorar arquivos com pontuação baixa.');
      }
    }
    
    console.log('🔧 Revisor de Código v1.1.0 - Melhorando seu código, um problema por vez!');
    console.log('='.repeat(70) + '\n');
  }

  private sortFilesByIssues(files: FileAnalysis[]): FileAnalysis[] {
    return [...files].sort((a, b) => {
      if (a.issues.length !== b.issues.length) {
        return b.issues.length - a.issues.length;
      }
      return a.score - b.score;
    });
  }

  private getSeverityWeight(severity: IssueSeverity): number {
    switch (severity) {
      case IssueSeverity.CRITICAL: return 4;
      case IssueSeverity.HIGH: return 3;
      case IssueSeverity.MEDIUM: return 2;
      case IssueSeverity.LOW: return 1;
      default: return 0;
    }
  }

  private indentCode(code: string, indent: string): string {
    return code.split('\n')
      .map(line => `${indent}${line}`)
      .join('\n');
  }
}

export class JSONReporter extends BaseReporter {
  generate(report: Report): void {
    this.reporterLogger.info('Gerando relatório JSON');
    
    const jsonReport = {
      summary: report.summary,
      categories: report.categories,
      files: report.files.map(file => ({
        ...file,
        issues: file.issues.map(issue => ({
          ...issue,
          codeSnippet: this.options.showCodeSnippets ? issue.codeSnippet : undefined
        }))
      })),
      topIssues: report.topIssues.slice(0, 10),
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.1.0',
        format: 'json'
      }
    };

    console.log(JSON.stringify(jsonReport, null, 2));
    
    this.reporterLogger.debug('Relatório JSON gerado');
  }
}

// Factory function para criar reporters
export function createReporter(format: ReporterFormat, options: Partial<ReporterOptions> = {}): BaseReporter {
  const reporterLogger = createLogger('ReporterFactory');
  
  try {
    switch (format) {
      case 'console':
        reporterLogger.debug('Criando ConsoleReporter');
        return new ConsoleReporter(options);
        
      case 'json':
        reporterLogger.debug('Criando JSONReporter');
        return new JSONReporter(options);
        
      case 'html':
        reporterLogger.debug('Criando HTMLReporter');
        const { HTMLReporter } = require('./html-reporter');
        return new HTMLReporter(options);
        
      default:
        reporterLogger.warn('Formato de reporter não reconhecido, usando console', { format });
        return new ConsoleReporter(options);
    }
  } catch (error) {
    reporterLogger.error('Erro ao criar reporter', error as Error, { format, options });
    reporterLogger.info('Fallback para ConsoleReporter');
    return new ConsoleReporter(options);
  }
}

export function getAvailableFormats(): ReporterFormat[] {
  return ['console', 'json', 'html'];
}

export function validateReporterFormat(format: string): format is ReporterFormat {
  return getAvailableFormats().includes(format as ReporterFormat);
}

// Re-export para compatibilidade
export { HTMLReporter } from './html-reporter';