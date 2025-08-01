import { BaseDetector, ParsedFile } from '../base/detector';
import { Issue, IssueBuilder, IssueSeverity, IssueCategory } from '../../models/issue';
import { createLogger } from '../../utils/logger';

interface DuplicationConfig {
  enabled: boolean;
  thresholds: {
    minLines: number;
    minTokens: number;
    similarityThreshold: number;
  };
}

interface CodeBlock {
  id: string;
  startLine: number;
  endLine: number;
  tokens: string[];
  hash: string;
  node: any;
  filePath: string;
}

interface DuplicationMatch {
  block1: CodeBlock;
  block2: CodeBlock;
  similarity: number;
  duplicatedLines: number;
}

export class DuplicationDetector extends BaseDetector {
  private defaultConfig: DuplicationConfig = {
    enabled: true,
    thresholds: {
      minLines: 6,
      minTokens: 50,
      similarityThreshold: 0.85
    }
  };

  private duplicationLogger = createLogger('DuplicationDetector');
  private codeBlocks: CodeBlock[] = [];
  private processedFiles = new Set<string>();

  constructor(config?: Partial<DuplicationConfig>) {
    super({ ...config, enabled: config?.enabled ?? true });
    this.config.thresholds = { ...this.defaultConfig.thresholds, ...config?.thresholds };
  }

  detect(file: ParsedFile): Issue[] {
    if (!this.isEnabled()) return [];

    const issues: Issue[] = [];
    
    try {
      const fileBlocks = this.extractCodeBlocks(file);
      this.codeBlocks.push(...fileBlocks);
      this.processedFiles.add(file.path);

      const duplications = this.findDuplications(fileBlocks);
      
      duplications.forEach(duplication => {
        issues.push(this.createDuplicationIssue(file, duplication));
      });

      this.duplicationLogger.debug('Análise de duplicação concluída', {
        file: file.path,
        blocksExtracted: fileBlocks.length,
        duplicationsFound: duplications.length
      });

    } catch (error) {
      this.duplicationLogger.warn('Análise de duplicação falhou', { 
        file: file.path,
        error: (error as Error).message
      });
    }

    return issues;
  }

  private extractCodeBlocks(file: ParsedFile): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    let blockId = 0;

    this.traverseAST(file.ast, file, (node) => {
      if (this.isExtractableNode(node)) {
        const block = this.createCodeBlock(file, node, `${file.path}_${blockId++}`);
        if (this.isValidBlock(block)) {
          blocks.push(block);
        }
      }
    });

    return blocks;
  }

  private traverseAST(node: any, file: ParsedFile, callback: (node: any) => void): void {
    if (!node || typeof node !== 'object') return;

    callback(node);

    for (const key in node) {
      if (key === 'parent' || key === 'leadingComments' || key === 'trailingComments') continue;
      
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(item => this.traverseAST(item, file, callback));
      } else if (child && typeof child === 'object') {
        this.traverseAST(child, file, callback);
      }
    }
  }

  private isExtractableNode(node: any): boolean {
    const extractableTypes = [
      'FunctionDeclaration',
      'FunctionExpression',
      'ArrowFunctionExpression',
      'MethodDefinition',
      'BlockStatement',
      'IfStatement',
      'ForStatement',
      'WhileStatement',
      'SwitchStatement'
    ];

    return extractableTypes.includes(node.type);
  }

  private createCodeBlock(file: ParsedFile, node: any, id: string): CodeBlock {
    const startLine = node.loc?.start?.line || 1;
    const endLine = node.loc?.end?.line || startLine;
    const tokens = this.extractTokens(node);
    const hash = this.calculateHash(tokens);

    return {
      id,
      startLine,
      endLine,
      tokens,
      hash,
      node,
      filePath: file.path
    };
  }

  private isValidBlock(block: CodeBlock): boolean {
    const lineCount = block.endLine - block.startLine + 1;
    const tokenCount = block.tokens.length;
    
    return lineCount >= this.getThreshold('minLines', this.defaultConfig.thresholds.minLines) &&
           tokenCount >= this.getThreshold('minTokens', this.defaultConfig.thresholds.minTokens);
  }

  private extractTokens(node: any): string[] {
    const tokens: string[] = [];

    const extractFromNode = (n: any) => {
      if (!n || typeof n !== 'object') return;

      if (n.type) {
        tokens.push(n.type);
      }

      if (typeof n.operator === 'string') {
        tokens.push(n.operator);
      }

      if (typeof n.name === 'string') {
        tokens.push('IDENTIFIER');
      }

      if (typeof n.value === 'string' || typeof n.value === 'number') {
        tokens.push('LITERAL');
      }

      for (const key in n) {
        if (key === 'parent' || key === 'loc' || key === 'range') continue;
        
        const child = n[key];
        if (Array.isArray(child)) {
          child.forEach(item => extractFromNode(item));
        } else if (child && typeof child === 'object') {
          extractFromNode(child);
        }
      }
    };

    extractFromNode(node);
    return tokens;
  }

  private calculateHash(tokens: string[]): string {
    const tokenString = tokens.join('|');
    let hash = 0;
    
    for (let i = 0; i < tokenString.length; i++) {
      const char = tokenString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return hash.toString(36);
  }

  private findDuplications(currentBlocks: CodeBlock[]): DuplicationMatch[] {
    const duplications: DuplicationMatch[] = [];
    const threshold = this.getThreshold('similarityThreshold', this.defaultConfig.thresholds.similarityThreshold);

    for (const block1 of currentBlocks) {
      for (const block2 of this.codeBlocks) {
        if (block1.id === block2.id || block1.filePath === block2.filePath) continue;

        const similarity = this.calculateSimilarity(block1, block2);
        
        if (similarity >= threshold) {
          const duplicatedLines = Math.min(
            block1.endLine - block1.startLine + 1,
            block2.endLine - block2.startLine + 1
          );

          duplications.push({
            block1,
            block2,
            similarity,
            duplicatedLines
          });
        }
      }
    }

    return this.deduplicateMatches(duplications);
  }

  private calculateSimilarity(block1: CodeBlock, block2: CodeBlock): number {
    if (block1.hash === block2.hash) return 1.0;

    const tokens1 = block1.tokens;
    const tokens2 = block2.tokens;

    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    const commonTokens = this.findCommonTokens(tokens1, tokens2);
    const maxLength = Math.max(tokens1.length, tokens2.length);
    
    return commonTokens / maxLength;
  }

  private findCommonTokens(tokens1: string[], tokens2: string[]): number {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    
    let common = 0;
    for (const token of set1) {
      if (set2.has(token)) {
        common++;
      }
    }
    
    return common;
  }

  private deduplicateMatches(duplications: DuplicationMatch[]): DuplicationMatch[] {
    const uniqueMatches = new Map<string, DuplicationMatch>();

    duplications.forEach(duplication => {
      const key1 = `${duplication.block1.filePath}:${duplication.block1.startLine}-${duplication.block2.filePath}:${duplication.block2.startLine}`;
      const key2 = `${duplication.block2.filePath}:${duplication.block2.startLine}-${duplication.block1.filePath}:${duplication.block1.startLine}`;

      if (!uniqueMatches.has(key1) && !uniqueMatches.has(key2)) {
        uniqueMatches.set(key1, duplication);
      }
    });

    return Array.from(uniqueMatches.values());
  }

  private createDuplicationIssue(file: ParsedFile, duplication: DuplicationMatch): Issue {
    const severity = this.getSeverityBySimilarity(duplication.similarity, duplication.duplicatedLines);
    const otherFile = duplication.block2.filePath === file.path ? duplication.block1 : duplication.block2;
    
    return IssueBuilder.create()
      .withId(this.generateIssueId())
      .withCategory(IssueCategory.DUPLICATION)
      .withSeverity(severity)
      .withTitle(`Código duplicado detectado (${Math.round(duplication.similarity * 100)}% similar)`)
      .withDescription(`Bloco de código com ${duplication.duplicatedLines} linha(s) é ${Math.round(duplication.similarity * 100)}% similar ao código em ${otherFile.filePath}:${otherFile.startLine}-${otherFile.endLine}.`)
      .withSuggestion(`Extraia o código duplicado em uma função ou módulo reutilizável. Considere criar uma função utilitária que possa ser importada em ambos os locais.`)
      .withLocation(this.createLocation(file, duplication.block1.node))
      .withCodeSnippet(this.extractCodeSnippet(file, this.createLocation(file, duplication.block1.node)))
      .withRule('codigo-duplicado')
      .build();
  }

  private getSeverityBySimilarity(similarity: number, duplicatedLines: number): IssueSeverity {
    if (similarity >= 0.95 && duplicatedLines >= 20) return IssueSeverity.CRITICAL;
    if (similarity >= 0.90 && duplicatedLines >= 15) return IssueSeverity.HIGH;
    if (similarity >= 0.85 && duplicatedLines >= 10) return IssueSeverity.MEDIUM;
    return IssueSeverity.LOW;
  }

  reset(): void {
    this.codeBlocks = [];
    this.processedFiles.clear();
    this.duplicationLogger.debug('Cache de duplicação resetado');
  }

  getStats(): { totalBlocks: number; processedFiles: number } {
    return {
      totalBlocks: this.codeBlocks.length,
      processedFiles: this.processedFiles.size
    };
  }
}