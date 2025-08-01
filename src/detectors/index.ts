import { BaseDetector } from './base/detector';
import { ComplexityDetector } from './javascript/complexity';
import { NamingDetector } from './javascript/naming';
import { SizeDetector } from './javascript/size';
import { DuplicationDetector } from './javascript/duplication-detector';
import { createLogger } from '../utils/logger';

export interface DetectorRegistry {
  [key: string]: new (config?: any) => BaseDetector;
}

export const JavaScriptDetectors: DetectorRegistry = {
  complexity: ComplexityDetector,
  naming: NamingDetector,
  size: SizeDetector,
  duplication: DuplicationDetector
};

export const DefaultDetectorConfig = {
  javascript: {
    complexity: {
      enabled: true,
      thresholds: { function: 10, file: 20 }
    },
    naming: {
      enabled: true,
      thresholds: { minLength: 3, maxLength: 30 },
      patterns: { camelCase: true, constants: true, functions: true, variables: true }
    },
    size: {
      enabled: true,
      thresholds: { fileLines: 300, functionLines: 50, functionParameters: 5, classLines: 200, methodLines: 30 }
    },
    duplication: {
      enabled: true,
      thresholds: { minLines: 6, minTokens: 50, similarityThreshold: 0.85 }
    }
  }
};

const detectorsLogger = createLogger('DetectorManager');
let duplicationDetectorInstance: DuplicationDetector | null = null;

export function createDetectorsForLanguage(language: string, config?: any): BaseDetector[] {
  const detectors: BaseDetector[] = [];
  
  if (language === 'javascript' || language === 'typescript') {
    const jsConfig = config || DefaultDetectorConfig.javascript;
    
    detectorsLogger.debug('Criando detectores', { 
      language, 
      configProvided: !!config,
      enabledDetectors: Object.entries(jsConfig)
        .filter(([, detConfig]: [string, any]) => detConfig?.enabled !== false)
        .map(([name]) => name)
    });
    
    Object.entries(JavaScriptDetectors).forEach(([name, DetectorClass]) => {
      const detectorConfig = jsConfig[name];
      
      if (detectorConfig?.enabled !== false) {
        try {
          if (name === 'duplication') {
            if (!duplicationDetectorInstance) {
              duplicationDetectorInstance = new DetectorClass(detectorConfig) as DuplicationDetector;
              detectorsLogger.debug('Nova instância de detector de duplicação criada');
            } else {
              detectorsLogger.debug('Reutilizando instância de detector de duplicação');
            }
            detectors.push(duplicationDetectorInstance);
          } else {
            detectors.push(new DetectorClass(detectorConfig));
          }
          
          detectorsLogger.debug('Detector criado com sucesso', { 
            name, 
            enabled: detectorConfig?.enabled !== false,
            hasThresholds: !!detectorConfig?.thresholds
          });
        } catch (error) {
          detectorsLogger.error('Falha ao criar detector', error as Error, { 
            detectorName: name,
            config: detectorConfig
          });
        }
      } else {
        detectorsLogger.debug('Detector desabilitado', { name });
      }
    });
  }
  
  detectorsLogger.info('Detectores criados', { 
    language,
    count: detectors.length,
    names: detectors.map(d => d.getName())
  });
  
  return detectors;
}

export function getAvailableDetectors(language: string): string[] {
  if (language === 'javascript' || language === 'typescript') {
    return Object.keys(JavaScriptDetectors);
  }
  
  return [];
}

export function createDetectorByName(language: string, detectorName: string, config?: any): BaseDetector | null {
  if (language === 'javascript' || language === 'typescript') {
    const DetectorClass = JavaScriptDetectors[detectorName];
    if (DetectorClass) {
      try {
        if (detectorName === 'duplication') {
          if (!duplicationDetectorInstance) {
            duplicationDetectorInstance = new DetectorClass(config) as DuplicationDetector;
          }
          return duplicationDetectorInstance;
        } else {
          return new DetectorClass(config);
        }
      } catch (error) {
        detectorsLogger.error('Falha ao criar detector específico', error as Error, {
          language,
          detectorName,
          config
        });
        return null;
      }
    }
  }
  
  return null;
}

export function resetDuplicationDetector(): void {
  if (duplicationDetectorInstance) {
    duplicationDetectorInstance.reset();
    detectorsLogger.debug('Detector de duplicação resetado');
  }
}

export function getDuplicationStats(): { totalBlocks: number; processedFiles: number } | null {
  if (duplicationDetectorInstance) {
    return duplicationDetectorInstance.getStats();
  }
  return null;
}

export function getDetectorInfo(detectorName: string): {
  name: string;
  description: string;
  category: string;
  defaultConfig: any;
} | null {
  const detectorInfo = {
    complexity: {
      name: 'Complexidade Ciclomática',
      description: 'Detecta funções e arquivos com alta complexidade ciclomática',
      category: 'Qualidade de Código',
      defaultConfig: DefaultDetectorConfig.javascript.complexity
    },
    naming: {
      name: 'Convenções de Nomenclatura',
      description: 'Verifica se identificadores seguem convenções padrão',
      category: 'Legibilidade',
      defaultConfig: DefaultDetectorConfig.javascript.naming
    },
    size: {
      name: 'Tamanho de Componentes',
      description: 'Identifica arquivos, funções e classes muito grandes',
      category: 'Manutenibilidade',
      defaultConfig: DefaultDetectorConfig.javascript.size
    },
    duplication: {
      name: 'Código Duplicado',
      description: 'Encontra blocos de código similares ou duplicados',
      category: 'Manutenibilidade',
      defaultConfig: DefaultDetectorConfig.javascript.duplication
    }
  };

  return detectorInfo[detectorName as keyof typeof detectorInfo] || null;
}

export function validateDetectorConfig(detectorName: string, config: any): boolean {
  try {
    const DetectorClass = JavaScriptDetectors[detectorName];
    if (!DetectorClass) return false;

    new DetectorClass(config);
    return true;
  } catch (error) {
    detectorsLogger.warn('Configuração de detector inválida', {
      detectorName,
      config,
      error: (error as Error).message
    });
    return false;
  }
}

export function getDetectorMetrics(): {
  totalDetectors: number;
  availableLanguages: string[];
  detectorsByCategory: Record<string, string[]>;
} {
  const detectorsByCategory: Record<string, string[]> = {};
  
  Object.keys(JavaScriptDetectors).forEach(detectorName => {
    const info = getDetectorInfo(detectorName);
    if (info) {
      if (!detectorsByCategory[info.category]) {
        detectorsByCategory[info.category] = [];
      }
      detectorsByCategory[info.category].push(detectorName);
    }
  });

  return {
    totalDetectors: Object.keys(JavaScriptDetectors).length,
    availableLanguages: ['javascript', 'typescript'],
    detectorsByCategory
  };
}

// Re-export for convenience
export { BaseDetector } from './base/detector';
export { ComplexityDetector } from './javascript/complexity';
export { NamingDetector } from './javascript/naming';
export { SizeDetector } from './javascript/size';
export { DuplicationDetector } from './javascript/duplication-detector';