import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';

export interface RevisorConfig {
  detectors: {
    complexity: {
      enabled: boolean;
      thresholds: {
        function: number;
        file: number;
      };
    };
    naming: {
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
    };
    size: {
      enabled: boolean;
      thresholds: {
        fileLines: number;
        functionLines: number;
        functionParameters: number;
        classLines: number;
        methodLines: number;
      };
    };
    duplication: {
      enabled: boolean;
      thresholds: {
        minLines: number;
        minTokens: number;
        similarityThreshold: number;
      };
    };
  };
  output: {
    format: 'console' | 'json' | 'html';
    verbose: boolean;
    maxIssuesPerFile: number;
    showCodeSnippets: boolean;
    colorOutput: boolean;
  };
  performance: {
    maxConcurrentFiles: number;
    enableCaching: boolean;
    cacheDir: string;
    timeoutMs: number;
  };
  security: {
    maxFileSize: number;
    allowedPaths: string[];
  };
  analysis: {
    includePatterns: string[];
    excludePatterns: string[];
    languages: string[];
  };
}

export class ConfigManager {
  private static readonly CONFIG_FILES = [
    '.revisor-config.json',
    'revisor.config.json'
  ];

  private static readonly DEFAULT_CONFIG: RevisorConfig = {
    detectors: {
      complexity: {
        enabled: true,
        thresholds: {
          function: 10,
          file: 20
        }
      },
      naming: {
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
      },
      size: {
        enabled: true,
        thresholds: {
          fileLines: 300,
          functionLines: 50,
          functionParameters: 5,
          classLines: 200,
          methodLines: 30
        }
      },
      duplication: {
        enabled: true,
        thresholds: {
          minLines: 6,
          minTokens: 50,
          similarityThreshold: 0.85
        }
      }
    },
    output: {
      format: 'console',
      verbose: false,
      maxIssuesPerFile: 10,
      showCodeSnippets: true,
      colorOutput: true
    },
    performance: {
      maxConcurrentFiles: 10,
      enableCaching: true,
      cacheDir: '.revisor-cache',
      timeoutMs: 30000
    },
    security: {
      maxFileSize: 5 * 1024 * 1024,
      allowedPaths: []
    },
    analysis: {
      includePatterns: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
      excludePatterns: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '**/*.test.*',
        '**/*.spec.*',
        'coverage/**',
        '.git/**',
        '**/*.min.js',
        '**/*.bundle.js'
      ],
      languages: ['javascript', 'typescript']
    }
  };

  private static configLogger = createLogger('ConfigManager');

  static async loadConfig(projectPath: string = process.cwd()): Promise<RevisorConfig> {
    try {
      const configPath = await this.findConfigFile(projectPath);
      
      if (configPath) {
        this.configLogger.info('Arquivo de configuração encontrado', { configPath });
        return this.loadFromFile(configPath);
      }

      this.configLogger.info('Usando configuração padrão');
      return this.DEFAULT_CONFIG;
    } catch (error) {
      this.configLogger.error('Erro ao carregar configuração', error as Error);
      this.configLogger.info('Fallback para configuração padrão');
      return this.DEFAULT_CONFIG;
    }
  }

  static async createDefaultConfig(projectPath: string = process.cwd()): Promise<string> {
    const configPath = path.join(projectPath, '.revisor-config.json');
    
    try {
      await fs.promises.writeFile(
        configPath,
        JSON.stringify(this.DEFAULT_CONFIG, null, 2),
        'utf8'
      );
      
      this.configLogger.info('Arquivo de configuração padrão criado', { configPath });
      return configPath;
    } catch (error) {
      this.configLogger.error('Erro ao criar arquivo de configuração', error as Error);
      throw new Error(`Falha ao criar configuração: ${(error as Error).message}`);
    }
  }

  static validateConfig(config: any): RevisorConfig {
    const validatedConfig = { ...this.DEFAULT_CONFIG };

    try {
      if (config.detectors) {
        this.mergeDetectorConfig(validatedConfig.detectors, config.detectors);
      }

      if (config.output) {
        this.mergeOutputConfig(validatedConfig.output, config.output);
      }

      if (config.performance) {
        this.mergePerformanceConfig(validatedConfig.performance, config.performance);
      }

      if (config.security) {
        this.mergeSecurityConfig(validatedConfig.security, config.security);
      }

      if (config.analysis) {
        this.mergeAnalysisConfig(validatedConfig.analysis, config.analysis);
      }

      this.configLogger.debug('Configuração validada com sucesso');
      return validatedConfig;
    } catch (error) {
      this.configLogger.warn('Erro na validação, usando configuração padrão', { error: (error as Error).message });
      return this.DEFAULT_CONFIG;
    }
  }

  private static async findConfigFile(projectPath: string): Promise<string | null> {
    for (const configFile of this.CONFIG_FILES) {
      const fullPath = path.join(projectPath, configFile);
      
      if (await this.fileExists(fullPath)) {
        return fullPath;
      }
    }
    return null;
  }

  private static async loadFromFile(configPath: string): Promise<RevisorConfig> {
    try {
      const content = await fs.promises.readFile(configPath, 'utf8');
      const rawConfig = JSON.parse(content);
      
      return this.validateConfig(rawConfig);
    } catch (error) {
      throw new Error(`Erro ao processar ${configPath}: ${(error as Error).message}`);
    }
  }

  private static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private static mergeDetectorConfig(target: RevisorConfig['detectors'], source: any): void {
    if (source.complexity) {
      target.complexity = {
        enabled: source.complexity.enabled ?? target.complexity.enabled,
        thresholds: {
          function: this.validateNumber(source.complexity.thresholds?.function, 1, 50, target.complexity.thresholds.function),
          file: this.validateNumber(source.complexity.thresholds?.file, 1, 100, target.complexity.thresholds.file)
        }
      };
    }

    if (source.naming) {
      target.naming = {
        enabled: source.naming.enabled ?? target.naming.enabled,
        thresholds: {
          minLength: this.validateNumber(source.naming.thresholds?.minLength, 1, 10, target.naming.thresholds.minLength),
          maxLength: this.validateNumber(source.naming.thresholds?.maxLength, 5, 100, target.naming.thresholds.maxLength)
        },
        patterns: {
          camelCase: source.naming.patterns?.camelCase ?? target.naming.patterns.camelCase,
          constants: source.naming.patterns?.constants ?? target.naming.patterns.constants,
          functions: source.naming.patterns?.functions ?? target.naming.patterns.functions,
          variables: source.naming.patterns?.variables ?? target.naming.patterns.variables
        }
      };
    }

    if (source.size) {
      target.size = {
        enabled: source.size.enabled ?? target.size.enabled,
        thresholds: {
          fileLines: this.validateNumber(source.size.thresholds?.fileLines, 50, 2000, target.size.thresholds.fileLines),
          functionLines: this.validateNumber(source.size.thresholds?.functionLines, 10, 500, target.size.thresholds.functionLines),
          functionParameters: this.validateNumber(source.size.thresholds?.functionParameters, 2, 20, target.size.thresholds.functionParameters),
          classLines: this.validateNumber(source.size.thresholds?.classLines, 50, 1000, target.size.thresholds.classLines),
          methodLines: this.validateNumber(source.size.thresholds?.methodLines, 5, 200, target.size.thresholds.methodLines)
        }
      };
    }

    if (source.duplication) {
      target.duplication = {
        enabled: source.duplication.enabled ?? target.duplication.enabled,
        thresholds: {
          minLines: this.validateNumber(source.duplication.thresholds?.minLines, 3, 50, target.duplication.thresholds.minLines),
          minTokens: this.validateNumber(source.duplication.thresholds?.minTokens, 10, 500, target.duplication.thresholds.minTokens),
          similarityThreshold: this.validateNumber(source.duplication.thresholds?.similarityThreshold, 0.5, 1.0, target.duplication.thresholds.similarityThreshold)
        }
      };
    }
  }

  private static mergeOutputConfig(target: RevisorConfig['output'], source: any): void {
    target.format = ['console', 'json', 'html'].includes(source.format) ? source.format : target.format;
    target.verbose = typeof source.verbose === 'boolean' ? source.verbose : target.verbose;
    target.maxIssuesPerFile = this.validateNumber(source.maxIssuesPerFile, 1, 100, target.maxIssuesPerFile);
    target.showCodeSnippets = typeof source.showCodeSnippets === 'boolean' ? source.showCodeSnippets : target.showCodeSnippets;
    target.colorOutput = typeof source.colorOutput === 'boolean' ? source.colorOutput : target.colorOutput;
  }

  private static mergePerformanceConfig(target: RevisorConfig['performance'], source: any): void {
    target.maxConcurrentFiles = this.validateNumber(source.maxConcurrentFiles, 1, 50, target.maxConcurrentFiles);
    target.enableCaching = typeof source.enableCaching === 'boolean' ? source.enableCaching : target.enableCaching;
    target.cacheDir = typeof source.cacheDir === 'string' ? source.cacheDir : target.cacheDir;
    target.timeoutMs = this.validateNumber(source.timeoutMs, 1000, 300000, target.timeoutMs);
  }

  private static mergeSecurityConfig(target: RevisorConfig['security'], source: any): void {
    target.maxFileSize = this.validateNumber(source.maxFileSize, 1024, 100 * 1024 * 1024, target.maxFileSize);
    target.allowedPaths = Array.isArray(source.allowedPaths) ? source.allowedPaths : target.allowedPaths;
  }

  private static mergeAnalysisConfig(target: RevisorConfig['analysis'], source: any): void {
    target.includePatterns = Array.isArray(source.includePatterns) ? source.includePatterns : target.includePatterns;
    target.excludePatterns = Array.isArray(source.excludePatterns) ? source.excludePatterns : target.excludePatterns;
    target.languages = Array.isArray(source.languages) ? source.languages : target.languages;
  }

  private static validateNumber(value: any, min: number, max: number, defaultValue: number): number {
    if (typeof value !== 'number' || isNaN(value) || value < min || value > max) {
      return defaultValue;
    }
    return value;
  }

  static getConfigSchema(): object {
    return {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "Revisor de Código - Configuração",
      type: "object",
      properties: {
        detectors: {
          type: "object",
          properties: {
            complexity: {
              type: "object",
              properties: {
                enabled: { type: "boolean" },
                thresholds: {
                  type: "object",
                  properties: {
                    function: { type: "number", minimum: 1, maximum: 50 },
                    file: { type: "number", minimum: 1, maximum: 100 }
                  }
                }
              }
            }
          }
        }
      }
    };
  }
}