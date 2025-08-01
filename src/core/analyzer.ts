import { Parser } from './parser';
import { Report, ReportBuilder, FileAnalysis, AnalysisOptions } from '../models/report';
import { Issue } from '../models/issue';
import { createDetectorsForLanguage } from '../detectors';
import { ConfigManager, RevisorConfig } from '../config/config-manager';
import { logger, createLogger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

export interface AnalyzerConfig {
  parser?: {
    sourceType?: 'module' | 'script';
    plugins?: string[];
  };
  detectors?: {
    [key: string]: any;
  };
  performance?: {
    maxConcurrentFiles?: number;
    timeoutMs?: number;
  };
  security?: {
    allowedPaths?: string[];
    maxFileSize?: number;
  };
}

export class Analyzer {
  private parser: Parser;
  private config: AnalyzerConfig;
  private revisorConfig!: RevisorConfig;
  private analyzerLogger = createLogger('Analyzer');

  constructor(config: AnalyzerConfig = {}, projectPath?: string) {
    this.config = {
      performance: {
        maxConcurrentFiles: 10,
        timeoutMs: 30000,
        ...config.performance
      },
      security: {
        maxFileSize: 1024 * 1024 * 5,
        ...config.security
      },
      ...config
    };

    this.parser = new Parser(config.parser);
    this.initializeConfig(projectPath);
  }

  private initializeConfig(projectPath?: string): void {
    ConfigManager.loadConfig(projectPath)
      .then(config => {
        this.revisorConfig = config;
        this.updateInternalConfig();
      })
      .catch(error => {
        this.analyzerLogger.error('Erro ao carregar configuração externa', error as Error);
        return ConfigManager.loadConfig();
      })
      .then(fallbackConfig => {
        if (!this.revisorConfig) {
          this.revisorConfig = fallbackConfig!;
          this.updateInternalConfig();
        }
      });
  }

  private updateInternalConfig(): void {
    this.config.performance = {
      ...this.config.performance,
      maxConcurrentFiles: this.revisorConfig.performance.maxConcurrentFiles,
      timeoutMs: this.revisorConfig.performance.timeoutMs
    };

    this.config.security = {
      ...this.config.security,
      maxFileSize: this.revisorConfig.security.maxFileSize,
      allowedPaths: this.revisorConfig.security.allowedPaths
    };

    this.analyzerLogger.debug('Configuração externa carregada', {
      detectorsEnabled: Object.entries(this.revisorConfig.detectors)
        .filter(([, config]) => config.enabled)
        .map(([name]) => name),
      performanceSettings: this.revisorConfig.performance
    });
  }

  private async loadRevisorConfig(projectPath?: string): Promise<void> {
    try {
      this.revisorConfig = await ConfigManager.loadConfig(projectPath);
      this.updateInternalConfig();
    } catch (error) {
      this.analyzerLogger.error('Erro ao carregar configuração externa', error as Error);
      this.revisorConfig = await ConfigManager.loadConfig();
      this.updateInternalConfig();
    }
  }

  async analyze(targetPath: string, options?: Partial<AnalysisOptions>): Promise<Report> {
    const startTime = Date.now();
    
    try {
      await this.loadRevisorConfig(path.dirname(targetPath));

      const analysisOptions: AnalysisOptions = {
        language: options?.language || 'javascript',
        includePatterns: options?.includePatterns || this.revisorConfig.analysis.includePatterns,
        excludePatterns: options?.excludePatterns || this.revisorConfig.analysis.excludePatterns
      };

      this.analyzerLogger.info('Iniciando análise', { 
        targetPath, 
        language: analysisOptions.language,
        configSource: this.revisorConfig ? 'external' : 'default'
      });
      
      this.validatePath(targetPath);
      
      const filePaths = await this.getFilesToAnalyze(targetPath, analysisOptions);
      
      if (filePaths.length === 0) {
        this.analyzerLogger.warn('Nenhum arquivo encontrado para análise');
        return this.createEmptyReport(analysisOptions);
      }

      this.analyzerLogger.info('Arquivos encontrados', { count: filePaths.length });

      const detectors = createDetectorsForLanguage(
        analysisOptions.language, 
        this.revisorConfig.detectors
      );
      
      if (detectors.length === 0) {
        this.analyzerLogger.warn('Nenhum detector disponível', { language: analysisOptions.language });
        return this.createEmptyReport(analysisOptions);
      }

      this.analyzerLogger.debug('Detectores carregados', { 
        count: detectors.length, 
        names: detectors.map(d => d.getName()),
        enabledFromConfig: Object.entries(this.revisorConfig.detectors)
          .filter(([, config]) => config.enabled)
          .map(([name]) => name)
      });

      const reportBuilder = ReportBuilder.create().withOptions(analysisOptions);
      const analysisPromises = filePaths.map(filePath => 
        this.analyzeFile(filePath, detectors)
      );

      const batchSize = this.config.performance?.maxConcurrentFiles || 10;
      const fileAnalyses: FileAnalysis[] = [];

      for (let i = 0; i < analysisPromises.length; i += batchSize) {
        const batch = analysisPromises.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(batch);
        
        batchResults.forEach((result, index) => {
          const actualIndex = i + index;
          if (result.status === 'fulfilled' && result.value) {
            fileAnalyses.push(result.value);
            if ((actualIndex + 1) % 10 === 0 || actualIndex === filePaths.length - 1) {
              this.analyzerLogger.debug('Progresso da análise', { 
                analyzed: actualIndex + 1, 
                total: filePaths.length,
                percentage: Math.round(((actualIndex + 1) / filePaths.length) * 100)
              });
            }
          } else {
            this.analyzerLogger.error('Falha ao analisar arquivo', 
              result.status === 'rejected' ? result.reason : new Error('Erro desconhecido'),
              { filePath: filePaths[actualIndex] }
            );
          }
        });
      }

      fileAnalyses.forEach(analysis => reportBuilder.addFile(analysis));
      const report = reportBuilder.build();

      const duration = Date.now() - startTime;
      this.analyzerLogger.info('Análise concluída', {
        duration,
        score: report.summary.overallScore,
        issues: report.summary.totalIssues,
        files: report.summary.totalFiles,
        averageScore: Math.round(fileAnalyses.reduce((sum, f) => sum + f.score, 0) / fileAnalyses.length || 0),
        criticalIssues: report.topIssues.filter(i => i.severity === 'critical').length
      });

      return report;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.analyzerLogger.error('Análise falhou', error as Error, { duration });
      throw error;
    }
  }

  private validatePath(targetPath: string): void {
    if (!fs.existsSync(targetPath)) {
      throw new Error(`Caminho não existe: ${targetPath}`);
    }

    const resolvedPath = path.resolve(targetPath);
    const cwd = process.cwd();

    if (!resolvedPath.startsWith(cwd) && !this.isAllowedPath(resolvedPath)) {
      throw new Error(`Acesso negado ao caminho: ${targetPath}`);
    }
  }

  private isAllowedPath(targetPath: string): boolean {
    const allowedPaths = this.config.security?.allowedPaths || [];
    return allowedPaths.some(allowedPath => {
      const resolvedAllowed = path.resolve(allowedPath);
      return targetPath.startsWith(resolvedAllowed);
    });
  }

  private async getFilesToAnalyze(targetPath: string, options: AnalysisOptions): Promise<string[]> {
    const stats = fs.statSync(targetPath);
    
    if (stats.isFile()) {
      this.validateFileSize(targetPath);
      return this.parser.isSupported(targetPath) ? [targetPath] : [];
    }

    const includePatterns = options.includePatterns.map(pattern => 
      path.join(targetPath, pattern).replace(/\\/g, '/')
    );
    
    const excludePatterns = options.excludePatterns.map(pattern =>
      path.join(targetPath, pattern).replace(/\\/g, '/')
    );

    const allFiles: string[] = [];
    
    for (const pattern of includePatterns) {
      try {
        const files = glob.sync(pattern, { 
          ignore: excludePatterns,
          nodir: true,
          absolute: true
        });
        allFiles.push(...files);
      } catch (error) {
        this.analyzerLogger.warn('Erro ao processar padrão glob', { 
          pattern, 
          error: (error as Error).message 
        });
      }
    }

    const uniqueFiles = [...new Set(allFiles)];
    const supportedFiles = uniqueFiles.filter(file => {
      try {
        this.validateFileSize(file);
        return this.parser.isSupported(file);
      } catch (error) {
        this.analyzerLogger.warn('Arquivo ignorado', { 
          file: path.relative(process.cwd(), file), 
          reason: (error as Error).message 
        });
        return false;
      }
    });

    const skippedCount = uniqueFiles.length - supportedFiles.length;
    if (skippedCount > 0) {
      this.analyzerLogger.info('Arquivos filtrados', { 
        total: uniqueFiles.length,
        supported: supportedFiles.length,
        skipped: skippedCount
      });
    }

    return supportedFiles;
  }

  private validateFileSize(filePath: string): void {
    const maxSize = this.config.security?.maxFileSize || 1024 * 1024 * 5;
    const stats = fs.statSync(filePath);
    
    if (stats.size > maxSize) {
      throw new Error(`Arquivo muito grande: ${Math.round(stats.size / 1024 / 1024)}MB (máx: ${Math.round(maxSize / 1024 / 1024)}MB)`);
    }
  }

  private async analyzeFile(filePath: string, detectors: any[]): Promise<FileAnalysis | null> {
    try {
      const parsedFile = await this.parser.parseFile(filePath);
      const allIssues: Issue[] = [];
      
      for (const detector of detectors) {
        try {
          const issues = detector.detect(parsedFile);
          allIssues.push(...issues);
        } catch (error) {
          this.analyzerLogger.warn('Detector falhou', { 
            detector: detector.getName(), 
            file: path.relative(process.cwd(), filePath),
            error: (error as Error).message
          });
        }
      }

      const score = this.calculateFileScore(allIssues, parsedFile.linesOfCode);

      return {
        path: this.getRelativePath(filePath),
        linesOfCode: parsedFile.linesOfCode,
        issues: allIssues,
        score
      };

    } catch (error) {
      this.analyzerLogger.error('Falha ao analisar arquivo', error as Error, { 
        filePath: path.relative(process.cwd(), filePath) 
      });
      return null;
    }
  }

  private calculateFileScore(issues: Issue[], linesOfCode: number): number {
    if (issues.length === 0) return 100;

    let penalty = 0;
    
    issues.forEach(issue => {
      switch (issue.severity) {
        case 'critical': penalty += 10; break;
        case 'high': penalty += 5; break;
        case 'medium': penalty += 2; break;
        case 'low': penalty += 1; break;
      }
    });

    const sizeAdjustment = Math.min(linesOfCode / 100, 2);
    const adjustedPenalty = penalty / (1 + sizeAdjustment * 0.1);
    const score = Math.max(0, 100 - adjustedPenalty);
    
    return Math.round(score * 100) / 100;
  }

  private getRelativePath(absolutePath: string): string {
    const cwd = process.cwd();
    return path.relative(cwd, absolutePath);
  }

  private createEmptyReport(options: AnalysisOptions): Report {
    return ReportBuilder.create()
      .withOptions(options)
      .build();
  }

  async createConfigFile(projectPath?: string): Promise<string> {
    return ConfigManager.createDefaultConfig(projectPath);
  }

  getRevisorConfig(): RevisorConfig {
    return this.revisorConfig;
  }

  updateConfig(newConfig: Partial<AnalyzerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.parser) {
      this.parser.updateOptions(newConfig.parser);
    }
  }

  getConfig(): AnalyzerConfig {
    return { ...this.config };
  }

  getSupportedLanguages(): string[] {
    return this.revisorConfig?.analysis.languages || ['javascript', 'typescript'];
  }

  getSupportedExtensions(): string[] {
    return this.parser.getSupportedExtensions();
  }
}