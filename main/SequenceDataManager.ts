import fs from 'fs';
import path from 'path';
import * as Ajv from 'ajv';
import type { SequenceConfig } from '@shared/types';

export interface ValidationResult {
  valid: boolean;
  errors?: string | null;
}

export interface DryRunResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

type Step = {
  message: string;
  delay: number;
  commands: string[];
  condition?: {
    sensor: string;
    min: number;
    max?: number | null;
    op?: 'gte' | 'lte';
    timeoutMs?: number;
  };
};

export class SequenceDataManager {
  private readonly sequencesPath: string;
  private readonly schemaPath: string;
  private sequences: SequenceConfig = {};
  private readonly ajv: Ajv.Ajv;
  private validationResult: ValidationResult = { valid: false };

  // 금지 조합 정의(필요 시 확장 가능)
  // 동일 시점에 둘 다 Open이면 금지
  private readonly forbiddenPairs: Array<[string, string]> = [
    ['Ethanol Main', 'N2O Main'],
  ];

  constructor(basePath: string) {
    this.sequencesPath = path.join(basePath, 'sequences.json');
    this.schemaPath = path.join(basePath, 'sequences.schema.json');
    this.ajv = new Ajv.default();
  }

  public loadAndValidate(): ValidationResult {
    try {
      if (!fs.existsSync(this.sequencesPath)) {
        this.validationResult = { valid: false, errors: `sequences.json not found at ${this.sequencesPath}` };
        this.sequences = {};
        return this.validationResult;
      }
      if (!fs.existsSync(this.schemaPath)) {
        this.validationResult = { valid: false, errors: `sequences.schema.json not found at ${this.schemaPath}` };
        this.sequences = {};
        return this.validationResult;
      }

      const fileContent = fs.readFileSync(this.sequencesPath, 'utf-8');
      const data = JSON.parse(fileContent);
      const schemaData = JSON.parse(fs.readFileSync(this.schemaPath, 'utf-8'));
      const validate = this.ajv.compile(schemaData);
      const valid = validate(data);

      if (!valid) {
        this.sequences = {};
        this.validationResult = { valid: false, errors: this.ajv.errorsText(validate.errors) };
        return this.validationResult;
      }

      // 스키마 통과 → 커스텀 정적 검증
      const staticErrors = this.runStaticProhibitions(data as SequenceConfig);
      if (staticErrors.length > 0) {
        this.sequences = {};
        this.validationResult = { valid: false, errors: staticErrors.join(' | ') };
        return this.validationResult;
      }

      // 필수 시퀀스 재확인(스키마에서도 강제하지만 이중 안전)
      if (!data['Emergency Shutdown']) {
        this.sequences = {};
        this.validationResult = { valid: false, errors: 'Missing required sequence: "Emergency Shutdown"' };
        return this.validationResult;
      }

      this.sequences = data as SequenceConfig;
      this.validationResult = { valid: true, errors: null };
      return this.validationResult;

    } catch (error) {
      this.sequences = {};
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      this.validationResult = { valid: false, errors: `Failed to read/validate sequences: ${errorMessage}` };
      return this.validationResult;
    }
  }

  public getSequences(): SequenceConfig {
    return this.sequences;
  }

  public getValidationResult(): ValidationResult {
    return this.validationResult;
  }

  /** watch both sequence & schema to revalidate on change */
  public watch(cb: (seq: SequenceConfig, result: ValidationResult) => void) {
    const onChange = () => {
      this.loadAndValidate();
      cb(this.sequences, this.validationResult);
    };
    try { fs.watch(this.sequencesPath, { persistent: false }, onChange); } catch {}
    try { fs.watch(this.schemaPath, { persistent: false }, onChange); } catch {}
  }

  // ==================== 드라이런(동적 차단) ====================
  /**
   * 지정된 시퀀스가 타임라인 상에서 금지 조합 상태(예: 에탄올/아산화질소 메인 동시 Open)에 도달하는지 사전 검증
   * - V,<idx>,O|C는 이름 매핑이 없으므로 여기서는 무시(필요 시 Config로 매핑 추가)
   */
  public dryRunSequence(name: string): DryRunResult {
    const seq = this.sequences[name] as Step[] | undefined;
    if (!seq || seq.length === 0) {
      return { ok: false, errors: [`Sequence not found or empty: ${name}`], warnings: [] };
    }

    const state = new Map<string, 'OPEN' | 'CLOSED'>(); // 밸브 이름 기준
    const errors: string[] = [];
    const warnings: string[] = [];

    // 타임라인 누적(디버그용)
    let t = 0;

    seq.forEach((step, idx) => {
      t += (typeof step.delay === 'number' ? step.delay : 0);

      for (const cmd of (step.commands ?? [])) {
        const m = /^CMD,([^,]{1,64}),(Open|Close)$/.exec(cmd);
        if (m) {
          const valveName = m[1];
          const act = m[2];
          state.set(valveName, act === 'Open' ? 'OPEN' : 'CLOSED');
        }
      }

      // 금지 조합 체크
      for (const [a, b] of this.forbiddenPairs) {
        if (state.get(a) === 'OPEN' && state.get(b) === 'OPEN') {
          errors.push(`Dynamic forbidden combo at step #${idx + 1} (t≈${t}ms): "${a}" + "${b}" both OPEN in sequence "${name}"`);
        }
      }
    });

    return { ok: errors.length === 0, errors, warnings };
  }

  /** 전체 시퀀스 드라이런(옵션) */
  public dryRunAll(): DryRunResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    Object.keys(this.sequences).forEach((name) => {
      if (name === 'Emergency Shutdown') return; // 비상 시퀀스는 예외
      const r = this.dryRunSequence(name);
      if (!r.ok) errors.push(...r.errors);
      if (r.warnings.length) warnings.push(...r.warnings);
    });
    return { ok: errors.length === 0, errors, warnings };
  }

  // ==================== 커스텀 정적 검증 ====================
  /** 스텝 단위(동일 commands 안) 금지 조합 확인 → 로딩 실패 유도 */
  private runStaticProhibitions(data: SequenceConfig): string[] {
    const errors: string[] = [];
    for (const [seqName, steps] of Object.entries(data)) {
      const arr = steps as Step[];
      arr.forEach((st, i) => {
        const cmds = st.commands || [];
        for (const [a, b] of this.forbiddenPairs) {
          const aOpen = `CMD,${a},Open`;
          const bOpen = `CMD,${b},Open`;
          if (cmds.includes(aOpen) && cmds.includes(bOpen)) {
            errors.push(`Static forbidden combo in "${seqName}" step #${i + 1}: "${aOpen}" + "${bOpen}"`);
          }
        }
      });
    }
    return errors;
  }
}
