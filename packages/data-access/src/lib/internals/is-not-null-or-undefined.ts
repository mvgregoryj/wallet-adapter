import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

/**
 * @module IsNotNullOrUndefined
 * @memberof global
 */

/**
 * Filters out null and undefined values from the source observable.
 * @param {Observable<T | null | undefined>} source - The source observable.
 * @returns {Observable<T>} An observable that only emits non-null and non-undefined values.
 */
export const isNotNullOrUndefined = <T>(
  source: Observable<T | null | undefined>
) =>
  source.pipe(filter((item): item is T => item !== null && item !== undefined));
