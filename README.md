# Revisor de Código

Ferramenta de linha de comando para análise estática de código JavaScript e TypeScript, oferecendo detecção automatizada de problemas de qualidade e sugestões de melhoria.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## Funcionalidades

### Detectores Implementados

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

### Sistema de Pontuação

A ferramenta atribui pontuações de 0 a 100 baseadas na severidade e quantidade de problemas encontrados. Os problemas são categorizados em quatro níveis de severidade: crítico, alto, médio e baixo.

## Instalação

```bash
git clone https://github.com/ViniLF/code-review-helper.git
cd code-review-helper
npm install
npm run build
```

## Uso

### Comandos Básicos

Análise de diretório:
```bash
npm start analisar ./src
```

Análise com informações detalhadas:
```bash
npm start analisar ./src --detalhado
```

Especificar linguagem:
```bash
npm start analisar ./src --linguagem typescript
```

Informações sobre detectores disponíveis:
```bash
npm start info
```

Guia de boas práticas:
```bash
npm start ajuda
```

### Opções de Linha de Comando

- `--linguagem <tipo>`: Define a linguagem para análise (javascript, typescript)
- `--detalhado`: Exibe trechos de código e informações completas
- `--max-problemas <numero>`: Limita a quantidade de problemas exibidos por arquivo

## Configuração

### Limites Padrão

```javascript
{
  complexity: {
    function: 10,    // Complexidade máxima por função
    file: 20         // Complexidade média máxima por arquivo
  },
  naming: {
    minLength: 3,    // Comprimento mínimo de identificadores
    maxLength: 30    // Comprimento máximo de identificadores
  },
  size: {
    fileLines: 300,         // Linhas máximas por arquivo
    functionLines: 50,      // Linhas máximas por função
    functionParameters: 5,  // Parâmetros máximos por função
    classLines: 200,        // Linhas máximas por classe
    methodLines: 30         // Linhas máximas por método
  }
}
```

## Arquitetura

### Estrutura do Projeto

```
src/
├── cli/           # Interface de linha de comando
├── core/          # Lógica principal (Analyzer, Parser, Reporter)
├── detectors/     # Detectores específicos por categoria
├── models/        # Modelos de dados (Issue, Report)
└── utils/         # Utilitários auxiliares
```

### Extensibilidade

A arquitetura modular permite a adição de novos detectores e linguagens. Cada detector herda da classe `BaseDetector` e implementa a interface de detecção padronizada.

## Relatórios

A ferramenta gera relatórios estruturados contendo:

- Resumo executivo com métricas gerais
- Problemas categorizados por tipo e severidade
- Arquivos com maior número de problemas
- Lista priorizada de problemas críticos
- Sugestões específicas para cada problema identificado

## Tecnologias

- **TypeScript**: Tipagem estática e desenvolvimento robusto
- **Babel Parser**: Análise de AST para JavaScript e TypeScript
- **Commander.js**: Interface de linha de comando
- **Node.js**: Ambiente de execução
- **Glob**: Correspondência de padrões de arquivos

## Desenvolvimento

### Scripts Disponíveis

```bash
npm run dev          # Execução em modo desenvolvimento
npm run build        # Compilação para produção
npm start           # Execução da versão compilada
```

### Adicionando Novos Detectores

1. Criar classe herdando de `BaseDetector`
2. Implementar método `detect(file: ParsedFile): Issue[]`
3. Registrar no sistema de detectores
4. Adicionar configurações padrão

## Licença

Este projeto está licenciado sob a Licença MIT. Consulte o arquivo LICENSE para detalhes completos.

## Contribuição

Contribuições são bem-vindas. Para mudanças significativas, abra uma issue primeiro para discussão. Certifique-se de que os testes passem antes de submeter pull requests.

## Roadmap

- Detector de duplicação de código
- Suporte para Python e Java
- Exportação de relatórios em JSON e HTML
- Integração com sistemas de CI/CD
- Plugin para VS Code