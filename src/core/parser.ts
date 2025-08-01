import { parse as babelParse } from '@babel/parser';
import * as fs from 'fs';
import * as path from 'path';
import { ParsedFile } from '../detectors/base/detector';

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

  constructor(private options: ParserOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  async parseFile(filePath: string): Promise<ParsedFile> {
    try {
      const content = await this.readFile(filePath);
      const ast = this.parseContent(content, filePath);
      const linesOfCode = this.calculateLinesOfCode(content);

      return {
        path: filePath,
        content,
        ast,
        linesOfCode
      };
    } catch (error) {
      throw new Error(`Falha ao fazer parse do arquivo ${filePath}: ${error instanceof Error ? error.message : error}`);
    }
  }

  parseContent(content: string, filePath?: string): any {
    try {
      const fileExtension = filePath ? path.extname(filePath) : '.js';
      const parserOptions = this.getParserOptionsForFile(fileExtension);

      return babelParse(content, parserOptions);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unexpected token')) {
        // Tentar com diferentes opções de parser para casos especiais
        return this.parseWithFallback(content, filePath);
      }
      throw error;
    }
  }

  private async readFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  private getParserOptionsForFile(extension: string): any {
    const baseOptions: any = {
      sourceType: this.options.sourceType,
      allowImportExportEverywhere: this.options.allowImportExportEverywhere,
      allowReturnOutsideFunction: this.options.allowReturnOutsideFunction,
      plugins: [...(this.options.plugins || [])]
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
      // Tentar como script em vez de module
      { sourceType: 'script' as const, plugins: this.options.plugins },
      
      // Tentar com plugins mínimos
      { sourceType: 'module' as const, plugins: ['jsx', 'typescript'] },
      
      // Tentar sem plugins
      { sourceType: 'module' as const, plugins: [] },
      
      // Última tentativa - script sem plugins
      { sourceType: 'script' as const, plugins: [] }
    ];

    for (const fallbackOption of fallbackOptions) {
      try {
        return babelParse(content, {
          ...fallbackOption,
          allowImportExportEverywhere: true,
          allowReturnOutsideFunction: true
        });
      } catch (error) {
        // Continuar para próxima opção de fallback
        continue;
      }
    }

    throw new Error(`Não foi possível fazer parse do arquivo ${filePath || 'content'} com nenhuma das opções disponíveis`);
  }

  private calculateLinesOfCode(content: string): number {
    const lines = content.split('\n');
    let linesOfCode = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Pular linhas vazias
      if (trimmed.length === 0) continue;
      
      // Pular comentários de linha única
      if (trimmed.startsWith('//')) continue;
      
      // Pular linhas que são apenas início/fim de comentário de bloco
      if (trimmed === '/*' || trimmed === '*/') continue;
      
      linesOfCode++;
    }

    return linesOfCode;
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
  }

  getOptions(): ParserOptions {
    return { ...this.options };
  }
}