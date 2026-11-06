import { Injectable } from '@angular/core';
import en from './en.json';

type Messages = { [key: string]: string | Messages };
type Params = Record<string, string | number>;

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly messages: Messages = en;

  /** t('form.errors.nameMinLength', { min: 3 }) */
  t(key: string, params: Params = {}): string {
    const value = key
      .split('.')
      .reduce<string | Messages | undefined>(
        (node, part) => (typeof node === 'object' ? node[part] : undefined),
        this.messages,
      );

    if (typeof value !== 'string') {
      console.warn(`Missing translation: ${key}`);
      return key;
    }

    return value.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
      name in params ? String(params[name]) : placeholder,
    );
  }
}