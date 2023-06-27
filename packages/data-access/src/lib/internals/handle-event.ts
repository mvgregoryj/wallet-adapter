import { Observable, of, switchMap } from 'rxjs';

/**
 * Type representing a projection function.
 */
type ProjectionFunction<SourceType, OutputType> = (
  value: SourceType
) => Observable<OutputType | null>;

/**
 * Type representing a handler function.
 */
type HandlerFunction<SourceType, OutputType> = (
  source: Observable<SourceType | null>
) => Observable<OutputType | null>;

/**
 * Handles events by projecting non-null values using the provided function.
 * @param {ProjectionFunction<SourceType, OutputType>} project - The function to use for projecting non-null values.
 * @returns {HandlerFunction<SourceType, OutputType>} A function that takes a source observable and returns an observable of projected values.
 */
export const handleEvent =
  <SourceType, OutputType>(
    project: ProjectionFunction<SourceType, OutputType>
  ): HandlerFunction<SourceType, OutputType> =>
  (source: Observable<SourceType | null>): Observable<OutputType | null> =>
    source.pipe(
      switchMap((payload) => (payload === null ? of(null) : project(payload)))
    );
