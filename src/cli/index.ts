#!/usr/bin/env node

import { Command } from 'commander';
import { Analyzer } from '../core/analyzer';
import { createReporter, validateReporterFormat } from '../core/reporter';
import { HTMLReporter } from '../core/html-reporter';
import { ConfigManager } from '../config/config-manager';
import { logger, LogLevel } from '../utils/logger';
import { CLIOptions } from '../types/types';
import * as path from 'path';
import * as fs from 'fs';

const program = new Command();

program
  .name('revisor-codigo')
  .description('🔍 Assistente automatizado de revisão de código - Encontre problemas e melhore a qualidade do código')
  .version('1.1.0')
  .option('--debug', 'ativar logs de debug')
  .option('--quiet', 'executar em modo silencioso')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.debug) {
      logger.setLevel(LogLevel.DEBUG);
    } else if (opts.quiet) {
      logger.setLevel(LogLevel.ERROR);
    }
  });

program
  .command('analisar')
  .description('Analisa arquivos de código em um diretório')
  .argument('<caminho>', 'caminho para analisar')
  .option('-l, --linguagem <tipo>', 'linguagem para analisar (javascript, typescript)')
  .option('-f, --formato <tipo>', 'formato de saída (console, json, html)', 'console')
  .option('-o, --output <arquivo>', 'arquivo de saída (apenas para HTML e JSON)')
  .option('-v, --detalhado', 'exibir informações detalhadas e trechos de código')
  .option('-m, --max-problemas <numero>', 'máximo de problemas por arquivo para exibir')
  .option('--no-color', 'desabilitar saída colorida')
  .option('--config <caminho>', 'caminho para arquivo de configuração personalizado')
  .action(async (targetPath: string, options: CLIOptions & { config?: string; output?: string }) => {
    const startTime = Date.now();
    
    try {
      logger.info('Iniciando análise de código', { 
        targetPath, 
        formato: options.formato,
        hasCustomConfig: !!options.config,
        hasOutputFile: !!options.output
      });

      if (!validatePath(targetPath)) {
        logger.error('Caminho inválido fornecido');
        process.exit(1);
      }

      const fullPath = path.resolve(targetPath);
      
      if (!fs.existsSync(fullPath)) {
        logger.error('Caminho não existe', undefined, { targetPath });
        process.exit(1);
      }

      const projectPath = options.config ? path.dirname(path.resolve(options.config)) : path.dirname(fullPath);
      
      const analyzer = new Analyzer({}, projectPath);
      const config = analyzer.getRevisorConfig();

      const analysisOptions = {
        language: options.linguagem || config.analysis.languages[0] || 'javascript',
        includePatterns: config.analysis.includePatterns,
        excludePatterns: config.analysis.excludePatterns
      };

      if (options.linguagem && !validateLanguage(options.linguagem)) {
        logger.error('Linguagem não suportada', undefined, { linguagem: options.linguagem });
        console.error('Linguagens suportadas:', config.analysis.languages.join(', '));
        process.exit(1);
      }

      const outputFormat = options.formato;
      if (!validateReporterFormat(outputFormat)) {
        logger.error('Formato não suportado', undefined, { formato: outputFormat });
        console.error('Formatos suportados: console, json, html');
        process.exit(1);
      }

      // Validar arquivo de saída se necessário
      if (options.output) {
        const outputDir = path.dirname(path.resolve(options.output));
        if (!fs.existsSync(outputDir)) {
          logger.error('Diretório de saída não existe', undefined, { outputDir });
          process.exit(1);
        }
      }

      logger.info('Configuração carregada', {
        language: analysisOptions.language,
        format: outputFormat,
        outputFile: options.output || 'stdout',
        detectorsEnabled: Object.entries(config.detectors)
          .filter(([, detConfig]) => detConfig.enabled)
          .map(([name]) => name),
        configSource: options.config ? 'custom' : 'project'
      });

      const report = await analyzer.analyze(fullPath, analysisOptions);

      const reporterOptions = {
        showCodeSnippets: options.detalhado ?? config.output.showCodeSnippets,
        maxIssuesPerFile: options.maxProblemas ? 
          validateNumber(options.maxProblemas, 1, 100, config.output.maxIssuesPerFile) : 
          config.output.maxIssuesPerFile,
        verbose: options.detalhado ?? config.output.verbose,
        colorOutput: options.noColor ? false : config.output.colorOutput,
        outputPath: options.output || ''
      };

      // Usar factory para criar reporter
      const reporter = createReporter(outputFormat, reporterOptions);

      // Se for HTML e tiver arquivo de saída, usar método específico
      if (outputFormat === 'html' && options.output) {
        const htmlReporter = reporter as HTMLReporter;
        await htmlReporter.generateToFile(report, options.output);
        
        const relativePath = path.relative(process.cwd(), options.output);
        console.log(`📄 Relatório HTML gerado: ${relativePath}`);
        console.log(`🌐 Abra o arquivo no navegador para visualizar`);
      } else if (outputFormat === 'json' && options.output) {
        // Para JSON, capturar saída e salvar
        const originalLog = console.log;
        let jsonOutput = '';
        console.log = (content) => { jsonOutput = content; };
        
        reporter.generate(report);
        console.log = originalLog;
        
        await fs.promises.writeFile(options.output, jsonOutput, 'utf8');
        const relativePath = path.relative(process.cwd(), options.output);
        console.log(`📄 Relatório JSON gerado: ${relativePath}`);
      } else {
        // Saída padrão (console ou stdout)
        reporter.generate(report);
      }

      const duration = Date.now() - startTime;
      logger.info('Análise concluída com sucesso', {
        duration,
        score: report.summary.overallScore,
        issues: report.summary.totalIssues,
        files: report.summary.totalFiles,
        outputFormat,
        outputFile: options.output
      });

      process.exit(getExitCode(report.summary.overallScore, report.summary.totalIssues));

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Falha na análise', error as Error, { duration });
      
      if ((options.formato || 'console') !== 'json') {
        console.error(`❌ Erro: ${(error as Error).message}`);
      } else {
        console.log(JSON.stringify({
          error: true,
          message: (error as Error).message,
          timestamp: new Date().toISOString()
        }, null, 2));
      }
      
      process.exit(1);
    }
  });

program
  .command('relatorio')
  .description('Gera relatório HTML a partir de análise existente')
  .argument('<caminho>', 'caminho para analisar')
  .option('-o, --output <arquivo>', 'arquivo HTML de saída', './relatorio-codigo.html')
  .option('--config <caminho>', 'caminho para arquivo de configuração personalizado')
  .option('--detalhado', 'incluir trechos de código no relatório')
  .action(async (targetPath: string, options: { output: string; config?: string; detalhado?: boolean }) => {
    try {
      logger.info('Gerando relatório HTML dedicado', { targetPath, output: options.output });

      const fullPath = path.resolve(targetPath);
      if (!fs.existsSync(fullPath)) {
        console.error(`❌ Caminho não existe: ${targetPath}`);
        process.exit(1);
      }

      const projectPath = options.config ? path.dirname(path.resolve(options.config)) : path.dirname(fullPath);
      const analyzer = new Analyzer({}, projectPath);
      const config = analyzer.getRevisorConfig();

      const report = await analyzer.analyze(fullPath, {
        language: config.analysis.languages[0] || 'javascript',
        includePatterns: config.analysis.includePatterns,
        excludePatterns: config.analysis.excludePatterns
      });

      const htmlReporter = new HTMLReporter({
        showCodeSnippets: options.detalhado ?? true,
        maxIssuesPerFile: 15,
        verbose: true,
        colorOutput: false
      });

      await htmlReporter.generateToFile(report, options.output);
      
      const relativePath = path.relative(process.cwd(), options.output);
      console.log(`✅ Relatório HTML gerado com sucesso!`);
      console.log(`📄 Arquivo: ${relativePath}`);
      console.log(`🌐 Abra no navegador para visualizar`);
      console.log(`📊 Pontuação: ${report.summary.overallScore}/100`);
      console.log(`⚠️  Problemas: ${report.summary.totalIssues}`);

    } catch (error) {
      console.error(`❌ Erro ao gerar relatório: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Cria um arquivo de configuração padrão no projeto')
  .option('-p, --path <caminho>', 'caminho onde criar o arquivo de configuração', process.cwd())
  .action(async (options) => {
    try {
      const configPath = await ConfigManager.createDefaultConfig(options.path);
      console.log(`✅ Arquivo de configuração criado: ${path.relative(process.cwd(), configPath)}`);
      console.log('\n💡 Dicas:');
      console.log('  • Edite o arquivo para personalizar detectores e limites');
      console.log('  • Use "revisor-codigo analisar ./src" para analisar com a nova configuração');
      console.log('  • Use "revisor-codigo relatorio ./src" para gerar relatório HTML visual');
      console.log('  • Veja "revisor-codigo config" para mais detalhes sobre configuração');
    } catch (error) {
      console.error(`❌ Erro ao criar configuração: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Exibe informações sobre configuração')
  .option('-s, --schema', 'exibir schema JSON da configuração')
  .option('-p, --path <caminho>', 'caminho do projeto para verificar configuração', process.cwd())
  .action(async (options) => {
    try {
      if (options.schema) {
        console.log(JSON.stringify(ConfigManager.getConfigSchema(), null, 2));
        return;
      }

      const config = await ConfigManager.loadConfig(options.path);
      
      console.log('\n🔧 CONFIGURAÇÃO ATUAL');
      console.log('='.repeat(50));
      
      console.log('\n📋 Detectores:');
      Object.entries(config.detectors).forEach(([name, detConfig]) => {
        const status = detConfig.enabled ? '✅' : '❌';
        const displayName = name.charAt(0).toUpperCase() + name.slice(1);
        console.log(`  ${status} ${displayName}`);
        
        if (detConfig.enabled && detConfig.thresholds) {
          Object.entries(detConfig.thresholds).forEach(([key, value]) => {
            console.log(`     • ${key}: ${value}`);
          });
        }
      });

      console.log('\n📊 Saída:');
      console.log(`  • Formato: ${config.output.format}`);
      console.log(`  • Detalhado: ${config.output.verbose ? 'Sim' : 'Não'}`);
      console.log(`  • Problemas por arquivo: ${config.output.maxIssuesPerFile}`);
      console.log(`  • Trechos de código: ${config.output.showCodeSnippets ? 'Sim' : 'Não'}`);

      console.log('\n⚡ Performance:');
      console.log(`  • Arquivos simultâneos: ${config.performance.maxConcurrentFiles}`);
      console.log(`  • Cache ativo: ${config.performance.enableCaching ? 'Sim' : 'Não'}`);
      console.log(`  • Timeout: ${config.performance.timeoutMs}ms`);

      console.log('\n🔒 Segurança:');
      console.log(`  • Tamanho máximo: ${Math.round(config.security.maxFileSize / 1024 / 1024)}MB`);
      
      console.log('\n💡 Para personalizar:');
      console.log('  • Execute "revisor-codigo init" para criar arquivo de configuração');
      console.log('  • Edite .revisor-config.json no seu projeto');
      console.log('');

    } catch (error) {
      console.error(`❌ Erro ao carregar configuração: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('info')
  .description('Exibe informações sobre linguagens e detectores suportados')
  .action(() => {
    console.log('\n🔍 REVISOR DE CÓDIGO - INFORMAÇÕES');
    console.log('='.repeat(50));
    console.log('\n📋 Linguagens Suportadas:');
    console.log('  • JavaScript (.js, .jsx, .mjs, .cjs)');
    console.log('  • TypeScript (.ts, .tsx)');
    
    console.log('\n🔧 Detectores Disponíveis:');
    console.log('  🔄 Complexidade - Detecta alta complexidade ciclomática');
    console.log('  🏷️  Nomenclatura - Verifica convenções de nomes');
    console.log('  📏 Tamanho - Identifica arquivos/funções grandes');
    console.log('  📋 Duplicação - Encontra código duplicado');
    
    console.log('\n📊 Formatos de Saída:');
    console.log('  • console - Saída colorida no terminal (padrão)');
    console.log('  • json - Formato JSON para integração CI/CD');
    console.log('  • html - Relatório visual interativo');
    
    console.log('\n💡 Exemplos de Uso:');
    console.log('  revisor-codigo init                           # Criar configuração');
    console.log('  revisor-codigo analisar ./src                # Análise básica');
    console.log('  revisor-codigo analisar ./src --detalhado    # Com detalhes');
    console.log('  revisor-codigo analisar ./src --formato html -o relatorio.html');
    console.log('  revisor-codigo relatorio ./src               # Relatório HTML dedicado');
    console.log('  revisor-codigo config                        # Ver configuração');
    console.log('\n📚 Dica: Use o formato HTML para relatórios visuais profissionais!');
    console.log('');
  });

program
  .command('ajuda')
  .description('Exibe guia de melhores práticas e dicas')
  .action(() => {
    console.log('\n📚 GUIA DE MELHORES PRÁTICAS');
    console.log('='.repeat(50));
    
    console.log('\n🔄 COMPLEXIDADE:');
    console.log('  • Mantenha funções com complexidade ≤ 10');
    console.log('  • Divida funções grandes em funções menores');
    console.log('  • Use early returns para reduzir aninhamento');
    
    console.log('\n🏷️ NOMENCLATURA:');
    console.log('  • Use camelCase para variáveis e funções');
    console.log('  • Use PascalCase para classes');
    console.log('  • Use UPPER_SNAKE_CASE para constantes');
    console.log('  • Prefira nomes descritivos a abreviações');
    
    console.log('\n📏 TAMANHO:');
    console.log('  • Funções: máximo 50 linhas');
    console.log('  • Arquivos: máximo 300 linhas');
    console.log('  • Parâmetros: máximo 5 por função');
    console.log('  • Classes: máximo 200 linhas');
    
    console.log('\n📋 DUPLICAÇÃO:');
    console.log('  • Extraia código repetido em funções utilitárias');
    console.log('  • Use módulos para compartilhar lógica comum');
    console.log('  • Considere padrões como Strategy ou Template Method');
    
    console.log('\n💡 DICAS GERAIS:');
    console.log('  • Foque nos problemas críticos primeiro');
    console.log('  • Refatore gradualmente');
    console.log('  • Documente código complexo');
    console.log('  • Execute a análise regularmente');
    console.log('  • Use configuração personalizada por projeto');
    console.log('  • Gere relatórios HTML para apresentações');
    console.log('');
  });

function validatePath(targetPath: string): boolean {
  if (!targetPath || typeof targetPath !== 'string') {
    return false;
  }
  
  if (targetPath.includes('..') || targetPath.includes('~')) {
    logger.warn('Caminho potencialmente perigoso detectado', { targetPath });
    return false;
  }
  
  return true;
}

function validateLanguage(language: string): boolean {
  const supportedLanguages = ['javascript', 'typescript'];
  return supportedLanguages.includes(language);
}

function validateNumber(value: string | undefined, min: number, max: number, defaultValue: number): number {
  if (!value) return defaultValue;
  
  const num = parseInt(value, 10);
  if (isNaN(num) || num < min || num > max) {
    logger.warn('Valor numérico inválido, usando padrão', { 
      value, 
      min, 
      max, 
      defaultValue 
    });
    return defaultValue;
  }
  return num;
}

function getExitCode(score: number, totalIssues: number): number {
  if (totalIssues === 0) return 0;
  if (score >= 80) return 0;
  if (score >= 60) return 1;
  return 2;
}

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', reason as Error, { promiseInfo: String(promise) });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  process.exit(1);
});

program.parse();