#!/usr/bin/env node

import { Command } from 'commander';
import { Analyzer } from '../core/analyzer';
import { ConsoleReporter } from '../core/reporter';
import * as path from 'path';
import * as fs from 'fs';

const program = new Command();

program
  .name('revisor-codigo')
  .description('🔍 Assistente automatizado de revisão de código - Encontre problemas e melhore a qualidade do código')
  .version('1.0.0');

program
  .command('analisar')
  .description('Analisa arquivos de código em um diretório')
  .argument('<caminho>', 'caminho para analisar')
  .option('-l, --linguagem <tipo>', 'linguagem para analisar', 'javascript')
  .option('-f, --formato <tipo>', 'formato de saída', 'console')
  .option('-v, --detalhado', 'exibir informações detalhadas e trechos de código')
  .option('-m, --max-problemas <numero>', 'máximo de problemas por arquivo para exibir', '10')
  .action(async (targetPath: string, options) => {
    try {
      const fullPath = path.resolve(targetPath);
      
      if (!fs.existsSync(fullPath)) {
        console.error(`Erro: O caminho "${targetPath}" não existe`);
        process.exit(1);
      }

      console.log(`🔍 Analisando arquivos ${options.linguagem} em: ${fullPath}`);
      
      const analyzer = new Analyzer();
      const report = await analyzer.analyze(fullPath, {
        language: options.linguagem,
        includePatterns: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
        excludePatterns: ['node_modules/**', 'dist/**', 'build/**', '**/*.test.*', '**/*.spec.*', 'coverage/**']
      });

      const reporter = new ConsoleReporter({
        showCodeSnippets: options.detalhado || false,
        maxIssuesPerFile: parseInt(options.maxProblemas) || 10,
        verbose: options.detalhado || false
      });
      reporter.generate(report);

    } catch (error) {
      console.error('Falha na análise:', error instanceof Error ? error.message : error);
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
    
    console.log('\n💡 Exemplos de Uso:');
    console.log('  revisor-codigo analisar ./src');
    console.log('  revisor-codigo analisar ./src --detalhado');
    console.log('  revisor-codigo analisar arquivo.js --linguagem javascript');
    console.log('\n📚 Dica: Use --detalhado para ver trechos de código e sugestões completas');
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
    
    console.log('\n💡 DICAS GERAIS:');
    console.log('  • Foque nos problemas críticos primeiro');
    console.log('  • Refatore gradualmente');
    console.log('  • Documente código complexo');
    console.log('  • Execute a análise regularmente');
    console.log('');
  });

program.parse();