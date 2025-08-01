import { BaseReporter } from './reporter';
import { Report, FileAnalysis } from '../models/report';
import { Issue, IssueSeverity, IssueCategory } from '../models/issue';
import { createLogger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export class HTMLReporter extends BaseReporter {
  private htmlLogger = createLogger('HTMLReporter');

  generate(report: Report): void {
    this.htmlLogger.info('Gerando relatório HTML');
    
    const html = this.generateHTML(report);
    console.log(html);
    
    this.htmlLogger.debug('Relatório HTML gerado com sucesso', {
      totalFiles: report.summary.totalFiles,
      totalIssues: report.summary.totalIssues,
      htmlLength: html.length
    });
  }

  async generateToFile(report: Report, outputPath: string): Promise<void> {
    try {
      const html = this.generateHTML(report);
      await fs.promises.writeFile(outputPath, html, 'utf8');
      
      this.htmlLogger.info('Relatório HTML salvo', { outputPath });
    } catch (error) {
      this.htmlLogger.error('Erro ao salvar relatório HTML', error as Error, { outputPath });
      throw error;
    }
  }

  private generateHTML(report: Report): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Revisor de Código - Relatório de Análise</title>
    <style>
        ${this.getCSS()}
    </style>
</head>
<body>
    <div class="container">
        ${this.generateHeader(report)}
        ${this.generateSummary(report)}
        ${this.generateCharts(report)}
        ${this.generateCategoryBreakdown(report)}
        ${this.generateFileAnalysis(report)}
        ${this.generateTopIssues(report)}
        ${this.generateFooter(report)}
    </div>
    <script>
        ${this.getJavaScript()}
    </script>
</body>
</html>`;
  }

  private getCSS(): string {
    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: white;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .header h1 {
            color: #2d3748;
            font-size: 2.5rem;
            margin-bottom: 10px;
            font-weight: 700;
        }
        
        .header .subtitle {
            color: #718096;
            font-size: 1.1rem;
        }
        
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .metric-card {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .metric-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.15);
        }
        
        .metric-card .icon {
            font-size: 2.5rem;
            margin-bottom: 15px;
        }
        
        .metric-card .value {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 5px;
        }
        
        .metric-card .label {
            color: #718096;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .score-excellent { color: #38a169; }
        .score-good { color: #3182ce; }
        .score-warning { color: #d69e2e; }
        .score-poor { color: #e53e3e; }
        
        .section {
            background: white;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        
        .section h2 {
            color: #2d3748;
            font-size: 1.8rem;
            margin-bottom: 20px;
            font-weight: 600;
        }
        
        .chart-container {
            position: relative;
            height: 300px;
            margin: 20px 0;
        }
        
        .category-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
        }
        
        .category-card {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            background: #f7fafc;
        }
        
        .category-header {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .category-icon {
            font-size: 1.5rem;
            margin-right: 10px;
        }
        
        .category-name {
            font-weight: 600;
            font-size: 1.1rem;
        }
        
        .category-count {
            margin-left: auto;
            background: #667eea;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
        }
        
        .severity-breakdown {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        
        .severity-tag {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: 600;
        }
        
        .severity-critical { background: #fed7d7; color: #c53030; }
        .severity-high { background: #fbb6ce; color: #b83280; }
        .severity-medium { background: #faf089; color: #744210; }
        .severity-low { background: #bee3f8; color: #2a69ac; }
        
        .file-list {
            max-height: 600px;
            overflow-y: auto;
        }
        
        .file-item {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            margin-bottom: 15px;
            overflow: hidden;
        }
        
        .file-header {
            background: #f7fafc;
            padding: 15px 20px;
            display: flex;
            align-items: center;
            cursor: pointer;
            transition: background 0.2s ease;
        }
        
        .file-header:hover {
            background: #edf2f7;
        }
        
        .file-path {
            font-weight: 600;
            color: #2d3748;
            flex: 1;
        }
        
        .file-score {
            font-weight: 700;
            margin-right: 15px;
        }
        
        .file-issues {
            font-size: 0.9rem;
            color: #718096;
        }
        
        .issue-list {
            padding: 0 20px 20px;
            background: white;
        }
        
        .issue-item {
            border-left: 4px solid #e2e8f0;
            padding: 15px;
            margin-bottom: 10px;
            background: #f7fafc;
            border-radius: 0 8px 8px 0;
        }
        
        .issue-critical { border-left-color: #e53e3e; }
        .issue-high { border-left-color: #d69e2e; }
        .issue-medium { border-left-color: #3182ce; }
        .issue-low { border-left-color: #38a169; }
        
        .issue-title {
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 5px;
        }
        
        .issue-location {
            font-size: 0.9rem;
            color: #718096;
            margin-bottom: 8px;
        }
        
        .issue-suggestion {
            font-size: 0.9rem;
            color: #4a5568;
            background: white;
            padding: 10px;
            border-radius: 4px;
            margin-top: 8px;
        }
        
        .code-snippet {
            background: #1a202c;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 4px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.8rem;
            overflow-x: auto;
            margin-top: 10px;
        }
        
        .footer {
            text-align: center;
            padding: 30px;
            color: #718096;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        
        .progress-bar {
            width: 100%;
            height: 8px;
            background: #e2e8f0;
            border-radius: 4px;
            overflow: hidden;
            margin-top: 10px;
        }
        
        .progress-fill {
            height: 100%;
            transition: width 0.8s ease;
        }
        
        @media (max-width: 768px) {
            .container { padding: 10px; }
            .header h1 { font-size: 2rem; }
            .summary { grid-template-columns: 1fr; }
            .category-grid { grid-template-columns: 1fr; }
        }
    `;
  }

  private generateHeader(report: Report): string {
    return `
        <div class="header">
            <h1>🔍 Revisor de Código</h1>
            <p class="subtitle">Relatório de Análise - ${report.summary.analysisDate.toLocaleString('pt-BR')}</p>
        </div>
    `;
  }

  private generateSummary(report: Report): string {
    const scoreClass = this.getScoreClass(report.summary.overallScore);
    
    return `
        <div class="summary">
            <div class="metric-card">
                <div class="icon">📁</div>
                <div class="value">${report.summary.totalFiles}</div>
                <div class="label">Arquivos Analisados</div>
            </div>
            <div class="metric-card">
                <div class="icon">📝</div>
                <div class="value">${report.summary.totalLinesOfCode.toLocaleString()}</div>
                <div class="label">Linhas de Código</div>
            </div>
            <div class="metric-card">
                <div class="icon">⚠️</div>
                <div class="value">${report.summary.totalIssues}</div>
                <div class="label">Problemas Encontrados</div>
            </div>
            <div class="metric-card">
                <div class="icon">🏆</div>
                <div class="value ${scoreClass}">${report.summary.overallScore}/100</div>
                <div class="label">Pontuação Geral</div>
                <div class="progress-bar">
                    <div class="progress-fill ${scoreClass}" style="width: ${report.summary.overallScore}%"></div>
                </div>
            </div>
        </div>
    `;
  }

  private generateCharts(report: Report): string {
    const severityData = this.getSeverityDistribution(report);
    const categoryData = report.categories.map(cat => ({
      name: this.getCategoryName(cat.category),
      value: cat.count,
      icon: this.getCategoryIcon(cat.category)
    }));

    return `
        <div class="section">
            <h2>📊 Distribuição de Problemas</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                <div>
                    <h3>Por Severidade</h3>
                    <div class="chart-container">
                        ${this.generateSeverityChart(severityData)}
                    </div>
                </div>
                <div>
                    <h3>Por Categoria</h3>
                    <div class="chart-container">
                        ${this.generateCategoryChart(categoryData)}
                    </div>
                </div>
            </div>
        </div>
    `;
  }

  private generateSeverityChart(data: any[]): string {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return '<p>Nenhum problema encontrado!</p>';

    return data.map(item => {
      const percentage = (item.value / total * 100).toFixed(1);
      return `
        <div style="margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>${item.icon} ${item.name}</span>
                <span><strong>${item.value}</strong> (${percentage}%)</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill severity-${item.name.toLowerCase()}" style="width: ${percentage}%"></div>
            </div>
        </div>
      `;
    }).join('');
  }

  private generateCategoryChart(data: any[]): string {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return '<p>Nenhum problema encontrado!</p>';

    return data.map(item => {
      const percentage = (item.value / total * 100).toFixed(1);
      return `
        <div style="margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>${item.icon} ${item.name}</span>
                <span><strong>${item.value}</strong> (${percentage}%)</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percentage}%; background: #667eea;"></div>
            </div>
        </div>
      `;
    }).join('');
  }

  private generateCategoryBreakdown(report: Report): string {
    if (report.categories.length === 0) {
      return `
        <div class="section">
            <h2>📋 Análise por Categoria</h2>
            <p style="text-align: center; color: #718096; font-size: 1.2rem; padding: 40px;">
                🎉 Excelente! Nenhum problema encontrado no seu código.
            </p>
        </div>
      `;
    }

    const categoriesHTML = report.categories.map(category => {
      const severityTags = [
        { key: IssueSeverity.CRITICAL, label: 'Crítico', class: 'severity-critical' },
        { key: IssueSeverity.HIGH, label: 'Alto', class: 'severity-high' },
        { key: IssueSeverity.MEDIUM, label: 'Médio', class: 'severity-medium' },
        { key: IssueSeverity.LOW, label: 'Baixo', class: 'severity-low' }
      ].filter(severity => category.severity[severity.key] > 0)
       .map(severity => `
         <span class="severity-tag ${severity.class}">
           ${severity.label}: ${category.severity[severity.key]}
         </span>
       `).join('');

      return `
        <div class="category-card">
            <div class="category-header">
                <span class="category-icon">${this.getCategoryIcon(category.category)}</span>
                <span class="category-name">${this.getCategoryName(category.category)}</span>
                <span class="category-count">${category.count}</span>
            </div>
            <div class="severity-breakdown">
                ${severityTags}
            </div>
        </div>
      `;
    }).join('');

    return `
        <div class="section">
            <h2>📋 Análise por Categoria</h2>
            <div class="category-grid">
                ${categoriesHTML}
            </div>
        </div>
    `;
  }

  private generateFileAnalysis(report: Report): string {
    const sortedFiles = report.files
      .filter(f => f.issues.length > 0)
      .sort((a, b) => b.issues.length - a.issues.length)
      .slice(0, 10);

    if (sortedFiles.length === 0) {
      return `
        <div class="section">
            <h2>🗂️ Análise de Arquivos</h2>
            <p style="text-align: center; color: #718096; font-size: 1.2rem; padding: 40px;">
                ✨ Todos os arquivos estão sem problemas!
            </p>
        </div>
      `;
    }

    const filesHTML = sortedFiles.map((file, index) => {
      const scoreClass = this.getScoreClass(file.score);
      const issuesHTML = file.issues
        .slice(0, this.options.maxIssuesPerFile)
        .map(issue => this.generateIssueHTML(issue))
        .join('');

      return `
        <div class="file-item">
            <div class="file-header" onclick="toggleFile(${index})">
                <span class="file-path">📄 ${file.path}</span>
                <span class="file-score ${scoreClass}">${file.score}/100</span>
                <span class="file-issues">${file.issues.length} problema${file.issues.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="issue-list" id="file-${index}" style="display: none;">
                ${issuesHTML}
                ${file.issues.length > this.options.maxIssuesPerFile ? 
                  `<p style="text-align: center; color: #718096; margin-top: 15px;">
                    ... e mais ${file.issues.length - this.options.maxIssuesPerFile} problema${file.issues.length - this.options.maxIssuesPerFile !== 1 ? 's' : ''}
                  </p>` : ''}
            </div>
        </div>
      `;
    }).join('');

    return `
        <div class="section">
            <h2>🗂️ Arquivos com Mais Problemas</h2>
            <div class="file-list">
                ${filesHTML}
            </div>
        </div>
    `;
  }

  private generateTopIssues(report: Report): string {
    if (report.topIssues.length === 0) return '';

    const topIssuesHTML = report.topIssues.slice(0, 5).map((issue, index) => 
      `<div class="issue-item issue-${issue.severity}">
         <div class="issue-title">
           ${index + 1}. ${this.getSeverityIcon(issue.severity)} ${issue.title}
         </div>
         <div class="issue-location">📍 ${issue.location.file}:${issue.location.line}:${issue.location.column}</div>
         <div class="issue-suggestion">💡 ${issue.suggestion}</div>
         ${this.options.showCodeSnippets && issue.codeSnippet ? 
           `<div class="code-snippet">${this.escapeHtml(issue.codeSnippet)}</div>` : ''}
       </div>`
    ).join('');

    return `
        <div class="section">
            <h2>🚨 Problemas Prioritários</h2>
            ${topIssuesHTML}
        </div>
    `;
  }

  private generateIssueHTML(issue: Issue): string {
    return `
        <div class="issue-item issue-${issue.severity}">
            <div class="issue-title">${this.getSeverityIcon(issue.severity)} ${issue.title}</div>
            <div class="issue-location">📍 Linha ${issue.location.line}:${issue.location.column}</div>
            ${this.options.verbose ? `<div class="issue-suggestion">💡 ${issue.suggestion}</div>` : ''}
            ${this.options.showCodeSnippets && issue.codeSnippet ? 
              `<div class="code-snippet">${this.escapeHtml(issue.codeSnippet)}</div>` : ''}
        </div>
    `;
  }

  private generateFooter(report: Report): string {
    return `
        <div class="footer">
            <p><strong>🔧 Revisor de Código v1.1.0</strong></p>
            <p>Melhorando seu código, um problema por vez!</p>
            <p style="margin-top: 10px; font-size: 0.9rem;">
                Relatório gerado em ${report.summary.analysisDate.toLocaleString('pt-BR')}
            </p>
        </div>
    `;
  }

  private getJavaScript(): string {
    return `
        function toggleFile(index) {
            const fileDiv = document.getElementById('file-' + index);
            fileDiv.style.display = fileDiv.style.display === 'none' ? 'block' : 'none';
        }

        // Animações de entrada
        document.addEventListener('DOMContentLoaded', function() {
            const cards = document.querySelectorAll('.metric-card, .section');
            cards.forEach((card, index) => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, index * 100);
            });

            // Animar barras de progresso
            setTimeout(() => {
                const progressBars = document.querySelectorAll('.progress-fill');
                progressBars.forEach(bar => {
                    const width = bar.style.width;
                    bar.style.width = '0%';
                    setTimeout(() => {
                        bar.style.width = width;
                    }, 500);
                });
            }, 1000);
        });
    `;
  }

  private getSeverityDistribution(report: Report): any[] {
    const severityCount = {
      [IssueSeverity.CRITICAL]: 0,
      [IssueSeverity.HIGH]: 0,
      [IssueSeverity.MEDIUM]: 0,
      [IssueSeverity.LOW]: 0
    };

    report.files.forEach(file => {
      file.issues.forEach(issue => {
        severityCount[issue.severity]++;
      });
    });

    return [
      { name: 'Crítico', value: severityCount[IssueSeverity.CRITICAL], icon: '🔴' },
      { name: 'Alto', value: severityCount[IssueSeverity.HIGH], icon: '🟠' },
      { name: 'Médio', value: severityCount[IssueSeverity.MEDIUM], icon: '🟡' },
      { name: 'Baixo', value: severityCount[IssueSeverity.LOW], icon: '🔵' }
    ].filter(item => item.value > 0);
  }

  private getScoreClass(score: number): string {
    if (score >= 90) return 'score-excellent';
    if (score >= 75) return 'score-good';
    if (score >= 50) return 'score-warning';
    return 'score-poor';
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}