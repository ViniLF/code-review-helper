import { BaseDetector, ParsedFile } from '../base/detector';
import { Issue, IssueBuilder, IssueSeverity, IssueCategory } from '../../models/issue';

interface ComplexityConfig {
  enabled: boolean;
  thresholds: {
    function: number;
    file: number;
  };
}

export class ComplexityDetector extends BaseDetector {
  private defaultConfig: ComplexityConfig = {
    enabled: true,
    thresholds: {
      function: 10,
      file: 20
    }
  };

  constructor(config?: Partial<ComplexityConfig>) {
    super({ ...config, enabled: config?.enabled ?? true });
    this.config.thresholds = { ...this.defaultConfig.thresholds, ...config?.thresholds };
  }

  detect(file: ParsedFile): Issue[] {
    if (!this.isEnabled()) return [];

    const issues: Issue[] = [];
    
    try {
      this.traverseAST(file.ast, file, issues);
      
      // Verificar complexidade a nível de arquivo
      const fileComplexity = this.calculateFileComplexity(file.ast);
      if (fileComplexity > this.getThreshold('file', this.defaultConfig.thresholds.file)) {
        issues.push(this.createFileComplexityIssue(file, fileComplexity));
      }
      
    } catch (error) {
      console.warn(`Análise de complexidade falhou para ${file.path}:`, error);
    }

    return issues;
  }

  private traverseAST(node: any, file: ParsedFile, issues: Issue[]): void {
    if (!node || typeof node !== 'object') return;

    // Verificar complexidade de função
    if (this.isFunctionNode(node)) {
      const complexity = this.calculateCyclomaticComplexity(node);
      const threshold = this.getThreshold('function', this.defaultConfig.thresholds.function);
      
      if (complexity > threshold) {
        issues.push(this.createFunctionComplexityIssue(file, node, complexity));
      }
    }

    // Percorrer recursivamente nós filhos
    for (const key in node) {
      if (key === 'parent' || key === 'leadingComments' || key === 'trailingComments') continue;
      
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(item => this.traverseAST(item, file, issues));
      } else if (child && typeof child === 'object') {
        this.traverseAST(child, file, issues);
      }
    }
  }

  private isFunctionNode(node: any): boolean {
    return node.type === 'FunctionDeclaration' ||
           node.type === 'FunctionExpression' ||
           node.type === 'ArrowFunctionExpression' ||
           node.type === 'MethodDefinition';
  }

  private calculateCyclomaticComplexity(functionNode: any): number {
    let complexity = 1; // Complexidade base

    const complexityNodes = [
      'IfStatement',
      'ConditionalExpression',
      'SwitchCase',
      'ForStatement',
      'ForInStatement',
      'ForOfStatement',
      'WhileStatement',
      'DoWhileStatement',
      'CatchClause',
      'LogicalExpression'
    ];

    this.traverseForComplexity(functionNode, (node) => {
      if (complexityNodes.includes(node.type)) {
        complexity++;
        
        // Expressões lógicas (&&, ||) adicionam complexidade
        if (node.type === 'LogicalExpression' && 
           (node.operator === '&&' || node.operator === '||')) {
          complexity++;
        }
      }
    });

    return complexity;
  }

  private calculateFileComplexity(ast: any): number {
    let totalComplexity = 0;
    let functionCount = 0;

    this.traverseAST(ast, null as any, []);
    
    this.traverseForComplexity(ast, (node) => {
      if (this.isFunctionNode(node)) {
        totalComplexity += this.calculateCyclomaticComplexity(node);
        functionCount++;
      }
    });

    return functionCount > 0 ? Math.round(totalComplexity / functionCount) : 0;
  }

  private traverseForComplexity(node: any, callback: (node: any) => void): void {
    if (!node || typeof node !== 'object') return;

    callback(node);

    for (const key in node) {
      if (key === 'parent' || key === 'leadingComments' || key === 'trailingComments') continue;
      
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(item => this.traverseForComplexity(item, callback));
      } else if (child && typeof child === 'object') {
        this.traverseForComplexity(child, callback);
      }
    }
  }

  private createFunctionComplexityIssue(file: ParsedFile, node: any, complexity: number): Issue {
    const functionName = this.extractFunctionName(node);
    const severity = this.getSeverityByComplexity(complexity);
    
    // Garantir que o nó tem informação de localização
    if (!node.loc) {
      node.loc = { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } };
    }
    
    return IssueBuilder.create()
      .withId(this.generateIssueId())
      .withCategory(IssueCategory.COMPLEXITY)
      .withSeverity(severity)
      .withTitle(`Alta complexidade ciclomática: ${complexity}`)
      .withDescription(`A função "${functionName}" tem complexidade ciclomática de ${complexity}, que excede o limite de ${this.getThreshold('function', this.defaultConfig.thresholds.function)}.`)
      .withSuggestion(`Considere dividir esta função em funções menores e mais focadas. Extraia blocos lógicos em funções separadas para melhorar a legibilidade e manutenibilidade.`)
      .withLocation(this.createLocation(file, node))
      .withCodeSnippet(this.extractCodeSnippet(file, this.createLocation(file, node)))
      .withRule('complexidade-ciclomatica')
      .build();
  }

  private createFileComplexityIssue(file: ParsedFile, complexity: number): Issue {
    return IssueBuilder.create()
      .withId(this.generateIssueId())
      .withCategory(IssueCategory.COMPLEXITY)
      .withSeverity(IssueSeverity.MEDIUM)
      .withTitle(`Alta complexidade do arquivo: ${complexity}`)
      .withDescription(`O arquivo tem uma complexidade ciclomática média de ${complexity}, que excede o limite de ${this.getThreshold('file', this.defaultConfig.thresholds.file)}.`)
      .withSuggestion(`Considere dividir este arquivo em múltiplos arquivos menores. Agrupe funções relacionadas e extraia-as em módulos separados.`)
      .withLocation({ file: file.path, line: 1, column: 0 })
      .withRule('complexidade-arquivo')
      .build();
  }

  private extractFunctionName(node: any): string {
    if (node.id?.name) return node.id.name;
    if (node.key?.name) return node.key.name;
    if (node.type === 'ArrowFunctionExpression') return 'função arrow anônima';
    return 'função anônima';
  }

  private getSeverityByComplexity(complexity: number): IssueSeverity {
    if (complexity >= 20) return IssueSeverity.CRITICAL;
    if (complexity >= 15) return IssueSeverity.HIGH;
    if (complexity >= 10) return IssueSeverity.MEDIUM;
    return IssueSeverity.LOW;
  }
}