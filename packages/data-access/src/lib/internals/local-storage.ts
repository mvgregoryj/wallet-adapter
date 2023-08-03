import { BehaviorSubject } from 'rxjs';

/**
 * @module LocalStorageSubject
 * @memberof global
 */

/**
 * Gets the initial value for the given key from local storage.
 * @param {string} key - The key to get the value for.
 * @returns {T | null} The initial value, or null if not found.
 */
const getInitialValue = <T>(key: string): T | null => {
  try {
    const value = localStorage.getItem(key);

    return value ? (JSON.parse(value) as T) : null;
  } catch (error) {
    if (typeof window !== 'undefined') {
      console.error(error);
    }
  }

  return null;
};

/**
 * A subject that stores its value in local storage.
 */
export class LocalStorageSubject<T> extends BehaviorSubject<T | null> {
  constructor(private _key: string) {
    super(getInitialValue<T>(_key));
  }

  /**
   * Sets the next value and updates local storage.
   * @param {T | null} value - The next value.
   */
  override next(value: T | null): void {
    try {
      if (value === null) {
        localStorage.removeItem(this._key);
      } else {
        localStorage.setItem(this._key, JSON.stringify(value));
      }
    } catch (error) {
      if (typeof window !== 'undefined') {
        console.error(error);
      }
    }

    super.next(value);
  }
}
