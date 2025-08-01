# Revisor de Código

Ferramenta de linha de comando profissional para análise estática de código JavaScript e TypeScript, oferecendo detecção automatizada de problemas de qualidade com relatórios visuais interativos.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Version](https://img.shields.io/badge/Version-1.1.0-blue.svg)](https://github.com/ViniLF/code-review-helper)

## Funcionalidades

### Detectores Avançados

**Detector de Complexidade**
- Análise de complexidade ciclomática em funções
- Detecção de complexidade excessiva em arquivos
- Limites configuráveis por projeto

**Detector de Nomenclatura**
- Verificação de convenções camelCase, PascalCase e UPPER_SNAKE_CASE
- Identificação de nomes genéricos e abreviações
- Validação de comprimento de identificadores

**Detector de Tamanho**
- Análise de arquivos, funções, classes e métodos extensos
- Detecção de funções com muitos parâmetros
- Métricas baseadas em linhas de código

**Detector de Duplicação**
- Detecção inteligente de código duplicado usando similaridade AST
- Análise cross-file com cache otimizado
- Limites configuráveis de similaridade e tamanho mínimo

### Sistema de Relatórios

**Console** - Saída colorida e estruturada para terminal
**JSON** - Formato estruturado para integração CI/CD
**HTML** - Dashboard visual interativo com:
- Métricas em tempo real com animações
- Gráficos de distribuição por categoria e severidade
- Análise expansível de arquivos
- Design responsivo e profissional

### Sistema de Configuração

- **Configuração externa** via `.revisor-config.json`
- **Limites personalizáveis** para cada detector
- **Padrões de arquivo** configuráveis
- **Configurações de performance** e segurança

### Sistema Profissional

- **Logger estruturado** com níveis (debug, info, warn, error)
- **Cache inteligente** de parsing AST para performance
- **Validação de segurança** para paths de arquivos
- **Exit codes apropriados** para integração CI/CD
- **Processamento paralelo** com controle de concorrência

## Início Rápido

### Instalação

```bash
git clone https://github.com/ViniLF/code-review-helper.git
cd code-review-helper
npm install
npm run build
```

### Uso Básico

```bash
# Análise simples
npm start analisar ./src

# Análise detalhada
npm start analisar ./src --detalhado

# Relatório HTML visual
npm start relatorio ./src -o relatorio.html

# Criar configuração personalizada
npm start init
```

## Comandos Disponíveis

### `analisar` - Análise de Código

```bash
# Análise básica
revisor-codigo analisar ./src

# Com formato específico
revisor-codigo analisar ./src --formato html -o dashboard.html

# Análise detalhada com snippets
revisor-codigo analisar ./src --detalhado --formato html -o report.html

# Linguagem específica
revisor-codigo analisar ./src --linguagem typescript --formato json
```

**Opções:**
- `-l, --linguagem <tipo>` - Linguagem (javascript, typescript)
- `-f, --formato <tipo>` - Formato de saída (console, json, html)
- `-o, --output <arquivo>` - Arquivo de saída para HTML/JSON
- `-v, --detalhado` - Informações detalhadas e trechos de código
- `-m, --max-problemas <numero>` - Máximo de problemas por arquivo
- `--no-color` - Desabilitar saída colorida
- `--config <caminho>` - Configuração personalizada

### `relatorio` - Relatório HTML Dedicado

```bash
# Relatório HTML com configurações otimizadas
revisor-codigo relatorio ./src

# Com arquivo de saída personalizado
revisor-codigo relatorio ./src -o ./docs/code-quality.html

# Incluindo snippets de código
revisor-codigo relatorio ./src --detalhado -o report.html
```

### `init` - Configuração do Projeto

```bash
# Criar arquivo de configuração no diretório atual
revisor-codigo init

# Criar em diretório específico
revisor-codigo init --path ./meu-projeto
```

### `config` - Gerenciar Configuração

```bash
# Ver configuração atual
revisor-codigo config

# Exibir schema JSON
revisor-codigo config --schema

# Ver configuração de projeto específico
revisor-codigo config --path ./outro-projeto
```

### `info` - Informações do Sistema

```bash
# Ver linguagens e detectores suportados
revisor-codigo info
```

### `ajuda` - Guia de Boas Práticas

```bash
# Guia completo de melhores práticas
revisor-codigo ajuda
```

## Configuração

### Arquivo `.revisor-config.json`

```json
{
  "detectors": {
    "complexity": {
      "enabled": true,
      "thresholds": {
        "function": 10,
        "file": 20
      }
    },
    "naming": {
      "enabled": true,
      "thresholds": {
        "minLength": 3,
        "maxLength": 30
      },
      "patterns": {
        "camelCase": true,
        "constants": true
      }
    },
    "size": {
      "enabled": true,
      "thresholds": {
        "fileLines": 300,
        "functionLines": 50,
        "functionParameters": 5
      }
    },
    "duplication": {
      "enabled": true,
      "thresholds": {
        "minLines": 6,
        "minTokens": 50,
        "similarityThreshold": 0.85
      }
    }
  },
  "output": {
    "format": "console",
    "verbose": false,
    "maxIssuesPerFile": 10,
    "showCodeSnippets": true
  },
  "performance": {
    "maxConcurrentFiles": 10,
    "enableCaching": true,
    "timeoutMs": 30000
  }
}
```

### Limites Padrão

| Detector | Métrica | Limite Padrão |
|----------|---------|---------------|
| **Complexidade** | Função | 10 |
| **Complexidade** | Arquivo | 20 |
| **Nomenclatura** | Comprimento mín | 3 |
| **Nomenclatura** | Comprimento máx | 30 |
| **Tamanho** | Linhas por arquivo | 300 |
| **Tamanho** | Linhas por função | 50 |
| **Tamanho** | Parâmetros por função | 5 |
| **Duplicação** | Linhas mínimas | 6 |
| **Duplicação** | Similaridade | 85% |

## Sistema de Pontuação

A ferramenta atribui pontuações de 0 a 100 baseadas na severidade e quantidade de problemas:

- **🔴 Crítico** - Problemas que requerem ação imediata
- **🟠 Alto** - Problemas importantes que afetam manutenibilidade  
- **🟡 Médio** - Problemas que devem ser corrigidos
- **🔵 Baixo** - Melhorias recomendadas

### Exit Codes para CI/CD

- `0` - Sem problemas ou pontuação ≥ 80
- `1` - Pontuação entre 60-79
- `2` - Pontuação < 60

### Extensibilidade

A arquitetura modular permite:
- **Novos detectores** - Herdar de `BaseDetector`
- **Novas linguagens** - Implementar parser específico
- **Novos formatos** - Implementar `BaseReporter`
- **Configuração flexível** - Schema JSON validado

## Exemplos de Saída

### Console
```
🔍 REVISOR DE CÓDIGO - RELATÓRIO DE ANÁLISE
📊 RESUMO
📁 Arquivos analisados: 15
📝 Linhas de código: 2,340
⚠️  Total de problemas: 23
🏆 Pontuação Geral: 78/100
```

### JSON (CI/CD)
```json
{
  "summary": {
    "totalFiles": 15,
    "totalIssues": 23,
    "overallScore": 78,
    "totalLinesOfCode": 2340
  },
  "metadata": {
    "version": "1.1.0",
    "generatedAt": "2025-08-01T10:30:00.000Z"
  }
}
```

### HTML
Dashboard visual interativo com:
- 📊 Cards de métricas animados
- 📈 Gráficos de distribuição
- 🗂️ Lista expansível de arquivos
- 🎨 Design responsivo moderno

## Desenvolvimento

### Scripts Disponíveis

```bash
npm run dev          # Execução em modo desenvolvimento
npm run build        # Compilação para produção
npm start           # Execução da versão compilada
npm run test        # Testes (em desenvolvimento)
```

### Adicionando Detectores

1. Criar classe herdando de `BaseDetector`
2. Implementar `detect(file: ParsedFile): Issue[]`
3. Registrar em `detectors/index.ts`
4. Adicionar configurações padrão
5. Atualizar schema de configuração

```typescript
export class MeuDetector extends BaseDetector {
  detect(file: ParsedFile): Issue[] {
    // Lógica de detecção
    return issues;
  }
}
```

## 🚀 Roadmap Futuro

### Próximas Versões

**v1.2.0 - Linguagens Adicionais**
- Suporte para Python
- Suporte para Java
- Detectores específicos por linguagem

**v1.3.0 - Integração e Automação**
- GitHub Actions integration
- Watch mode para desenvolvimento
- Métricas históricas

**v1.4.0 - Ferramentas Visuais**
- VS Code Extension
- Dashboard web em tempo real
- Integração com IDEs

**v1.5.0 - Análise Avançada**
- Detectores de segurança
- Detectores de performance
- ML-powered suggestions

## Contribuição

Contribuições são bem-vindas! Para mudanças significativas:

1. **Fork** o projeto
2. **Crie** uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. **Commit** suas mudanças (`git commit -m 'feat: adiciona nova funcionalidade'`)
4. **Push** para a branch (`git push origin feature/nova-funcionalidade`)
5. **Abra** um Pull Request

### Padrões de Commit

```
feat: nova funcionalidade
fix: correção de bug
docs: atualização de documentação
style: formatação, sem mudança de código
refactor: refatoração de código
test: adição de testes
chore: tarefas de manutenção
```

## Licença

Este projeto está licenciado sob a [Licença MIT](LICENSE) - veja o arquivo LICENSE para detalhes.

## Reconhecimentos

- **Babel** - Parser AST robusto
- **Commander.js** - Interface CLI elegante  
- **TypeScript** - Tipagem estática confiável

---

**Revisor de Código v1.1.0**
Desenvolvido por [ViniLF](https://github.com/ViniLF)