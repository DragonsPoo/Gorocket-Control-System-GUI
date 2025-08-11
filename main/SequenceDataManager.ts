import fs from 'fs';
import path from 'path';
import * as Ajv from 'ajv';
import type { SequenceConfig } from '@shared/types';

export interface ValidationResult {
  valid: boolean;
  errors?: string | null;
}

export class SequenceDataManager {
  private readonly sequencesPath: string;
  private readonly schemaPath: string;
  private sequences: SequenceConfig = {};
  private readonly ajv: Ajv.Ajv;
  private validationResult: ValidationResult = { valid: false };

  /**
   * Manages loading, validation, and watching of the sequences.json file.
   * @param basePath - Base path where sequences.json and sequences.schema.json reside.
   */
  constructor(basePath: string) {
    this.sequencesPath = path.join(basePath, 'sequences.json');
    this.schemaPath = path.join(basePath, 'sequences.schema.json');
    this.ajv = new Ajv.default();
  }

  /**
   * Loads and validates the sequences from sequences.json.
   * @returns The validation result.
   */
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

      if (valid) {
        this.sequences = data as SequenceConfig;
        this.validationResult = { valid: true, errors: null };
      } else {
        this.sequences = {};
        this.validationResult = {
          valid: false,
          errors: this.ajv.errorsText(validate.errors),
        };
      }
    } catch (error) {
      this.sequences = {};
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      this.validationResult = {
        valid: false,
        errors: `Failed to read/validate sequences: ${errorMessage}`,
      };
    }
    return this.validationResult;
  }

  /**
   * Returns the currently loaded sequences.
   */
  public getSequences(): SequenceConfig {
    return this.sequences;
  }

  /**
   * Returns the latest validation result.
   */
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
}
