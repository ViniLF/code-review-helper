import { Report, FileAnalysis } from '../models/report';
import { Issue, IssueSeverity, IssueCategory } from '../models/issue';

export interface ReporterOptions {
  showCodeSnippets?: boolean;
  maxIssuesPerFile?: number;
  sortBy?: 'severity' | 'category' | 'file';
  includeScore?: boolean;
  verbose?: boolean;
}

export abstract class BaseReporter {
  protected options: Required<ReporterOptions>;

  constructor(options: Partial<ReporterOptions> = {}) {
    this.options = {
      showCodeSnippets: true,
      maxIssuesPerFile: 10,
      sortBy: 'severity',
      includeScore: true,
      verbose: false,
      ...options
    } as Required<ReporterOptions>;
  }

  abstract generate(report: Report): void;

  protected getSeverityColor(severity: IssueSeverity): string {
    switch (severity) {
      case IssueSeverity.CRITICAL: return '\x1b[41m'; // Fundo vermelho
      case IssueSeverity.HIGH: return '\x1b[31m';     // Texto vermelho
      case IssueSeverity.MEDIUM: return '\x1b[33m';   // Texto amarelo
      case IssueSeverity.LOW: return '\x1b[36m';      // Texto ciano
      default: return '\x1b[37m';                     // Texto branco
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
    if (score >= 90) return '\x1b[32m'; // Verde
    if (score >= 75) return '\x1b[33m'; // Amarelo
    if (score >= 50) return '\x1b[35m'; // Magenta
    return '\x1b[31m';                  // Vermelho
  }

  protected reset(): string {
    return '\x1b[0m';
  }
}

export class ConsoleReporter extends BaseReporter {
  generate(report: Report): void {
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
      const critical = category.severity[IssueSeverity.CRITICAL];
      const high = category.severity[IssueSeverity.HIGH];
      const medium = category.severity[IssueSeverity.MEDIUM];
      const low = category.severity[IssueSeverity.LOW];
      
      console.log(`${icon} ${categoryName}: ${total} problemas`);
      
      if (critical > 0) console.log(`  ${'🔴'.repeat(Math.min(critical, 10))} Crítico: ${critical}`);
      if (high > 0) console.log(`  ${'🟠'.repeat(Math.min(high, 10))} Alto: ${high}`);
      if (medium > 0) console.log(`  ${'🟡'.repeat(Math.min(medium, 10))} Médio: ${medium}`);
      if (low > 0) console.log(`  ${'🔵'.repeat(Math.min(low, 10))} Baixo: ${low}`);
      console.log('');
    });
  }

  private printFileAnalysis(report: Report): void {
    const sortedFiles = this.sortFilesByIssues(report.files);
    const filesToShow = sortedFiles.slice(0, 5); // Mostrar top 5 arquivos com mais problemas
    
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
          console.log(`   ... e mais ${file.issues.length - this.options.maxIssuesPerFile} problemas`);
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
    }
    
    console.log('🔧 Revisor de Código - Melhorando seu código, um problema por vez!');
    console.log('='.repeat(70) + '\n');
  }

  private sortFilesByIssues(files: FileAnalysis[]): FileAnalysis[] {
    return [...files].sort((a, b) => {
      // Ordenar por quantidade de problemas (decrescente), depois por pontuação (crescente)
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