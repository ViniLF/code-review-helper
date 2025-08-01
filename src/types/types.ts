// src/types/types.ts

// Extensão da interface Command do commander para incluir propriedades customizadas
declare module 'commander' {
  interface Command {
    path?: string;
    language?: string;
    format?: string;
  }
}

// Tipos para configuração CLI
export interface CLIOptions {
  linguagem: string;
  formato: string;
  detalhado?: boolean;
  maxProblemas?: string;
  noColor?: boolean;
  maxFileSize?: string;
  timeout?: string;
  debug?: boolean;
  quiet?: boolean;
}

// Tipos para validação
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  value?: any;
}

// Tipos para estatísticas de análise
export interface AnalysisStats {
  duration: number;
  filesProcessed: number;
  issuesFound: number;
  score: number;
}

// Tipos para configuração de detectores
export interface DetectorThresholds {
  [key: string]: number;
}

export interface DetectorSettings {
  enabled: boolean;
  thresholds?: DetectorThresholds;
  [key: string]: any;
}