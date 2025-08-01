import { BaseDetector, ParsedFile } from '../base/detector';
import { Issue, IssueBuilder, IssueSeverity, IssueCategory } from '../../models/issue';

interface SizeConfig {
  enabled: boolean;
  thresholds: {
    fileLines: number;
    functionLines: number;
    functionParameters: number;
    classLines: number;
    methodLines: number;
  };
}

export class SizeDetector extends BaseDetector {
  private defaultConfig: SizeConfig = {
    enabled: true,
    thresholds: {
      fileLines: 300,
      functionLines: 50,
      functionParameters: 5,
      classLines: 200,
      methodLines: 30
    }
  };

  constructor(config?: Partial<SizeConfig>) {
    super({ ...config, enabled: config?.enabled ?? true });
    this.config.thresholds = { ...this.defaultConfig.thresholds, ...config?.thresholds };
  }

  detect(file: ParsedFile): Issue[] {
    if (!this.isEnabled()) return [];

    const issues: Issue[] = [];
    
    try {
      // Verificar tamanho do arquivo
      if (file.linesOfCode > this.getThreshold('fileLines', this.defaultConfig.thresholds.fileLines)) {
        issues.push(this.createFileSizeIssue(file));
      }

      this.traverseAST(file.ast, file, issues);
    } catch (error) {
      console.warn(`Análise de tamanho falhou para ${file.path}:`, error);
    }

    return issues;
  }

  private traverseAST(node: any, file: ParsedFile, issues: Issue[]): void {
    if (!node || typeof node !== 'object') return;

    // Verificar tamanho de função
    if (this.isFunctionNode(node)) {
      this.checkFunctionSize(file, node, issues);
    }

    // Verificar tamanho de classe
    if (node.type === 'ClassDeclaration') {
      this.checkClassSize(file, node, issues);
    }

    // Verificar tamanho de método (dentro de classes)
    if (node.type === 'MethodDefinition') {
      this.checkMethodSize(file, node, issues);
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
           node.type === 'ArrowFunctionExpression';
  }

  private checkFunctionSize(file: ParsedFile, node: any, issues: Issue[]): void {
    const functionLines = this.calculateNodeLines(node);
    const parameterCount = this.getFunctionParameterCount(node);
    const functionName = this.extractFunctionName(node);

    // Verificar comprimento da função
    const lineThreshold = this.getThreshold('functionLines', this.defaultConfig.thresholds.functionLines);
    if (functionLines > lineThreshold) {
      issues.push(this.createFunctionSizeIssue(file, node, functionName, functionLines, 'linhas'));
    }

    // Verificar quantidade de parâmetros
    const paramThreshold = this.getThreshold('functionParameters', this.defaultConfig.thresholds.functionParameters);
    if (parameterCount > paramThreshold) {
      issues.push(this.createFunctionSizeIssue(file, node, functionName, parameterCount, 'parâmetros'));
    }
  }

  private checkClassSize(file: ParsedFile, node: any, issues: Issue[]): void {
    const classLines = this.calculateNodeLines(node);
    const className = node.id?.name || 'classe anônima';
    
    const threshold = this.getThreshold('classLines', this.defaultConfig.thresholds.classLines);
    if (classLines > threshold) {
      issues.push(this.createClassSizeIssue(file, node, className, classLines));
    }
  }

  private checkMethodSize(file: ParsedFile, node: any, issues: Issue[]): void {
    const methodLines = this.calculateNodeLines(node.value || node);
    const methodName = node.key?.name || 'método anônimo';
    
    const threshold = this.getThreshold('methodLines', this.defaultConfig.thresholds.methodLines);
    if (methodLines > threshold) {
      issues.push(this.createMethodSizeIssue(file, node, methodName, methodLines));
    }
  }

  private calculateNodeLines(node: any): number {
    if (!node.loc) return 0;
    return (node.loc.end?.line || 0) - (node.loc.start?.line || 0) + 1;
  }

  private getFunctionParameterCount(node: any): number {
    return node.params?.length || 0;
  }

  private extractFunctionName(node: any): string {
    if (node.id?.name) return node.id.name;
    if (node.key?.name) return node.key.name;
    if (node.type === 'ArrowFunctionExpression') return 'função arrow';
    return 'função anônima';
  }

  private createFileSizeIssue(file: ParsedFile): Issue {
    const threshold = this.getThreshold('fileLines', this.defaultConfig.thresholds.fileLines);
    
    return IssueBuilder.create()
      .withId(this.generateIssueId())
      .withCategory(IssueCategory.SIZE)
      .withSeverity(this.getSeverityBySize(file.linesOfCode, threshold))
      .withTitle(`Arquivo grande: ${file.linesOfCode} linhas`)
      .withDescription(`O arquivo tem ${file.linesOfCode} linhas, que excede o limite recomendado de ${threshold} linhas.`)
      .withSuggestion(`Considere dividir este arquivo em módulos menores e mais focados. Agrupe funcionalidades relacionadas e extraia-as em arquivos separados. Isso melhora a manutenibilidade e torna o código mais fácil de entender.`)
      .withLocation({ file: file.path, line: 1, column: 0 })
      .withRule('tamanho-arquivo')
      .build();
  }

  private createFunctionSizeIssue(file: ParsedFile, node: any, name: string, size: number, type: 'linhas' | 'parâmetros'): Issue {
    const thresholdKey = type === 'linhas' ? 'functionLines' : 'functionParameters';
    const threshold = this.getThreshold(thresholdKey, this.defaultConfig.thresholds[thresholdKey]);
    
    return IssueBuilder.create()
      .withId(this.generateIssueId())
      .withCategory(IssueCategory.SIZE)
      .withSeverity(this.getSeverityBySize(size, threshold))
      .withTitle(`Função grande: ${size} ${type}`)
      .withDescription(`A função "${name}" tem ${size} ${type}, que excede o limite recomendado de ${threshold} ${type}.`)
      .withSuggestion(this.getFunctionSizeSuggestion(type))
      .withLocation(this.createLocation(file, node))
      .withCodeSnippet(this.extractCodeSnippet(file, this.createLocation(file, node)))
      .withRule(`funcao-${type}`)
      .build();
  }

  private createClassSizeIssue(file: ParsedFile, node: any, name: string, lines: number): Issue {
    const threshold = this.getThreshold('classLines', this.defaultConfig.thresholds.classLines);
    
    return IssueBuilder.create()
      .withId(this.generateIssueId())
      .withCategory(IssueCategory.SIZE)
      .withSeverity(this.getSeverityBySize(lines, threshold))
      .withTitle(`Classe grande: ${lines} linhas`)
      .withDescription(`A classe "${name}" tem ${lines} linhas, que excede o limite recomendado de ${threshold} linhas.`)
      .withSuggestion(`Considere dividir esta classe em classes menores e mais focadas. Aplique o Princípio da Responsabilidade Única - cada classe deve ter apenas uma razão para mudar. Extraia métodos relacionados em classes separadas ou use composição.`)
      .withLocation(this.createLocation(file, node))
      .withCodeSnippet(this.extractCodeSnippet(file, this.createLocation(file, node)))
      .withRule('tamanho-classe')
      .build();
  }

  private createMethodSizeIssue(file: ParsedFile, node: any, name: string, lines: number): Issue {
    const threshold = this.getThreshold('methodLines', this.defaultConfig.thresholds.methodLines);
    
    return IssueBuilder.create()
      .withId(this.generateIssueId())
      .withCategory(IssueCategory.SIZE)
      .withSeverity(this.getSeverityBySize(lines, threshold))
      .withTitle(`Método grande: ${lines} linhas`)
      .withDescription(`O método "${name}" tem ${lines} linhas, que excede o limite recomendado de ${threshold} linhas.`)
      .withSuggestion(`Considere dividir este método em métodos menores e mais focados. Extraia blocos lógicos em métodos privados com nomes descritivos. Isso melhora a legibilidade e torna o código mais fácil de testar.`)
      .withLocation(this.createLocation(file, node))
      .withCodeSnippet(this.extractCodeSnippet(file, this.createLocation(file, node)))
      .withRule('tamanho-metodo')
      .build();
  }

  private getFunctionSizeSuggestion(type: 'linhas' | 'parâmetros'): string {
    if (type === 'linhas') {
      return `Divida esta função em funções menores e mais focadas. Extraia blocos lógicos em funções separadas com nomes descritivos. Considere usar o Princípio da Responsabilidade Única - cada função deve fazer uma coisa bem feita.`;
    } else {
      return `Reduza o número de parâmetros agrupando parâmetros relacionados em objetos, usando objetos de configuração, ou dividindo a função em funções menores. Considere se esta função está tentando fazer muitas coisas.`;
    }
  }

  private getSeverityBySize(actual: number, threshold: number): IssueSeverity {
    const ratio = actual / threshold;
    
    if (ratio >= 3) return IssueSeverity.CRITICAL;
    if (ratio >= 2) return IssueSeverity.HIGH;
    if (ratio >= 1.5) return IssueSeverity.MEDIUM;
    return IssueSeverity.LOW;
  }
}