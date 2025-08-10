import fs from 'fs';
import path from 'path';
import * as Ajv from 'ajv';
import type { SequenceConfig } from '@shared/types';
import schema from '../src/sequences.schema.json';

export interface ValidationResult {
  valid: boolean;
  errors?: string | null;
}

export class SequenceDataManager {
  private readonly sequencesPath: string;
  private sequences: SequenceConfig = {};
  private readonly ajv: Ajv.Ajv;
  private validationResult: ValidationResult = { valid: false };

  /**
   * Manages loading, validation, and watching of the sequences.json file.
   * @param appPath - The root path of the application (e.g., app.getAppPath()).
   */
  constructor(appPath: string) {
    // In production, files from 'src' are often copied to the 'resources' directory.
    // We construct a path that works for both development and production.
    this.sequencesPath = path.join(appPath, 'src', 'sequences.json');
    this.ajv = new Ajv.default();
  }

  /**
   * Loads and validates the sequences from sequences.json.
   * @returns The validation result.
   */
  public loadAndValidate(): ValidationResult {
    try {
      if (!fs.existsSync(this.sequencesPath)) {
        this.validationResult = { valid: false, errors: 'sequences.json not found.' };
        this.sequences = {};
        return this.validationResult;
      }

      const fileContent = fs.readFileSync(this.sequencesPath, 'utf-8');
      const data = JSON.parse(fileContent);

      const validate = this.ajv.compile(schema);
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
        errors: `Failed to read or parse sequences.json: ${errorMessage}`,
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

  /**
   * Watches the sequences.json file for changes and triggers a callback.
   * @param onUpdate - Callback to execute when the file changes and data is reloaded.
   * It receives the new sequences and the validation result.
   */
  public watch(onUpdate: (sequences: SequenceConfig, result: ValidationResult) => void): void {
    if (!fs.existsSync(path.dirname(this.sequencesPath))) {
      console.error(`Cannot watch file. Directory does not exist: ${path.dirname(this.sequencesPath)}`);
      return;
    }

    fs.watch(this.sequencesPath, (eventType) => {
      if (eventType === 'change') {
        console.log('sequences.json changed. Reloading...');
        const result = this.loadAndValidate();
        onUpdate(this.getSequences(), result);
      }
    });
  }
}
