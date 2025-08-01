import { BaseDetector, ParsedFile } from '../base/detector';
import { Issue, IssueBuilder, IssueSeverity, IssueCategory } from '../../models/issue';

interface NamingConfig {
  enabled: boolean;
  thresholds: {
    minLength: number;
    maxLength: number;
  };
  patterns: {
    camelCase: boolean;
    constants: boolean;
    functions: boolean;
    variables: boolean;
  };
}

export class NamingDetector extends BaseDetector {
  private defaultConfig: NamingConfig = {
    enabled: true,
    thresholds: {
      minLength: 3,
      maxLength: 30
    },
    patterns: {
      camelCase: true,
      constants: true,
      functions: true,
      variables: true
    }
  };

  private reservedWords = ['temp', 'tmp', 'data', 'info', 'obj', 'item', 'elem', 'val', 'num'];
  private abbreviations = ['btn', 'txt', 'img', 'div', 'el', 'str', 'arr', 'fn'];

  constructor(config?: Partial<NamingConfig>) {
    super({ ...config, enabled: config?.enabled ?? true });
    this.config.thresholds = { ...this.defaultConfig.thresholds, ...config?.thresholds };
    this.config = { ...this.defaultConfig, ...config };
  }

  detect(file: ParsedFile): Issue[] {
    if (!this.isEnabled()) return [];

    const issues: Issue[] = [];
    
    try {
      this.traverseAST(file.ast, file, issues);
    } catch (error) {
      console.warn(`Análise de nomenclatura falhou para ${file.path}:`, error);
    }

    return issues;
  }

  private traverseAST(node: any, file: ParsedFile, issues: Issue[]): void {
    if (!node || typeof node !== 'object') return;

    // Verificar diferentes tipos de identificadores
    if (node.type === 'FunctionDeclaration' && node.id?.name) {
      this.checkFunctionName(file, node, node.id.name, issues);
    }

    if (node.type === 'VariableDeclarator' && node.id?.name) {
      this.checkVariableName(file, node, node.id.name, issues);
    }

    if (node.type === 'ClassDeclaration' && node.id?.name) {
      this.checkClassName(file, node, node.id.name, issues);
    }

    if (node.type === 'MethodDefinition' && node.key?.name) {
      this.checkMethodName(file, node, node.key.name, issues);
    }

    if (node.type === 'Property' && node.key?.name && !node.computed) {
      this.checkPropertyName(file, node, node.key.name, issues);
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

  private checkFunctionName(file: ParsedFile, node: any, name: string, issues: Issue[]): void {
    const problems = this.analyzeIdentifier(name, 'função');
    problems.forEach(problem => {
      issues.push(this.createNamingIssue(file, node, name, problem, 'função'));
    });
  }

  private checkVariableName(file: ParsedFile, node: any, name: string, issues: Issue[]): void {
    const isConstant = this.isConstantVariable(node);
    const type = isConstant ? 'constante' : 'variável';
    
    const problems = this.analyzeIdentifier(name, type);
    problems.forEach(problem => {
      issues.push(this.createNamingIssue(file, node, name, problem, type));
    });
  }

  private checkClassName(file: ParsedFile, node: any, name: string, issues: Issue[]): void {
    const problems = this.analyzeIdentifier(name, 'classe');
    problems.forEach(problem => {
      issues.push(this.createNamingIssue(file, node, name, problem, 'classe'));
    });
  }

  private checkMethodName(file: ParsedFile, node: any, name: string, issues: Issue[]): void {
    if (name === 'constructor') return;
    
    const problems = this.analyzeIdentifier(name, 'método');
    problems.forEach(problem => {
      issues.push(this.createNamingIssue(file, node, name, problem, 'método'));
    });
  }

  private checkPropertyName(file: ParsedFile, node: any, name: string, issues: Issue[]): void {
    const problems = this.analyzeIdentifier(name, 'propriedade');
    problems.forEach(problem => {
      issues.push(this.createNamingIssue(file, node, name, problem, 'propriedade'));
    });
  }

  private analyzeIdentifier(name: string, type: string): string[] {
    const problems: string[] = [];

    // Verificações de comprimento
    if (name.length < this.getThreshold('minLength', this.defaultConfig.thresholds.minLength)) {
      problems.push(`muito curto (${name.length} caracteres, mín ${this.getThreshold('minLength', this.defaultConfig.thresholds.minLength)})`);
    }

    if (name.length > this.getThreshold('maxLength', this.defaultConfig.thresholds.maxLength)) {
      problems.push(`muito longo (${name.length} caracteres, máx ${this.getThreshold('maxLength', this.defaultConfig.thresholds.maxLength)})`);
    }

    // Verificações de convenção
    if (type === 'constante' && !this.isUpperSnakeCase(name)) {
      problems.push('constantes devem usar UPPER_SNAKE_CASE');
    }

    if (type === 'classe' && !this.isPascalCase(name)) {
      problems.push('classes devem usar PascalCase');
    }

    if (['função', 'método', 'variável', 'propriedade'].includes(type) && 
        type !== 'constante' && !this.isCamelCase(name)) {
      problems.push(`${type}s devem usar camelCase`);
    }

    // Verificações de significado
    if (this.reservedWords.includes(name.toLowerCase())) {
      problems.push('usa palavra genérica/reservada - seja mais descritivo');
    }

    if (this.abbreviations.includes(name.toLowerCase())) {
      problems.push('usa abreviação - considere palavra completa');
    }

    if (this.isNumberOnly(name)) {
      problems.push('consiste apenas de números/letras - seja mais descritivo');
    }

    if (this.hasConsecutiveUnderscores(name)) {
      problems.push('tem underscores consecutivos');
    }

    return problems;
  }

  private isConstantVariable(node: any): boolean {
    return node.parent?.kind === 'const' && 
           node.id?.name && 
           node.id.name === node.id.name.toUpperCase();
  }

  private isCamelCase(name: string): boolean {
    return /^[a-z][a-zA-Z0-9]*$/.test(name);
  }

  private isPascalCase(name: string): boolean {
    return /^[A-Z][a-zA-Z0-9]*$/.test(name);
  }

  private isUpperSnakeCase(name: string): boolean {
    return /^[A-Z][A-Z0-9_]*$/.test(name);
  }

  private isNumberOnly(name: string): boolean {
    return /^[a-zA-Z]?[0-9]+$/.test(name);
  }

  private hasConsecutiveUnderscores(name: string): boolean {
    return /__/.test(name);
  }

  private createNamingIssue(file: ParsedFile, node: any, name: string, problem: string, type: string): Issue {
    const severity = this.getSeverityByProblem(problem);
    
    return IssueBuilder.create()
      .withId(this.generateIssueId())
      .withCategory(IssueCategory.NAMING)
      .withSeverity(severity)
      .withTitle(`Nomenclatura inadequada de ${type}: "${name}"`)
      .withDescription(`${type.charAt(0).toUpperCase() + type.slice(1)} "${name}" ${problem}.`)
      .withSuggestion(this.getSuggestionByProblem(problem, type))
      .withLocation(this.createLocation(file, node))
      .withCodeSnippet(this.extractCodeSnippet(file, this.createLocation(file, node)))
      .withRule('convencao-nomenclatura')
      .build();
  }

  private getSeverityByProblem(problem: string): IssueSeverity {
    if (problem.includes('palavra genérica') || problem.includes('underscores consecutivos')) {
      return IssueSeverity.HIGH;
    }
    if (problem.includes('abreviação') || problem.includes('muito curto') || problem.includes('números')) {
      return IssueSeverity.MEDIUM;
    }
    return IssueSeverity.LOW;
  }

  private getSuggestionByProblem(problem: string, type: string): string {
    if (problem.includes('camelCase')) {
      return `Use nomenclatura camelCase: comece com minúscula, capitalize palavras subsequentes (ex: "obterNomeUsuario", "calcularTotal").`;
    }
    if (problem.includes('PascalCase')) {
      return `Use nomenclatura PascalCase: capitalize primeira letra e palavras subsequentes (ex: "ServicoUsuario", "ProcessadorDados").`;
    }
    if (problem.includes('UPPER_SNAKE_CASE')) {
      return `Use UPPER_SNAKE_CASE para constantes: tudo maiúsculo com underscores (ex: "MAX_TENTATIVAS", "URL_BASE_API").`;
    }
    if (problem.includes('muito curto')) {
      return `Escolha um nome mais descritivo com pelo menos 3 caracteres que indique claramente o propósito da ${type}.`;
    }
    if (problem.includes('muito longo')) {
      return `Encurte o nome mantendo-o descritivo. Considere abreviar ou reestruturar a ${type}.`;
    }
    if (problem.includes('palavra genérica') || problem.includes('reservada')) {
      return `Use um nome mais específico e descritivo que indique claramente o que a ${type} representa ou faz.`;
    }
    if (problem.includes('abreviação')) {
      return `Escreva abreviações por extenso para melhor legibilidade (ex: "botao" em vez de "btn", "elemento" em vez de "el").`;
    }
    return `Siga convenções padrão de nomenclatura para melhor legibilidade e manutenibilidade do código.`;
  }
}