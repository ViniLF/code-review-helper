import { parse as babelParse } from '@babel/parser';
import * as fs from 'fs';
import * as path from 'path';
import { ParsedFile } from '../detectors/base/detector';
import { createLogger } from '../utils/logger';

export interface ParserOptions {
  language?: string;
  sourceType?: 'module' | 'script';
  allowImportExportEverywhere?: boolean;
  allowReturnOutsideFunction?: boolean;
  plugins?: string[];
}

export class Parser {
  private defaultOptions: ParserOptions = {
    language: 'javascript',
    sourceType: 'module',
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction: true,
    plugins: [
      'jsx',
      'typescript',
      'decorators-legacy',
      'classProperties',
      'objectRestSpread',
      'asyncGenerators',
      'functionBind',
      'exportDefaultFrom',
      'exportNamespaceFrom',
      'dynamicImport',
      'nullishCoalescingOperator',
      'optionalChaining'
    ]
  };

  private parserLogger = createLogger('Parser');
  private parseCache = new Map<string, { content: string; ast: any; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  constructor(private options: ParserOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  async parseFile(filePath: string): Promise<ParsedFile> {
    try {
      const stats = fs.statSync(filePath);
      const cacheKey = `${filePath}:${stats.mtimeMs}`;
      
      const cached = this.parseCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
        this.parserLogger.debug('Cache hit', { filePath });
        return {
          path: filePath,
          content: cached.content,
          ast: cached.ast,
          linesOfCode: this.calculateLinesOfCode(cached.content)
        };
      }

      const content = await this.readFile(filePath);
      const ast = this.parseContent(content, filePath);
      const linesOfCode = this.calculateLinesOfCode(content);

      this.parseCache.set(cacheKey, {
        content,
        ast,
        timestamp: Date.now()
      });

      this.cleanupCache();

      return {
        path: filePath,
        content,
        ast,
        linesOfCode
      };
    } catch (error) {
      this.parserLogger.error('Falha ao fazer parse do arquivo', error as Error, { filePath });
      throw new Error(`Falha ao fazer parse do arquivo ${filePath}: ${(error as Error).message}`);
    }
  }

  parseContent(content: string, filePath?: string): any {
    try {
      const fileExtension = filePath ? path.extname(filePath) : '.js';
      const parserOptions = this.getParserOptionsForFile(fileExtension);

      return babelParse(content, parserOptions);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unexpected token')) {
        this.parserLogger.debug('Tentando fallback parsing', { filePath });
        return this.parseWithFallback(content, filePath);
      }
      throw error;
    }
  }

  private async readFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          this.parserLogger.error('Erro ao ler arquivo', err, { filePath });
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  private getParserOptionsForFile(extension: string): any {
    const baseOptions: any = {
      sourceType: this.options.sourceType,
      allowImportExportEverywhere: this.options.allowImportExportEverywhere,
      allowReturnOutsideFunction: this.options.allowReturnOutsideFunction,
      plugins: [...(this.options.plugins || [])],
      errorRecovery: true
    };

    switch (extension.toLowerCase()) {
      case '.ts':
      case '.tsx':
        return {
          ...baseOptions,
          plugins: [
            ...baseOptions.plugins,
            'typescript',
            extension === '.tsx' ? 'jsx' : null
          ].filter(Boolean)
        };

      case '.jsx':
        return {
          ...baseOptions,
          plugins: [...baseOptions.plugins, 'jsx']
        };

      case '.mjs':
        return {
          ...baseOptions,
          sourceType: 'module'
        };

      case '.cjs':
        return {
          ...baseOptions,
          sourceType: 'script'
        };

      case '.js':
      default:
        return baseOptions;
    }
  }

  private parseWithFallback(content: string, filePath?: string): any {
    const fallbackOptions: any[] = [
      { sourceType: 'script' as const, plugins: this.options.plugins, errorRecovery: true },
      { sourceType: 'module' as const, plugins: ['jsx', 'typescript'], errorRecovery: true },
      { sourceType: 'module' as const, plugins: [], errorRecovery: true },
      { sourceType: 'script' as const, plugins: [], errorRecovery: true }
    ];

    for (let i = 0; i < fallbackOptions.length; i++) {
      try {
        const option = fallbackOptions[i];
        this.parserLogger.debug('Tentativa de fallback', { 
          filePath, 
          attempt: i + 1, 
          sourceType: option.sourceType 
        });

        return babelParse(content, {
          ...option,
          allowImportExportEverywhere: true,
          allowReturnOutsideFunction: true
        });
      } catch (error) {
        if (i === fallbackOptions.length - 1) {
          this.parserLogger.error('Todas as opções de fallback falharam', error as Error, { filePath });
          throw new Error(`Não foi possível fazer parse do arquivo ${filePath || 'content'} com nenhuma das opções disponíveis`);
        }
        continue;
      }
    }

    throw new Error('Fallback parsing failed unexpectedly');
  }

  private calculateLinesOfCode(content: string): number {
    const lines = content.split('\n');
    let linesOfCode = 0;
    let inBlockComment = false;

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.length === 0) continue;
      
      if (trimmed.startsWith('/*')) inBlockComment = true;
      if (inBlockComment) {
        if (trimmed.endsWith('*/')) inBlockComment = false;
        continue;
      }
      
      if (trimmed.startsWith('//')) continue;
      if (trimmed === '/*' || trimmed === '*/') continue;
      
      linesOfCode++;
    }

    return linesOfCode;
  }

  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, cached] of this.parseCache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.parseCache.delete(key));

    if (keysToDelete.length > 0) {
      this.parserLogger.debug('Cache cleanup', { removedEntries: keysToDelete.length });
    }
  }

  getSupportedExtensions(): string[] {
    return ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
  }

  isSupported(filePath: string): boolean {
    const extension = path.extname(filePath).toLowerCase();
    return this.getSupportedExtensions().includes(extension);
  }

  updateOptions(newOptions: Partial<ParserOptions>): void {
    this.options = { ...this.options, ...newOptions };
    this.parseCache.clear();
    this.parserLogger.debug('Opções do parser atualizadas', { newOptions });
  }

  getOptions(): ParserOptions {
    return { ...this.options };
  }

  clearCache(): void {
    this.parseCache.clear();
    this.parserLogger.debug('Cache do parser limpo');
  }

  getCacheStats(): { size: number; oldestEntry: number | null } {
    const now = Date.now();
    let oldestEntry: number | null = null;

    for (const cached of this.parseCache.values()) {
      if (oldestEntry === null || cached.timestamp < oldestEntry) {
        oldestEntry = cached.timestamp;
      }
    }

    return {
      size: this.parseCache.size,
      oldestEntry: oldestEntry ? now - oldestEntry : null
    };
  }
}