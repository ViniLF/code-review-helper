import { Parser } from './parser';
import { Report, ReportBuilder, FileAnalysis, AnalysisOptions } from '../models/report';
import { Issue } from '../models/issue';
import { createDetectorsForLanguage } from '../detectors';
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
}

export class Analyzer {
  private parser: Parser;
  private config: AnalyzerConfig;

  constructor(config: AnalyzerConfig = {}) {
    this.config = {
      performance: {
        maxConcurrentFiles: 10,
        timeoutMs: 30000,
        ...config.performance
      },
      ...config
    };

    this.parser = new Parser(config.parser);
  }

  async analyze(targetPath: string, options: AnalysisOptions): Promise<Report> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Iniciando análise de: ${targetPath}`);
      
      // Validar caminho de destino
      if (!fs.existsSync(targetPath)) {
        throw new Error(`Caminho não existe: ${targetPath}`);
      }

      // Obter arquivos para analisar
      const filePaths = await this.getFilesToAnalyze(targetPath, options);
      
      if (filePaths.length === 0) {
        console.log('⚠️  Nenhum arquivo encontrado para análise');
        return this.createEmptyReport(options);
      }

      console.log(`📁 Encontrados ${filePaths.length} arquivos para análise`);

      // Criar detectores
      const detectors = createDetectorsForLanguage(options.language, this.config.detectors);
      
      if (detectors.length === 0) {
        console.log(`⚠️  Nenhum detector disponível para a linguagem: ${options.language}`);
        return this.createEmptyReport(options);
      }

      console.log(`🔧 Usando ${detectors.length} detectores: ${detectors.map(d => d.getName()).join(', ')}`);

      // Analisar arquivos
      const reportBuilder = ReportBuilder.create().withOptions(options);
      const analysisPromises = filePaths.map(filePath => 
        this.analyzeFile(filePath, detectors)
      );

      // Processar arquivos em lotes para evitar sobrecarregar o sistema
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
              console.log(`📊 Analisados ${actualIndex + 1}/${filePaths.length} arquivos`);
            }
          } else {
            console.warn(`❌ Falha ao analisar ${filePaths[actualIndex]}: ${result.status === 'rejected' ? result.reason : 'Erro desconhecido'}`);
          }
        });
      }

      // Construir relatório final
      fileAnalyses.forEach(analysis => reportBuilder.addFile(analysis));
      const report = reportBuilder.build();

      const duration = Date.now() - startTime;
      console.log(`✅ Análise concluída em ${duration}ms`);
      console.log(`📈 Pontuação Geral: ${report.summary.overallScore}/100`);
      console.log(`🚨 Total de Problemas: ${report.summary.totalIssues}`);

      return report;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Análise falhou após ${duration}ms:`, error instanceof Error ? error.message : error);
      throw error;
    }
  }

  private async getFilesToAnalyze(targetPath: string, options: AnalysisOptions): Promise<string[]> {
    const stats = fs.statSync(targetPath);
    
    if (stats.isFile()) {
      return this.parser.isSupported(targetPath) ? [targetPath] : [];
    }

    // Análise de diretório - usar padrões glob
    const includePatterns = options.includePatterns.map(pattern => 
      path.join(targetPath, pattern).replace(/\\/g, '/')
    );
    
    const excludePatterns = options.excludePatterns.map(pattern =>
      path.join(targetPath, pattern).replace(/\\/g, '/')
    );

    const allFiles: string[] = [];
    
    // Encontrar arquivos que correspondem aos padrões de inclusão
    for (const pattern of includePatterns) {
      const files = glob.sync(pattern, { 
        ignore: excludePatterns,
        nodir: true,
        absolute: true
      });
      allFiles.push(...files);
    }

    // Remover duplicatas e filtrar arquivos suportados
    const uniqueFiles = [...new Set(allFiles)];
    return uniqueFiles.filter(file => this.parser.isSupported(file));
  }

  private async analyzeFile(filePath: string, detectors: any[]): Promise<FileAnalysis | null> {
    try {
      // Fazer parse do arquivo
      const parsedFile = await this.parser.parseFile(filePath);
      
      // Executar todos os detectores
      const allIssues: Issue[] = [];
      
      for (const detector of detectors) {
        try {
          const issues = detector.detect(parsedFile);
          allIssues.push(...issues);
        } catch (error) {
          console.warn(`⚠️  Detector ${detector.getName()} falhou para ${filePath}:`, error instanceof Error ? error.message : error);
        }
      }

      // Calcular pontuação do arquivo
      const score = this.calculateFileScore(allIssues, parsedFile.linesOfCode);

      return {
        path: this.getRelativePath(filePath),
        linesOfCode: parsedFile.linesOfCode,
        issues: allIssues,
        score
      };

    } catch (error) {
      console.warn(`❌ Falha ao analisar arquivo ${filePath}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  private calculateFileScore(issues: Issue[], linesOfCode: number): number {
    if (issues.length === 0) return 100;

    // Algoritmo base de pontuação
    let penalty = 0;
    
    issues.forEach(issue => {
      switch (issue.severity) {
        case 'critical':
          penalty += 10;
          break;
        case 'high':
          penalty += 5;
          break;
        case 'medium':
          penalty += 2;
          break;
        case 'low':
          penalty += 1;
          break;
      }
    });

    // Ajustar penalidade baseado no tamanho do arquivo (arquivos maiores podem tolerar mais problemas)
    const sizeAdjustment = Math.min(linesOfCode / 100, 2);
    const adjustedPenalty = penalty / (1 + sizeAdjustment * 0.1);

    // Calcular pontuação final (0-100)
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

  // Métodos de configuração
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
    return ['javascript', 'typescript'];
  }

  getSupportedExtensions(): string[] {
    return this.parser.getSupportedExtensions();
  }
}