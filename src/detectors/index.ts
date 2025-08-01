import { BaseDetector } from './base/detector';
import { ComplexityDetector } from './javascript/complexity';
import { NamingDetector } from './javascript/naming';
import { SizeDetector } from './javascript/size';

export interface DetectorRegistry {
  [key: string]: new (config?: any) => BaseDetector;
}

export const JavaScriptDetectors: DetectorRegistry = {
  complexity: ComplexityDetector,
  naming: NamingDetector,
  size: SizeDetector
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
    }
  }
};

export function createDetectorsForLanguage(language: string, config?: any): BaseDetector[] {
  const detectors: BaseDetector[] = [];
  
  if (language === 'javascript' || language === 'typescript') {
    const jsConfig = config?.javascript || DefaultDetectorConfig.javascript;
    
    Object.entries(JavaScriptDetectors).forEach(([name, DetectorClass]) => {
      const detectorConfig = jsConfig[name];
      if (detectorConfig?.enabled !== false) {
        detectors.push(new DetectorClass(detectorConfig));
      }
    });
  }
  
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
      return new DetectorClass(config);
    }
  }
  
  return null;
}

// Re-export for convenience
export { BaseDetector } from './base/detector';
export { ComplexityDetector } from './javascript/complexity';
export { NamingDetector } from './javascript/naming';
export { SizeDetector } from './javascript/size';